import { defineTable } from "convex/server";
import { type Infer, v } from "convex/values";
import {
  deliveryAttemptLedgerFields,
  deliveryLedgerFields,
} from "./deliveryLedger";

export const REPRODUCTION_PURPOSES = [
  "private_study",
  "academic_research",
  "academic_publication",
  "commercial_publication",
  "exhibition",
  "broadcast",
  "online",
  "other",
] as const;
export const reproductionPurpose = v.union(
  ...REPRODUCTION_PURPOSES.map((purpose) => v.literal(purpose)),
);
export type ReproductionPurpose = Infer<typeof reproductionPurpose>;

/**
 * `open` collects evidence and prepares the derivative. A decision makes it
 * `approved` or `refused`; staff may close an open request as `withdrawn`.
 * An approved request ends `expired` at the end of its term or `revoked`.
 */
export const REPRODUCTION_STATUSES = [
  "open",
  "approved",
  "refused",
  "withdrawn",
  "expired",
  "revoked",
] as const;
export const reproductionStatus = v.union(
  ...REPRODUCTION_STATUSES.map((status) => v.literal(status)),
);
export type ReproductionStatus = Infer<typeof reproductionStatus>;

export const REPRODUCTION_EVIDENCE_KINDS = [
  "rights_holder_permission",
  "license",
  "public_domain_assessment",
  "institutional_ownership",
  "donor_agreement",
  "other",
] as const;
export const reproductionEvidenceKind = v.union(
  ...REPRODUCTION_EVIDENCE_KINDS.map((kind) => v.literal(kind)),
);

export const REPRODUCTION_LOCALES = ["en", "fr", "es", "no", "ro"] as const;
export const reproductionLocale = v.union(
  ...REPRODUCTION_LOCALES.map((locale) => v.literal(locale)),
);

/** Longest edge, in pixels, a Licensed copy may have. */
export const DERIVATIVE_SIZES = [1200, 2400, 4000] as const;
export const derivativeSize = v.union(
  ...DERIVATIVE_SIZES.map((size) => v.literal(size)),
);

/** Why a delivery or a download was refused without sending a file. */
export const reproductionDeliveryErrorCode = v.union(
  v.literal("http_error"),
  v.literal("timeout"),
  v.literal("network_error"),
  v.literal("attempt_lost"),
  v.literal("channel_unavailable"),
  v.literal("grant_inactive"),
);
export type ReproductionDeliveryErrorCode = Infer<
  typeof reproductionDeliveryErrorCode
>;

export const downloadOutcome = v.union(
  v.literal("served"),
  v.literal("refused_expired"),
  v.literal("refused_revoked"),
  v.literal("refused_unavailable"),
);
export type DownloadOutcome = Infer<typeof downloadOutcome>;

/** The image's recorded rights when the decision was made. */
export const rightsSnapshot = v.object({
  rightsStatus: v.optional(v.string()),
  licenseType: v.optional(v.string()),
  licenseExpiry: v.optional(v.number()),
  rightsHolder: v.optional(v.string()),
  copyright: v.optional(v.string()),
  usageRestrictions: v.optional(v.string()),
  acknowledgmentText: v.optional(v.string()),
});

/**
 * Tables of research and reproduction requests (ADR 0016). Spread into the
 * schema so the module's storage stays together.
 */
export const reproductionRequestTables = {
  reproductionRequests: defineTable({
    organizationId: v.id("organizations"),
    requestNumber: v.string(),
    objectId: v.id("collections"),
    mediaId: v.id("mediaFiles"),
    requesterAccountId: v.id("accounts"),
    /** The Party's name and address as recorded at intake; never rewritten. */
    requesterName: v.string(),
    requesterEmail: v.string(),
    requesterLocale: reproductionLocale,
    purpose: reproductionPurpose,
    purposeDetails: v.string(),
    status: reproductionStatus,
    currentDecisionId: v.optional(v.id("reproductionDecisions")),
    createdBy: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
    closedAt: v.optional(v.number()),
    closedBy: v.optional(v.id("users")),
    closeReason: v.optional(v.string()),
  })
    .index("by_organization_and_status_and_createdAt", [
      "organizationId",
      "status",
      "createdAt",
    ])
    .index("by_organization_and_createdAt", ["organizationId", "createdAt"])
    .index("by_mediaId", ["mediaId"]),

  reproductionRequestCounters: defineTable({
    organizationId: v.id("organizations"),
    year: v.number(),
    currentValue: v.number(),
    lastGeneratedAt: v.number(),
  }).index("by_organization_and_year", ["organizationId", "year"]),

  /** Append-only rights evidence; a retraction keeps the entry. */
  reproductionEvidence: defineTable({
    organizationId: v.id("organizations"),
    requestId: v.id("reproductionRequests"),
    kind: reproductionEvidenceKind,
    summary: v.string(),
    /** A private document of the same Object that holds the evidence. */
    documentMediaId: v.optional(v.id("mediaFiles")),
    recordedBy: v.id("users"),
    recordedAt: v.number(),
    retractedAt: v.optional(v.number()),
    retractedBy: v.optional(v.id("users")),
    retractionReason: v.optional(v.string()),
  }).index("by_requestId", ["requestId"]),

  /** A request-specific copy of the image; the original is never sent. */
  reproductionDerivatives: defineTable({
    organizationId: v.id("organizations"),
    requestId: v.id("reproductionRequests"),
    mediaId: v.id("mediaFiles"),
    jobId: v.string(),
    sourceStorageId: v.id("_storage"),
    versionId: v.optional(v.id("mediaVersions")),
    maxDimension: derivativeSize,
    status: v.union(
      v.literal("processing"),
      v.literal("ready"),
      v.literal("failed"),
    ),
    storageId: v.optional(v.id("_storage")),
    width: v.optional(v.number()),
    height: v.optional(v.number()),
    byteSize: v.optional(v.number()),
    createdBy: v.id("users"),
    createdAt: v.number(),
    completedAt: v.optional(v.number()),
  }).index("by_requestId", ["requestId"]),

  /** Each published text is a new version; decisions keep the one they used. */
  reproductionTerms: defineTable({
    organizationId: v.id("organizations"),
    version: v.number(),
    title: v.string(),
    body: v.string(),
    publishedBy: v.id("users"),
    publishedAt: v.number(),
  }).index("by_organization_and_version", ["organizationId", "version"]),

  reproductionDecisions: defineTable({
    organizationId: v.id("organizations"),
    requestId: v.id("reproductionRequests"),
    outcome: v.union(v.literal("approved"), v.literal("refused")),
    reason: v.optional(v.string()),
    decidedBy: v.id("users"),
    decidedAt: v.number(),
    rights: rightsSnapshot,
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
    endedAt: v.optional(v.number()),
    endedBy: v.optional(v.id("users")),
    endReason: v.optional(v.string()),
  }).index("by_requestId", ["requestId"]),

  /** Email of the approved derivative's link to the requester (ADR 0004 ledger). */
  reproductionDeliveries: defineTable({
    organizationId: v.id("organizations"),
    requestId: v.id("reproductionRequests"),
    decisionId: v.id("reproductionDecisions"),
    recipientEmail: v.string(),
    locale: reproductionLocale,
    ...deliveryLedgerFields,
    createdBy: v.id("users"),
    lastErrorCode: v.optional(reproductionDeliveryErrorCode),
    providerMessageId: v.optional(v.string()),
    /**
     * The current series' download link, kept only while the series may
     * still send it so a resent attempt carries the same email.
     */
    pendingToken: v.optional(v.string()),
    accessLinkId: v.optional(v.id("reproductionAccessLinks")),
  })
    .index("by_requestId", ["requestId"])
    .index("by_status_and_nextAttemptAt", ["status", "nextAttemptAt"]),

  reproductionDeliveryAttempts: defineTable({
    organizationId: v.id("organizations"),
    deliveryId: v.id("reproductionDeliveries"),
    ...deliveryAttemptLedgerFields,
    errorCode: v.optional(reproductionDeliveryErrorCode),
  }).index("by_deliveryId_and_attemptNumber", ["deliveryId", "attemptNumber"]),

  /** One download link per delivery series; only its hash is kept. */
  reproductionAccessLinks: defineTable({
    organizationId: v.id("organizations"),
    requestId: v.id("reproductionRequests"),
    decisionId: v.id("reproductionDecisions"),
    deliveryId: v.id("reproductionDeliveries"),
    tokenHash: v.string(),
    createdAt: v.number(),
  }).index("by_tokenHash", ["tokenHash"]),

  /** Use record: every request of a valid link, served or refused. */
  reproductionDownloads: defineTable({
    organizationId: v.id("organizations"),
    requestId: v.id("reproductionRequests"),
    decisionId: v.id("reproductionDecisions"),
    accessLinkId: v.id("reproductionAccessLinks"),
    at: v.number(),
    outcome: downloadOutcome,
    byteSize: v.optional(v.number()),
  }).index("by_requestId_and_at", ["requestId", "at"]),
};
