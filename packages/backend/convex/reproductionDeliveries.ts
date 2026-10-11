import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { objectLabel } from "./utils/collectionDisplayHelpers";
import {
  attemptOutcome,
  claimStep,
  DELIVERY_SWEEP_GRACE_MS,
  resultStep,
} from "./utils/deliveryLedger";
import { internalMutation } from "./utils/mutationBuilders";
import { dispatchNotification } from "./utils/notificationDispatch";
import { notificationEmailChannel } from "./utils/notificationEmailChannel";
import {
  finishDeliveryWithoutSending,
  grantState,
  hashAccessToken,
  newAccessToken,
} from "./utils/reproductionDelivery";
import {
  downloadOutcome,
  reproductionDeliveryErrorCode,
  reproductionLocale,
} from "./utils/reproductionRequestValidators";

/** A run that starts before its delivery is due belongs to a later attempt. */
const EARLY_RUN_TOLERANCE_MS = 1_000;
const SWEEP_BATCH = 100;

const emailContent = v.object({
  organizationName: v.string(),
  requesterName: v.string(),
  requestNumber: v.string(),
  objectLabel: v.string(),
  termsTitle: v.string(),
  termsVersion: v.number(),
  termsBody: v.string(),
  expiresAt: v.number(),
});

/**
 * Claims attempt `attempt` of a pending delivery and returns the email to
 * send. A revoked or expired approval cancels the delivery; the first claim
 * of a series mints the download link the whole series sends.
 */
export const claimAttempt = internalMutation({
  args: { deliveryId: v.id("reproductionDeliveries"), attempt: v.number() },
  returns: v.union(
    v.object({ kind: v.literal("skip") }),
    v.object({
      kind: v.literal("send"),
      to: v.string(),
      locale: reproductionLocale,
      idempotencyKey: v.string(),
      token: v.string(),
      content: emailContent,
    }),
  ),
  handler: async (ctx, args) => {
    const delivery = await ctx.db.get(args.deliveryId);
    const now = Date.now();
    if (
      !delivery ||
      (delivery.nextAttemptAt ?? now) > now + EARLY_RUN_TOLERANCE_MS
    )
      return { kind: "skip" as const };
    const step = claimStep(delivery, args.attempt, now);
    if (step.kind === "stale") return { kind: "skip" as const };
    if (step.lostAttempt) {
      await ctx.db.insert("reproductionDeliveryAttempts", {
        organizationId: delivery.organizationId,
        deliveryId: delivery._id,
        ...step.lostAttempt,
      });
    }
    if (step.kind === "exhausted") {
      await finishDeliveryWithoutSending(
        ctx,
        delivery,
        "failed_transient",
        "attempt_lost",
      );
      await notifyDeliveryEnded(ctx, delivery);
      return { kind: "skip" as const };
    }
    const [request, decision, organization] = await Promise.all([
      ctx.db.get(delivery.requestId),
      ctx.db.get(delivery.decisionId),
      ctx.db.get(delivery.organizationId),
    ]);
    const approval = decision?.approval;
    if (
      !request ||
      !decision ||
      !approval ||
      !organization ||
      request.currentDecisionId !== decision._id ||
      grantState(decision, now) !== "active"
    ) {
      await finishDeliveryWithoutSending(
        ctx,
        delivery,
        "cancelled",
        "grant_inactive",
      );
      return { kind: "skip" as const };
    }
    if (notificationEmailChannel().kind === "unavailable") {
      await finishDeliveryWithoutSending(
        ctx,
        delivery,
        "cancelled",
        "channel_unavailable",
      );
      await notifyDeliveryEnded(ctx, delivery);
      return { kind: "skip" as const };
    }
    let token = delivery.pendingToken;
    let accessLinkId = delivery.accessLinkId;
    if (!token) {
      token = newAccessToken();
      accessLinkId = await ctx.db.insert("reproductionAccessLinks", {
        organizationId: delivery.organizationId,
        requestId: request._id,
        decisionId: decision._id,
        deliveryId: delivery._id,
        tokenHash: await hashAccessToken(token),
        createdAt: now,
      });
    }
    await ctx.db.patch(delivery._id, {
      ...step.patch,
      pendingToken: token,
      accessLinkId,
    });
    const object = await ctx.db.get(request.objectId);
    return {
      kind: "send" as const,
      to: delivery.recipientEmail,
      locale: delivery.locale,
      idempotencyKey: `${delivery._id}:${delivery.seriesStartAttempt}`,
      token,
      content: {
        organizationName: organization.name,
        requesterName: request.requesterName,
        requestNumber: request.requestNumber,
        objectLabel:
          object?.organizationId === request.organizationId
            ? objectLabel(object)
            : "",
        termsTitle: approval.termsTitle,
        termsVersion: approval.termsVersion,
        termsBody: approval.termsBody,
        expiresAt: approval.expiresAt,
      },
    };
  },
});

/** Tells the approver that their approval's email was not delivered. */
async function notifyDeliveryEnded(
  ctx: MutationCtx,
  delivery: Doc<"reproductionDeliveries">,
) {
  const [request, decision] = await Promise.all([
    ctx.db.get(delivery.requestId),
    ctx.db.get(delivery.decisionId),
  ]);
  if (!request || !decision) return;
  await dispatchNotification(ctx, {
    organizationId: delivery.organizationId,
    type: "reproduction_delivery_failed",
    recipients: [decision.decidedBy],
    title: "Licensed image not delivered",
    message: `The email for request ${request.requestNumber} could not be delivered.`,
    related: { entityType: "reproductionRequest", entityId: request._id },
    idempotencyKey: `reproduction-delivery:${delivery._id}:${delivery.seriesStartAttempt}`,
  });
}

/** Stores the result of the attempt in flight; retries with backoff. */
export const recordAttemptResult = internalMutation({
  args: {
    deliveryId: v.id("reproductionDeliveries"),
    attempt: v.number(),
    startedAt: v.number(),
    durationMs: v.number(),
    outcome: attemptOutcome,
    responseStatus: v.optional(v.number()),
    errorCode: v.optional(reproductionDeliveryErrorCode),
    providerMessageId: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const delivery = await ctx.db.get(args.deliveryId);
    if (!delivery) return null;
    const step = resultStep(delivery, args, Date.now());
    if (step.kind === "stale") return null;
    await ctx.db.insert("reproductionDeliveryAttempts", {
      organizationId: delivery.organizationId,
      deliveryId: delivery._id,
      attemptNumber: args.attempt,
      startedAt: args.startedAt,
      durationMs: args.durationMs,
      outcome: args.outcome,
      responseStatus: args.responseStatus,
      errorCode: args.errorCode,
    });
    await ctx.db.patch(delivery._id, {
      ...step.patch,
      lastErrorCode: args.errorCode,
      providerMessageId: args.providerMessageId,
      ...(step.kind === "finish" ? { pendingToken: undefined } : {}),
    });
    if (step.kind === "retry") {
      await ctx.scheduler.runAt(
        step.nextAttemptAt,
        internal.reproductionDeliveriesActions.attemptDelivery,
        { deliveryId: delivery._id, attempt: delivery.attemptCount + 1 },
      );
    } else if (step.patch.status !== "succeeded") {
      await notifyDeliveryEnded(ctx, delivery);
    }
    return null;
  },
});

/**
 * Cron entry point: reschedules pending deliveries whose attempt is overdue
 * (a lost scheduled run or an expired in-flight lease).
 */
export const sweep = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const now = Date.now();
    const overdue = await ctx.db
      .query("reproductionDeliveries")
      .withIndex("by_status_and_nextAttemptAt", (q) =>
        q
          .eq("status", "pending")
          .lte("nextAttemptAt", now - DELIVERY_SWEEP_GRACE_MS),
      )
      .take(SWEEP_BATCH);
    for (const delivery of overdue) {
      await ctx.db.patch(delivery._id, { nextAttemptAt: now });
      await ctx.scheduler.runAfter(
        0,
        internal.reproductionDeliveriesActions.attemptDelivery,
        { deliveryId: delivery._id, attempt: delivery.attemptCount + 1 },
      );
    }
    return null;
  },
});

/**
 * Resolves a download link and records the request as a use record. Unknown
 * links record nothing. Only a ready Licensed derivative owned by the
 * request's organization is ever served.
 */
export const openDownload = internalMutation({
  args: { tokenHash: v.string() },
  returns: v.union(
    v.object({ kind: v.literal("not_found") }),
    v.object({ kind: v.literal("refused"), outcome: downloadOutcome }),
    v.object({
      kind: v.literal("serve"),
      storageId: v.id("_storage"),
      fileName: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    const link = await ctx.db
      .query("reproductionAccessLinks")
      .withIndex("by_tokenHash", (q) => q.eq("tokenHash", args.tokenHash))
      .unique();
    if (!link) return { kind: "not_found" as const };
    const [request, decision] = await Promise.all([
      ctx.db.get(link.requestId),
      ctx.db.get(link.decisionId),
    ]);
    if (!request || !decision) return { kind: "not_found" as const };
    const now = Date.now();
    const record = async (
      outcome: Doc<"reproductionDownloads">["outcome"],
      byteSize?: number,
    ) =>
      await ctx.db.insert("reproductionDownloads", {
        organizationId: link.organizationId,
        requestId: link.requestId,
        decisionId: link.decisionId,
        accessLinkId: link._id,
        at: now,
        outcome,
        byteSize,
      });
    const grant =
      request.currentDecisionId === decision._id
        ? grantState(decision, now)
        : "revoked";
    if (grant !== "active") {
      const outcome =
        grant === "expired"
          ? ("refused_expired" as const)
          : ("refused_revoked" as const);
      await record(outcome);
      return { kind: "refused" as const, outcome };
    }
    const derivativeId = decision.approval?.derivativeId;
    const derivative = derivativeId ? await ctx.db.get(derivativeId) : null;
    const storageId = derivative?.storageId;
    const [blob, ownership] = storageId
      ? await Promise.all([
          ctx.db.system.get(storageId),
          ctx.db
            .query("storageOwnership")
            .withIndex("by_storageId", (q) => q.eq("storageId", storageId))
            .unique(),
        ])
      : [null, null];
    if (
      !derivative ||
      !storageId ||
      derivative.status !== "ready" ||
      storageId === derivative.sourceStorageId ||
      !blob ||
      ownership?.organizationId !== link.organizationId ||
      ownership.ownerType !== "reproductionDerivative" ||
      ownership.ownerId !== derivative._id
    ) {
      await record("refused_unavailable");
      return {
        kind: "refused" as const,
        outcome: "refused_unavailable" as const,
      };
    }
    await record("served", blob.size);
    return {
      kind: "serve" as const,
      storageId,
      fileName: `${request.requestNumber}.jpg`,
    };
  },
});
