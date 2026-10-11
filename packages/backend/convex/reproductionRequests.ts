import { getAuthUserId } from "@convex-dev/auth/server";
import {
  paginationOptsValidator,
  paginationResultValidator,
} from "convex/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { type MutationCtx, type QueryCtx, query } from "./_generated/server";
import { objectLabel } from "./utils/collectionDisplayHelpers";
import {
  DELIVERY_MAX_ATTEMPTS,
  isRetryableStatus,
  retrySeriesPatch,
} from "./utils/deliveryLedger";
import { internalMutation, mutation } from "./utils/mutationBuilders";
import { dispatchNotification } from "./utils/notificationDispatch";
import { notificationEmailChannel } from "./utils/notificationEmailChannel";
import { applyUsageCounterDelta } from "./utils/organizationUsageCounters";
import { partyDisplayName, requireLinkableParty } from "./utils/parties";
import { recordPartyLink } from "./utils/partyLinks";
import { getCurrentUserOrganization } from "./utils/permissions";
import { isWithdrawnObject } from "./utils/provenance";
import { getPublicationSource } from "./utils/publicMedia";
import {
  finishDeliveryWithoutSending,
  grantState,
  queueDelivery,
} from "./utils/reproductionDelivery";
import {
  deliveriesView,
  deliveryItem,
  downloadItem,
  downloadsView,
} from "./utils/reproductionDeliveryViews";
import {
  reproductionCommands,
  reproductionDeciders,
  requireReproductionAccess,
  requireReproductionRequest,
} from "./utils/reproductionRequestAccess";
import { reproductionError } from "./utils/reproductionRequestErrors";
import {
  derivativeSize,
  reproductionEvidenceKind,
  reproductionLocale,
  reproductionPurpose,
  reproductionStatus,
} from "./utils/reproductionRequestValidators";
import { emitWebhookEvent } from "./utils/webhookEvents";

const TEXT_LIMIT = 4000;
const SUPPORTED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/tiff",
];

async function requireUserId(ctx: QueryCtx | MutationCtx) {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("Not authenticated");
  return userId;
}

function requiredText(
  value: string,
  code:
    | "PURPOSE_REQUIRED"
    | "SUMMARY_REQUIRED"
    | "REASON_REQUIRED"
    | "TERMS_TEXT_REQUIRED",
) {
  const text = value.trim();
  if (!text) throw reproductionError(code, "Text is required");
  if (text.length > TEXT_LIMIT)
    throw reproductionError(
      "TEXT_TOO_LONG",
      `Text is limited to ${TEXT_LIMIT} characters`,
    );
  return text;
}

/** The image staff may make a Licensed copy of, or the reason not. */
function derivativeBlocker(media: Doc<"mediaFiles">) {
  if (
    media.fileType !== "image" ||
    media.mediaCategory === "document" ||
    !SUPPORTED_IMAGE_TYPES.includes(media.mimeType)
  )
    return "Only supported images can be reproduced";
  if (media.uploadStatus !== "completed") return "Image upload is not complete";
  return null;
}

async function nextRequestNumber(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
  now: number,
) {
  const year = new Date(now).getUTCFullYear();
  const counter = await ctx.db
    .query("reproductionRequestCounters")
    .withIndex("by_organization_and_year", (q) =>
      q.eq("organizationId", organizationId).eq("year", year),
    )
    .unique();
  const value = (counter?.currentValue ?? 0) + 1;
  if (counter) {
    await ctx.db.patch(counter._id, {
      currentValue: value,
      lastGeneratedAt: now,
    });
  } else {
    await ctx.db.insert("reproductionRequestCounters", {
      organizationId,
      year,
      currentValue: value,
      lastGeneratedAt: now,
    });
  }
  return `RR-${year}-${String(value).padStart(4, "0")}`;
}

export const create = mutation({
  args: {
    organizationId: v.id("organizations"),
    objectId: v.id("collections"),
    mediaId: v.id("mediaFiles"),
    requesterAccountId: v.id("accounts"),
    purpose: reproductionPurpose,
    purposeDetails: v.string(),
    requesterLocale: reproductionLocale,
  },
  returns: v.object({
    requestId: v.id("reproductionRequests"),
    requestNumber: v.string(),
  }),
  handler: async (ctx, args) => {
    await requireReproductionAccess(ctx, args.organizationId, "prepare");
    const userId = await requireUserId(ctx);
    const purposeDetails = requiredText(
      args.purposeDetails,
      "PURPOSE_REQUIRED",
    );
    const [object, media] = await Promise.all([
      ctx.db.get(args.objectId),
      ctx.db.get(args.mediaId),
    ]);
    if (
      !object ||
      object.organizationId !== args.organizationId ||
      isWithdrawnObject(object)
    )
      throw reproductionError(
        "OBJECT_UNAVAILABLE",
        "Object is unavailable in this organization",
      );
    if (
      !media ||
      media.organizationId !== args.organizationId ||
      media.collectionId !== object._id
    )
      throw reproductionError(
        "IMAGE_NOT_ELIGIBLE",
        "Image is not an image of this Object",
      );
    const blocker = derivativeBlocker(media);
    if (blocker) throw reproductionError("IMAGE_NOT_ELIGIBLE", blocker);
    const party = await requireLinkableParty(
      ctx,
      args.organizationId,
      args.requesterAccountId,
    );
    const requesterEmail = (party.email ?? party.contactEmail)?.trim();
    if (!requesterEmail?.includes("@"))
      throw reproductionError(
        "REQUESTER_EMAIL_MISSING",
        "The requester needs an email address for delivery",
      );

    const now = Date.now();
    const requestNumber = await nextRequestNumber(
      ctx,
      args.organizationId,
      now,
    );
    const requestId = await ctx.db.insert("reproductionRequests", {
      organizationId: args.organizationId,
      requestNumber,
      objectId: object._id,
      mediaId: media._id,
      requesterAccountId: party._id,
      requesterName: partyDisplayName(party),
      requesterEmail,
      requesterLocale: args.requesterLocale,
      purpose: args.purpose,
      purposeDetails,
      status: "open",
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
    });
    await recordPartyLink(ctx, {
      organizationId: args.organizationId,
      target: { type: "reproductionRequest", id: requestId },
      account: party,
      role: "requester",
      allowedRoles: ["requester"],
      effectiveFrom: now,
      userId,
      origin: "staff",
    });
    await ctx.runMutation(internal.audit.logAction, {
      organizationId: args.organizationId,
      userId,
      action: "reproduction_request_created",
      entityType: "reproductionRequest",
      entityId: requestId,
      changes: {
        requestNumber,
        objectId: object._id,
        mediaId: media._id,
        requesterAccountId: party._id,
        purpose: args.purpose,
      },
    });
    await dispatchNotification(ctx, {
      organizationId: args.organizationId,
      type: "reproduction_request_received",
      recipients: (await reproductionDeciders(ctx, args.organizationId)).filter(
        (deciderId) => deciderId !== userId,
      ),
      title: "Reproduction request awaits a decision",
      message: `Request ${requestNumber} asks to use an image of ${objectLabel(object)}.`,
      related: { entityType: "reproductionRequest", entityId: requestId },
      idempotencyKey: `reproduction-request:${requestId}:received`,
    });
    return { requestId, requestNumber };
  },
});

function requireOpen(request: Doc<"reproductionRequests">) {
  if (request.status !== "open")
    throw reproductionError(
      "REQUEST_NOT_OPEN",
      "Only an open request can be changed",
    );
}

async function touch(ctx: MutationCtx, request: Doc<"reproductionRequests">) {
  await ctx.db.patch(request._id, { updatedAt: Date.now() });
}

async function logRequestAction(
  ctx: MutationCtx,
  request: Doc<"reproductionRequests">,
  userId: Id<"users">,
  action: string,
  changes: Record<string, string | number | boolean | undefined> = {},
) {
  await ctx.runMutation(internal.audit.logAction, {
    organizationId: request.organizationId,
    userId,
    action,
    entityType: "reproductionRequest",
    entityId: request._id,
    changes: {
      requestNumber: request.requestNumber,
      objectId: request.objectId,
      ...changes,
    },
  });
}

export const addEvidence = mutation({
  args: {
    requestId: v.id("reproductionRequests"),
    kind: reproductionEvidenceKind,
    summary: v.string(),
    documentMediaId: v.optional(v.id("mediaFiles")),
  },
  returns: v.id("reproductionEvidence"),
  handler: async (ctx, args) => {
    const request = await requireReproductionRequest(
      ctx,
      args.requestId,
      "prepare",
    );
    const userId = await requireUserId(ctx);
    requireOpen(request);
    const summary = requiredText(args.summary, "SUMMARY_REQUIRED");
    if (args.documentMediaId) {
      const document = await ctx.db.get(args.documentMediaId);
      if (
        !document ||
        document.organizationId !== request.organizationId ||
        document.collectionId !== request.objectId
      )
        throw reproductionError(
          "EVIDENCE_DOCUMENT_INVALID",
          "Evidence must be a file of the requested Object",
        );
    }
    const evidenceId = await ctx.db.insert("reproductionEvidence", {
      organizationId: request.organizationId,
      requestId: request._id,
      kind: args.kind,
      summary,
      documentMediaId: args.documentMediaId,
      recordedBy: userId,
      recordedAt: Date.now(),
    });
    await touch(ctx, request);
    await logRequestAction(
      ctx,
      request,
      userId,
      "reproduction_evidence_added",
      {
        evidenceId,
        kind: args.kind,
      },
    );
    return evidenceId;
  },
});

export const retractEvidence = mutation({
  args: { evidenceId: v.id("reproductionEvidence"), reason: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const evidence = await ctx.db.get(args.evidenceId);
    if (!evidence)
      throw reproductionError("EVIDENCE_NOT_FOUND", "Evidence not found");
    const request = await requireReproductionRequest(
      ctx,
      evidence.requestId,
      "prepare",
    );
    const userId = await requireUserId(ctx);
    requireOpen(request);
    const reason = requiredText(args.reason, "REASON_REQUIRED");
    if (evidence.retractedAt !== undefined) return null;
    await ctx.db.patch(evidence._id, {
      retractedAt: Date.now(),
      retractedBy: userId,
      retractionReason: reason,
    });
    await touch(ctx, request);
    await logRequestAction(
      ctx,
      request,
      userId,
      "reproduction_evidence_retracted",
      { evidenceId: evidence._id, reason },
    );
    return null;
  },
});

const DERIVATIVE_LIMIT = 50;

async function derivativesOf(
  ctx: QueryCtx | MutationCtx,
  requestId: Id<"reproductionRequests">,
) {
  return await ctx.db
    .query("reproductionDerivatives")
    .withIndex("by_requestId", (q) => q.eq("requestId", requestId))
    .order("desc")
    .take(DERIVATIVE_LIMIT);
}

/** The requested image, still in the request's organization and reproducible. */
async function requireReproducibleSource(
  ctx: MutationCtx,
  request: Doc<"reproductionRequests">,
) {
  const media = await ctx.db.get(request.mediaId);
  if (
    !media ||
    media.organizationId !== request.organizationId ||
    media.collectionId !== request.objectId
  )
    throw reproductionError("IMAGE_NOT_ELIGIBLE", "Image is unavailable");
  const blocker = derivativeBlocker(media);
  if (blocker) throw reproductionError("IMAGE_NOT_ELIGIBLE", blocker);
  const source = await getPublicationSource(ctx, media);
  if (!source)
    throw reproductionError(
      "IMAGE_SOURCE_UNVERIFIED",
      "Source ownership or version is unverified. Reupload the image or create a verified version.",
    );
  return { media, source };
}

export const prepareDerivative = mutation({
  args: {
    requestId: v.id("reproductionRequests"),
    maxDimension: derivativeSize,
  },
  returns: v.id("reproductionDerivatives"),
  handler: async (ctx, args) => {
    const request = await requireReproductionRequest(
      ctx,
      args.requestId,
      "prepare",
    );
    const userId = await requireUserId(ctx);
    requireOpen(request);
    const { media, source } = await requireReproducibleSource(ctx, request);
    const [latest] = await derivativesOf(ctx, request._id);
    if (latest?.status === "processing")
      throw reproductionError(
        "DERIVATIVE_IN_PROGRESS",
        "A derivative is already being made",
      );
    const jobId = crypto.randomUUID();
    const derivativeId = await ctx.db.insert("reproductionDerivatives", {
      organizationId: request.organizationId,
      requestId: request._id,
      mediaId: media._id,
      jobId,
      sourceStorageId: source.storageId,
      versionId: source.versionId,
      maxDimension: args.maxDimension,
      status: "processing",
      createdBy: userId,
      createdAt: Date.now(),
    });
    await ctx.scheduler.runAfter(
      0,
      internal.reproductionRequestsActions.makeDerivative,
      {
        derivativeId,
        jobId,
        sourceStorageId: source.storageId,
        maxDimension: args.maxDimension,
      },
    );
    await touch(ctx, request);
    await logRequestAction(
      ctx,
      request,
      userId,
      "reproduction_derivative_requested",
      { derivativeId, maxDimension: args.maxDimension },
    );
    return derivativeId;
  },
});

/**
 * Accepts a finished derivative only for the job that is still processing
 * and while its source is still the image's verified current file.
 */
export const completeDerivative = internalMutation({
  args: {
    derivativeId: v.id("reproductionDerivatives"),
    jobId: v.string(),
    storageId: v.id("_storage"),
    width: v.number(),
    height: v.number(),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const derivative = await ctx.db.get(args.derivativeId);
    if (
      derivative?.status !== "processing" ||
      derivative.jobId !== args.jobId ||
      args.storageId === derivative.sourceStorageId
    )
      return false;
    const [media, blob] = await Promise.all([
      ctx.db.get(derivative.mediaId),
      ctx.db.system.get(args.storageId),
    ]);
    const source = media ? await getPublicationSource(ctx, media) : null;
    if (
      !blob ||
      source?.storageId !== derivative.sourceStorageId ||
      source.versionId !== derivative.versionId
    )
      return false;
    await ctx.db.insert("storageOwnership", {
      storageId: args.storageId,
      organizationId: derivative.organizationId,
      uploadedBy: derivative.createdBy,
      uploadedAt: Date.now(),
      ownerType: "reproductionDerivative",
      ownerId: derivative._id,
    });
    await ctx.db.patch(derivative._id, {
      status: "ready",
      storageId: args.storageId,
      width: args.width,
      height: args.height,
      byteSize: blob.size,
      completedAt: Date.now(),
    });
    await applyUsageCounterDelta(ctx, derivative.organizationId, {
      storageBytes: blob.size,
    });
    return true;
  },
});

export const failDerivative = internalMutation({
  args: { derivativeId: v.id("reproductionDerivatives"), jobId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const derivative = await ctx.db.get(args.derivativeId);
    if (
      derivative?.status === "processing" &&
      derivative.jobId === args.jobId
    ) {
      await ctx.db.patch(derivative._id, {
        status: "failed",
        completedAt: Date.now(),
      });
    }
    return null;
  },
});

const derivativeItem = v.object({
  _id: v.id("reproductionDerivatives"),
  status: v.union(
    v.literal("processing"),
    v.literal("ready"),
    v.literal("failed"),
  ),
  maxDimension: derivativeSize,
  width: v.optional(v.number()),
  height: v.optional(v.number()),
  byteSize: v.optional(v.number()),
  createdAt: v.number(),
  previewUrl: v.optional(v.string()),
});

async function derivativesView(
  ctx: QueryCtx,
  request: Doc<"reproductionRequests">,
) {
  const rows = await derivativesOf(ctx, request._id);
  return await Promise.all(
    rows.map(async (row) => ({
      _id: row._id,
      status: row.status,
      maxDimension: row.maxDimension,
      width: row.width,
      height: row.height,
      byteSize: row.byteSize,
      createdAt: row.createdAt,
      previewUrl: row.storageId
        ? ((await ctx.storage.getUrl(row.storageId)) ?? undefined)
        : undefined,
    })),
  );
}

const TERMS_LIMIT = 50;
/** The longest term an approval may grant. */
const MAX_TERM_MS = 10 * 366 * 24 * 60 * 60 * 1000;

async function latestTerms(
  ctx: QueryCtx | MutationCtx,
  organizationId: Id<"organizations">,
) {
  return await ctx.db
    .query("reproductionTerms")
    .withIndex("by_organization_and_version", (q) =>
      q.eq("organizationId", organizationId),
    )
    .order("desc")
    .first();
}

/** Publishes a new version of the Terms of use; earlier versions are kept. */
export const publishTerms = mutation({
  args: {
    organizationId: v.id("organizations"),
    title: v.string(),
    body: v.string(),
  },
  returns: v.object({
    termsId: v.id("reproductionTerms"),
    version: v.number(),
  }),
  handler: async (ctx, args) => {
    await requireReproductionAccess(ctx, args.organizationId, "decide");
    const userId = await requireUserId(ctx);
    const title = requiredText(args.title, "TERMS_TEXT_REQUIRED");
    const body = requiredText(args.body, "TERMS_TEXT_REQUIRED");
    const version =
      ((await latestTerms(ctx, args.organizationId))?.version ?? 0) + 1;
    const termsId = await ctx.db.insert("reproductionTerms", {
      organizationId: args.organizationId,
      version,
      title,
      body,
      publishedBy: userId,
      publishedAt: Date.now(),
    });
    await ctx.runMutation(internal.audit.logAction, {
      organizationId: args.organizationId,
      userId,
      action: "reproduction_terms_published",
      entityType: "reproductionTerms",
      entityId: termsId,
      changes: { version, title },
    });
    return { termsId, version };
  },
});

export const listTerms = query({
  args: { organizationId: v.id("organizations") },
  returns: v.array(
    v.object({
      _id: v.id("reproductionTerms"),
      version: v.number(),
      title: v.string(),
      body: v.string(),
      publishedAt: v.number(),
      publishedByName: v.optional(v.string()),
    }),
  ),
  handler: async (ctx, args) => {
    await requireReproductionAccess(ctx, args.organizationId, "read");
    const rows = await ctx.db
      .query("reproductionTerms")
      .withIndex("by_organization_and_version", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .order("desc")
      .take(TERMS_LIMIT);
    return await Promise.all(
      rows.map(async (row) => ({
        _id: row._id,
        version: row.version,
        title: row.title,
        body: row.body,
        publishedAt: row.publishedAt,
        publishedByName: await userName(ctx, row.publishedBy),
      })),
    );
  },
});

async function latestTermsSummary(
  ctx: QueryCtx,
  organizationId: Id<"organizations">,
) {
  const terms = await latestTerms(ctx, organizationId);
  return terms
    ? { _id: terms._id, version: terms.version, title: terms.title }
    : null;
}

async function activeEvidenceIds(
  ctx: MutationCtx,
  request: Doc<"reproductionRequests">,
) {
  const rows = await ctx.db
    .query("reproductionEvidence")
    .withIndex("by_requestId", (q) => q.eq("requestId", request._id))
    .take(EVIDENCE_LIMIT);
  return rows.flatMap((row) =>
    row.retractedAt === undefined ? [row._id] : [],
  );
}

function rightsOf(media: Doc<"mediaFiles"> | null) {
  return {
    rightsStatus: media?.rightsStatus,
    licenseType: media?.licenseType,
    licenseExpiry: media?.licenseExpiry,
    rightsHolder: media?.rightsHolder,
    copyright: media?.copyright,
    usageRestrictions: media?.usageRestrictions,
    acknowledgmentText: media?.acknowledgmentText,
  };
}

/**
 * Approves the request on its current rights evidence under the latest
 * Terms of use until `expiresAt`, with a ready derivative of the requested
 * image as the only file the requester receives.
 */
export const approve = mutation({
  args: {
    requestId: v.id("reproductionRequests"),
    derivativeId: v.id("reproductionDerivatives"),
    termsId: v.id("reproductionTerms"),
    expiresAt: v.number(),
    note: v.optional(v.string()),
  },
  returns: v.id("reproductionDecisions"),
  handler: async (ctx, args) => {
    const request = await requireReproductionRequest(
      ctx,
      args.requestId,
      "decide",
    );
    const userId = await requireUserId(ctx);
    requireOpen(request);
    const now = Date.now();
    const [terms, current] = await Promise.all([
      ctx.db.get(args.termsId),
      latestTerms(ctx, request.organizationId),
    ]);
    if (!terms || terms.organizationId !== request.organizationId)
      throw reproductionError(
        "TERMS_NOT_PUBLISHED",
        "Publish the Terms of use before approving",
      );
    if (current?._id !== terms._id)
      throw reproductionError(
        "TERMS_OUTDATED",
        "A newer version of the Terms of use was published",
      );
    if (args.expiresAt <= now || args.expiresAt > now + MAX_TERM_MS)
      throw reproductionError(
        "EXPIRY_INVALID",
        "The expiry must be in the future and within ten years",
      );
    const evidenceIds = await activeEvidenceIds(ctx, request);
    if (evidenceIds.length === 0)
      throw reproductionError(
        "EVIDENCE_REQUIRED",
        "Record the rights evidence before approving",
      );
    const { media, source } = await requireReproducibleSource(ctx, request);
    const derivative = await ctx.db.get(args.derivativeId);
    if (
      derivative?.requestId !== request._id ||
      derivative.status !== "ready" ||
      !derivative.storageId ||
      derivative.sourceStorageId !== source.storageId ||
      derivative.versionId !== source.versionId
    )
      throw reproductionError(
        "DERIVATIVE_NOT_READY",
        "Prepare a derivative of the current image before approving",
      );
    const note = args.note?.trim() || undefined;
    if (note && note.length > TEXT_LIMIT)
      throw reproductionError("TEXT_TOO_LONG", "Note is too long");

    const decisionId = await ctx.db.insert("reproductionDecisions", {
      organizationId: request.organizationId,
      requestId: request._id,
      outcome: "approved",
      reason: note,
      decidedBy: userId,
      decidedAt: now,
      rights: rightsOf(media),
      evidenceIds,
      approval: {
        derivativeId: derivative._id,
        termsId: terms._id,
        termsVersion: terms.version,
        termsTitle: terms.title,
        termsBody: terms.body,
        expiresAt: args.expiresAt,
      },
    });
    await ctx.db.patch(request._id, {
      status: "approved",
      currentDecisionId: decisionId,
      updatedAt: now,
    });
    await ctx.scheduler.runAt(
      args.expiresAt,
      internal.reproductionRequests.expire,
      { decisionId },
    );
    await queueDelivery(
      ctx,
      { ...request, status: "approved", currentDecisionId: decisionId },
      decisionId,
      userId,
    );
    await emitWebhookEvent(
      ctx,
      request.organizationId,
      "reproduction_request.decided",
      {
        requestId: request._id,
        requestNumber: request.requestNumber,
        decisionId,
        objectId: request.objectId,
        mediaId: request.mediaId,
        purpose: request.purpose,
        outcome: "approved",
        termsVersion: terms.version,
        expiresAt: args.expiresAt,
      },
    );
    await logRequestAction(
      ctx,
      request,
      userId,
      "reproduction_request_approved",
      {
        decisionId,
        derivativeId: derivative._id,
        termsVersion: terms.version,
        expiresAt: args.expiresAt,
      },
    );
    return decisionId;
  },
});

export const refuse = mutation({
  args: { requestId: v.id("reproductionRequests"), reason: v.string() },
  returns: v.id("reproductionDecisions"),
  handler: async (ctx, args) => {
    const request = await requireReproductionRequest(
      ctx,
      args.requestId,
      "decide",
    );
    const userId = await requireUserId(ctx);
    requireOpen(request);
    const reason = requiredText(args.reason, "REASON_REQUIRED");
    const now = Date.now();
    const media = await ctx.db.get(request.mediaId);
    const decisionId = await ctx.db.insert("reproductionDecisions", {
      organizationId: request.organizationId,
      requestId: request._id,
      outcome: "refused",
      reason,
      decidedBy: userId,
      decidedAt: now,
      rights: rightsOf(
        media?.organizationId === request.organizationId ? media : null,
      ),
      evidenceIds: await activeEvidenceIds(ctx, request),
    });
    await ctx.db.patch(request._id, {
      status: "refused",
      currentDecisionId: decisionId,
      updatedAt: now,
      closedAt: now,
      closedBy: userId,
    });
    await emitWebhookEvent(
      ctx,
      request.organizationId,
      "reproduction_request.decided",
      {
        requestId: request._id,
        requestNumber: request.requestNumber,
        decisionId,
        objectId: request.objectId,
        mediaId: request.mediaId,
        purpose: request.purpose,
        outcome: "refused",
      },
    );
    await logRequestAction(
      ctx,
      request,
      userId,
      "reproduction_request_refused",
      {
        decisionId,
        reason,
      },
    );
    return decisionId;
  },
});

/** Ends an approval at the end of its term; a revoked one stays revoked. */
export const expire = internalMutation({
  args: { decisionId: v.id("reproductionDecisions") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const decision = await ctx.db.get(args.decisionId);
    const expiresAt = decision?.approval?.expiresAt;
    if (!decision || expiresAt === undefined || decision.endedAt !== undefined)
      return null;
    const now = Date.now();
    if (expiresAt > now) {
      await ctx.scheduler.runAt(
        expiresAt,
        internal.reproductionRequests.expire,
        {
          decisionId: decision._id,
        },
      );
      return null;
    }
    await ctx.db.patch(decision._id, { endedAt: expiresAt });
    const request = await ctx.db.get(decision.requestId);
    if (
      request?.currentDecisionId === decision._id &&
      request.status === "approved"
    ) {
      await ctx.db.patch(request._id, {
        status: "expired",
        updatedAt: now,
        closedAt: expiresAt,
      });
      await emitWebhookEvent(
        ctx,
        request.organizationId,
        "reproduction_request.ended",
        {
          requestId: request._id,
          requestNumber: request.requestNumber,
          decisionId: decision._id,
          outcome: "expired",
          endedAt: expiresAt,
        },
      );
    }
    return null;
  },
});

/** The request's approval while it still lets the requester download. */
async function requireActiveGrant(
  ctx: MutationCtx,
  request: Doc<"reproductionRequests">,
) {
  const decision = request.currentDecisionId
    ? await ctx.db.get(request.currentDecisionId)
    : null;
  if (
    !decision ||
    request.status !== "approved" ||
    grantState(decision, Date.now()) !== "active"
  )
    throw reproductionError(
      "GRANT_NOT_ACTIVE",
      "The approval has ended or was never given",
    );
  return decision;
}

function requireEmailChannel() {
  if (notificationEmailChannel().kind === "unavailable")
    throw reproductionError(
      "EMAIL_CHANNEL_UNAVAILABLE",
      "This deployment does not send email",
    );
}

/** Emails the approved derivative's link to the requester again. */
export const resendDelivery = mutation({
  args: { requestId: v.id("reproductionRequests") },
  returns: v.id("reproductionDeliveries"),
  handler: async (ctx, args) => {
    const request = await requireReproductionRequest(
      ctx,
      args.requestId,
      "decide",
    );
    const userId = await requireUserId(ctx);
    const decision = await requireActiveGrant(ctx, request);
    requireEmailChannel();
    const deliveryId = await queueDelivery(ctx, request, decision._id, userId);
    await logRequestAction(
      ctx,
      request,
      userId,
      "reproduction_delivery_resent",
      {
        deliveryId,
      },
    );
    return deliveryId;
  },
});

/**
 * Starts a new attempt series on a failed or cancelled delivery. The series
 * sends a new download link; links already sent keep working.
 */
export const retryDelivery = mutation({
  args: { deliveryId: v.id("reproductionDeliveries") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const delivery = await ctx.db.get(args.deliveryId);
    if (!delivery)
      throw reproductionError("REQUEST_NOT_FOUND", "Delivery not found");
    const request = await requireReproductionRequest(
      ctx,
      delivery.requestId,
      "decide",
    );
    const decision = await requireActiveGrant(ctx, request);
    if (decision._id !== delivery.decisionId)
      throw reproductionError(
        "GRANT_NOT_ACTIVE",
        "This delivery belongs to an earlier decision",
      );
    if (!isRetryableStatus(delivery.status))
      throw reproductionError(
        "DELIVERY_NOT_RETRYABLE",
        "Only a failed or cancelled delivery can be retried",
      );
    requireEmailChannel();
    const userId = await requireUserId(ctx);
    await ctx.db.patch(delivery._id, {
      ...retrySeriesPatch(delivery, userId, DELIVERY_MAX_ATTEMPTS, Date.now()),
      pendingToken: undefined,
      accessLinkId: undefined,
    });
    await ctx.scheduler.runAfter(
      0,
      internal.reproductionDeliveriesActions.attemptDelivery,
      { deliveryId: delivery._id, attempt: delivery.attemptCount + 1 },
    );
    await logRequestAction(
      ctx,
      request,
      userId,
      "reproduction_delivery_retried",
      {
        deliveryId: delivery._id,
      },
    );
    return null;
  },
});

const PENDING_DELIVERY_LIMIT = 50;

/**
 * Ends an approval before its term. Download links stop working at once and
 * deliveries not yet sent are cancelled.
 */
export const revoke = mutation({
  args: { requestId: v.id("reproductionRequests"), reason: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const request = await requireReproductionRequest(
      ctx,
      args.requestId,
      "decide",
    );
    const userId = await requireUserId(ctx);
    const reason = requiredText(args.reason, "REASON_REQUIRED");
    const decision = await requireActiveGrant(ctx, request);
    const now = Date.now();
    await ctx.db.patch(decision._id, {
      endedAt: now,
      endedBy: userId,
      endReason: reason,
    });
    await ctx.db.patch(request._id, {
      status: "revoked",
      updatedAt: now,
      closedAt: now,
      closedBy: userId,
    });
    const deliveries = await ctx.db
      .query("reproductionDeliveries")
      .withIndex("by_requestId", (q) => q.eq("requestId", request._id))
      .order("desc")
      .take(PENDING_DELIVERY_LIMIT);
    for (const delivery of deliveries) {
      if (delivery.status === "pending")
        await finishDeliveryWithoutSending(
          ctx,
          delivery,
          "cancelled",
          "grant_inactive",
        );
    }
    await emitWebhookEvent(
      ctx,
      request.organizationId,
      "reproduction_request.ended",
      {
        requestId: request._id,
        requestNumber: request.requestNumber,
        decisionId: decision._id,
        outcome: "revoked",
        endedAt: now,
      },
    );
    await logRequestAction(
      ctx,
      request,
      userId,
      "reproduction_request_revoked",
      {
        decisionId: decision._id,
        reason,
      },
    );
    return null;
  },
});

const decisionItem = v.object({
  _id: v.id("reproductionDecisions"),
  outcome: v.union(v.literal("approved"), v.literal("refused")),
  reason: v.optional(v.string()),
  decidedAt: v.number(),
  decidedByName: v.optional(v.string()),
  rights: v.object({
    rightsStatus: v.optional(v.string()),
    licenseType: v.optional(v.string()),
    licenseExpiry: v.optional(v.number()),
    rightsHolder: v.optional(v.string()),
    copyright: v.optional(v.string()),
    usageRestrictions: v.optional(v.string()),
    acknowledgmentText: v.optional(v.string()),
  }),
  evidenceIds: v.array(v.id("reproductionEvidence")),
  approval: v.optional(
    v.object({
      derivativeId: v.id("reproductionDerivatives"),
      termsId: v.id("reproductionTerms"),
      termsVersion: v.number(),
      termsTitle: v.string(),
      termsBody: v.string(),
      expiresAt: v.number(),
    }),
  ),
  grant: v.optional(
    v.union(v.literal("active"), v.literal("expired"), v.literal("revoked")),
  ),
  ended: v.optional(
    v.object({
      at: v.number(),
      byName: v.optional(v.string()),
      reason: v.optional(v.string()),
    }),
  ),
});

async function decisionView(
  ctx: QueryCtx,
  request: Doc<"reproductionRequests">,
) {
  const decision = request.currentDecisionId
    ? await ctx.db.get(request.currentDecisionId)
    : null;
  if (!decision || decision.requestId !== request._id) return null;
  return {
    _id: decision._id,
    outcome: decision.outcome,
    reason: decision.reason,
    decidedAt: decision.decidedAt,
    decidedByName: await userName(ctx, decision.decidedBy),
    rights: decision.rights,
    evidenceIds: decision.evidenceIds,
    approval: decision.approval,
    grant: grantState(decision, Date.now()),
    ended:
      decision.endedAt === undefined
        ? undefined
        : {
            at: decision.endedAt,
            byName: await userName(ctx, decision.endedBy),
            reason: decision.endReason,
          },
  };
}

/** Closes an open request without a decision, for example when withdrawn. */
export const withdraw = mutation({
  args: { requestId: v.id("reproductionRequests"), reason: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const request = await requireReproductionRequest(
      ctx,
      args.requestId,
      "prepare",
    );
    const userId = await requireUserId(ctx);
    requireOpen(request);
    const reason = requiredText(args.reason, "REASON_REQUIRED");
    const now = Date.now();
    await ctx.db.patch(request._id, {
      status: "withdrawn",
      updatedAt: now,
      closedAt: now,
      closedBy: userId,
      closeReason: reason,
    });
    await logRequestAction(
      ctx,
      request,
      userId,
      "reproduction_request_withdrawn",
      {
        reason,
      },
    );
    return null;
  },
});

const listItem = v.object({
  _id: v.id("reproductionRequests"),
  requestNumber: v.string(),
  status: reproductionStatus,
  purpose: reproductionPurpose,
  requesterName: v.string(),
  objectLabel: v.string(),
  createdAt: v.number(),
  updatedAt: v.number(),
});

export const list = query({
  args: {
    organizationId: v.id("organizations"),
    status: v.optional(reproductionStatus),
    paginationOpts: paginationOptsValidator,
  },
  returns: paginationResultValidator(listItem),
  handler: async (ctx, args) => {
    await requireReproductionAccess(ctx, args.organizationId, "read");
    const { status } = args;
    const result = await (status
      ? ctx.db
          .query("reproductionRequests")
          .withIndex("by_organization_and_status_and_createdAt", (q) =>
            q.eq("organizationId", args.organizationId).eq("status", status),
          )
      : ctx.db
          .query("reproductionRequests")
          .withIndex("by_organization_and_createdAt", (q) =>
            q.eq("organizationId", args.organizationId),
          )
    )
      .order("desc")
      .paginate(args.paginationOpts);
    const page = await Promise.all(
      result.page.map(async (request) => {
        const object = await ctx.db.get(request.objectId);
        return {
          _id: request._id,
          requestNumber: request.requestNumber,
          status: request.status,
          purpose: request.purpose,
          requesterName: request.requesterName,
          objectLabel:
            object?.organizationId === request.organizationId
              ? objectLabel(object)
              : "",
          createdAt: request.createdAt,
          updatedAt: request.updatedAt,
        };
      }),
    );
    return { ...result, page };
  },
});

const EVIDENCE_LIMIT = 100;

async function userName(ctx: QueryCtx, userId: Id<"users"> | undefined) {
  if (!userId) return undefined;
  const user = await ctx.db.get(userId);
  return user?.name ?? user?.email ?? undefined;
}

async function evidenceView(
  ctx: QueryCtx,
  request: Doc<"reproductionRequests">,
) {
  const rows = await ctx.db
    .query("reproductionEvidence")
    .withIndex("by_requestId", (q) => q.eq("requestId", request._id))
    .take(EVIDENCE_LIMIT);
  return await Promise.all(
    rows.map(async (row) => {
      const document = row.documentMediaId
        ? await ctx.db.get(row.documentMediaId)
        : null;
      return {
        _id: row._id,
        kind: row.kind,
        summary: row.summary,
        document:
          document && document.organizationId === request.organizationId
            ? { _id: document._id, fileName: document.fileName }
            : undefined,
        recordedAt: row.recordedAt,
        recordedByName: await userName(ctx, row.recordedBy),
        retracted:
          row.retractedAt === undefined
            ? undefined
            : {
                at: row.retractedAt,
                byName: await userName(ctx, row.retractedBy),
                reason: row.retractionReason ?? "",
              },
      };
    }),
  );
}

const evidenceItem = v.object({
  _id: v.id("reproductionEvidence"),
  kind: reproductionEvidenceKind,
  summary: v.string(),
  document: v.optional(
    v.object({ _id: v.id("mediaFiles"), fileName: v.string() }),
  ),
  recordedAt: v.number(),
  recordedByName: v.optional(v.string()),
  retracted: v.optional(
    v.object({
      at: v.number(),
      byName: v.optional(v.string()),
      reason: v.string(),
    }),
  ),
});

const requestView = v.object({
  _id: v.id("reproductionRequests"),
  organizationId: v.id("organizations"),
  requestNumber: v.string(),
  status: reproductionStatus,
  purpose: reproductionPurpose,
  purposeDetails: v.string(),
  requesterLocale: reproductionLocale,
  createdAt: v.number(),
  updatedAt: v.number(),
  closedAt: v.optional(v.number()),
  closeReason: v.optional(v.string()),
  requester: v.object({
    accountId: v.id("accounts"),
    name: v.string(),
    email: v.string(),
  }),
  object: v.object({
    _id: v.id("collections"),
    label: v.string(),
    available: v.boolean(),
  }),
  media: v.object({
    _id: v.id("mediaFiles"),
    fileName: v.string(),
    available: v.boolean(),
    sourceVerified: v.boolean(),
    rightsStatus: v.optional(v.string()),
    licenseType: v.optional(v.string()),
    licenseExpiry: v.optional(v.number()),
    rightsHolder: v.optional(v.string()),
    copyright: v.optional(v.string()),
    usageRestrictions: v.optional(v.string()),
  }),
});

export const get = query({
  args: { requestId: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      request: requestView,
      evidence: v.array(evidenceItem),
      derivatives: v.array(derivativeItem),
      decision: v.union(decisionItem, v.null()),
      deliveries: v.array(deliveryItem),
      downloads: v.array(downloadItem),
      latestTerms: v.union(
        v.null(),
        v.object({
          _id: v.id("reproductionTerms"),
          version: v.number(),
          title: v.string(),
        }),
      ),
      emailAvailable: v.boolean(),
      commands: v.object({ canPrepare: v.boolean(), canDecide: v.boolean() }),
    }),
  ),
  handler: async (ctx, args) => {
    const requestId = ctx.db.normalizeId(
      "reproductionRequests",
      args.requestId,
    );
    const request = requestId ? await ctx.db.get(requestId) : null;
    if (
      !request ||
      !(await getCurrentUserOrganization(ctx, request.organizationId))
    )
      return null;
    await requireReproductionAccess(ctx, request.organizationId, "read");
    const [object, media] = await Promise.all([
      ctx.db.get(request.objectId),
      ctx.db.get(request.mediaId),
    ]);
    const mediaInOrganization =
      media?.organizationId === request.organizationId ? media : null;
    return {
      request: {
        _id: request._id,
        organizationId: request.organizationId,
        requestNumber: request.requestNumber,
        status: request.status,
        purpose: request.purpose,
        purposeDetails: request.purposeDetails,
        requesterLocale: request.requesterLocale,
        createdAt: request.createdAt,
        updatedAt: request.updatedAt,
        closedAt: request.closedAt,
        closeReason: request.closeReason,
        requester: {
          accountId: request.requesterAccountId,
          name: request.requesterName,
          email: request.requesterEmail,
        },
        object: {
          _id: request.objectId,
          label:
            object?.organizationId === request.organizationId
              ? objectLabel(object)
              : "",
          available:
            object?.organizationId === request.organizationId &&
            !isWithdrawnObject(object),
        },
        media: {
          _id: request.mediaId,
          fileName: mediaInOrganization?.fileName ?? "",
          available: mediaInOrganization !== null,
          sourceVerified: mediaInOrganization
            ? (await getPublicationSource(ctx, mediaInOrganization)) !== null
            : false,
          rightsStatus: mediaInOrganization?.rightsStatus,
          licenseType: mediaInOrganization?.licenseType,
          licenseExpiry: mediaInOrganization?.licenseExpiry,
          rightsHolder: mediaInOrganization?.rightsHolder,
          copyright: mediaInOrganization?.copyright,
          usageRestrictions: mediaInOrganization?.usageRestrictions,
        },
      },
      evidence: await evidenceView(ctx, request),
      derivatives: await derivativesView(ctx, request),
      decision: await decisionView(ctx, request),
      deliveries: await deliveriesView(ctx, request),
      downloads: await downloadsView(ctx, request),
      latestTerms: await latestTermsSummary(ctx, request.organizationId),
      emailAvailable: notificationEmailChannel().kind !== "unavailable",
      commands: await reproductionCommands(ctx, request.organizationId),
    };
  },
});
