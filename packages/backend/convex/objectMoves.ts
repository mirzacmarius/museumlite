import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { type MutationCtx, type QueryCtx, query } from "./_generated/server";
import { NOTIFICATION_TYPES } from "./notifications";
import { getNextCounterValue } from "./utils/accessionCounter";
import { accessionParser } from "./utils/accessionNumberParser";
import { batchGetByIds } from "./utils/batchLookup";
import { moveCollectionDetailRecords } from "./utils/collectionDetailLifecycle";
import { getExhibitionsForObject } from "./utils/exhibitionParticipation";
import { buildUpdatedAccessionState } from "./utils/identifierHistory";
import {
  assertObservedSourceLocationMatches,
  buildTransferScopeSnapshot,
  moveConditionAssessmentRecords,
  recordTargetTransferArrival,
  recordTransferCustodyEvent,
  requireTargetTransferLocation,
} from "./utils/institutionTransferEvidence";
import { mutation } from "./utils/mutationBuilders";
import { isUnaccessionedEntryObject } from "./utils/objectEntryLifecycle";
import {
  getCurrentUserOrganization,
  hasPermission,
  requirePermission,
} from "./utils/permissions";

const accessionModeValidator = v.union(
  v.literal("keep"),
  v.literal("auto"),
  v.literal("manual"),
);

const requestStatusValidator = v.union(
  v.literal("pending_source_approval"),
  v.literal("approved_for_transfer"),
  v.literal("awaiting_acceptance"),
  v.literal("pending"),
  v.literal("executed"),
  v.literal("rejected"),
  v.literal("cancelled"),
);

const blockerValidator = v.object({
  code: v.string(),
  message: v.string(),
});

const organizationMoveRequestSummaryValidator = v.object({
  _id: v.id("organizationMoveRequests"),
  collectionId: v.id("collections"),
  collectionTitle: v.string(),
  sourceAccessionNumber: v.string(),
  finalAccessionNumber: v.optional(v.string()),
  requestedAccessionNumber: v.optional(v.string()),
  accessionMode: accessionModeValidator,
  targetOrganizationId: v.id("organizations"),
  targetOrganizationName: v.string(),
  reason: v.string(),
  notes: v.optional(v.string()),
  status: requestStatusValidator,
  requestedBy: v.id("users"),
  requestedByName: v.string(),
  requestedAt: v.number(),
  reviewedByName: v.optional(v.string()),
  reviewedAt: v.optional(v.number()),
  reviewNotes: v.optional(v.string()),
  sourceReviewedByName: v.optional(v.string()),
  sourceReviewedAt: v.optional(v.number()),
  sourceReviewNotes: v.optional(v.string()),
  targetReviewedByName: v.optional(v.string()),
  targetReviewedAt: v.optional(v.number()),
  targetReviewNotes: v.optional(v.string()),
  deaccessionId: v.optional(v.id("deaccessions")),
  direction: v.union(v.literal("outgoing"), v.literal("incoming")),
});

const ACTIVE_LOAN_STATUSES = new Set(["active", "dispatched"]);
const ACTIVE_TRANSIT_STATUSES = new Set([
  "draft",
  "scheduled",
  "in_transit",
  "out_for_delivery",
  "delayed",
  "held",
]);
const ACTIVE_EXHIBITION_STATUSES = new Set([
  "proposed",
  "approved",
  "installing",
  "active",
  "deinstalling",
]);
const BLOCKING_COVERAGE_STATUSES = new Set(["active", "pending"]);
const BLOCKING_LOCATION_MOVE_STATUSES = new Set(["pending", "approved"]);

type MoveBlocker = {
  code: string;
  message: string;
};

type RequestStatus =
  | "pending_source_approval"
  | "approved_for_transfer"
  | "awaiting_acceptance"
  | "pending"
  | "executed"
  | "rejected"
  | "cancelled";

type EligibilityCheckOptions = {
  ignoreRequestId?: Id<"organizationMoveRequests">;
  ignoreDeaccessionId?: Id<"deaccessions">;
};

const ACTIVE_REQUEST_STATUSES = new Set([
  "pending",
  "pending_source_approval",
  "approved_for_transfer",
  "awaiting_acceptance",
]);

function normalizeRequestStatus(status: RequestStatus): RequestStatus {
  return status === "pending" ? "pending_source_approval" : status;
}

function getEffectiveRootOrganizationId(organization: {
  _id: Id<"organizations">;
  rootOrganizationId?: Id<"organizations">;
}) {
  return organization.rootOrganizationId ?? organization._id;
}

async function getTransferHierarchy(
  ctx: QueryCtx | MutationCtx,
  sourceOrganizationId: Id<"organizations">,
  targetOrganizationId: Id<"organizations">,
) {
  const [sourceOrganization, targetOrganization] = await Promise.all([
    ctx.db.get(sourceOrganizationId),
    ctx.db.get(targetOrganizationId),
  ] as const);
  if (!sourceOrganization || !targetOrganization) {
    throw new Error("Organization not found");
  }

  const sourceRootId = getEffectiveRootOrganizationId(sourceOrganization);
  const targetRootId = getEffectiveRootOrganizationId(targetOrganization);
  if (sourceRootId !== targetRootId) {
    throw new Error(
      "Objects can only be transferred between organizations in the same hierarchy.",
    );
  }

  const rootOrganization = await ctx.db.get(sourceRootId);
  if (!rootOrganization) {
    throw new Error("Root organization not found");
  }

  const rootTier = rootOrganization.subscriptionTier ?? "free";
  if (rootTier !== "pro" && rootTier !== "enterprise") {
    throw new Error("Hierarchical transfers require a Pro or Enterprise plan.");
  }

  return {
    sourceOrganization,
    targetOrganization,
    rootOrganization,
  };
}

function organizationAllowsIncomingTransfers(organization: {
  allowsIncomingTransferRequests?: boolean;
  settings?: { allowIncomingTransferRequests?: boolean };
}) {
  return (
    organization.allowsIncomingTransferRequests === true ||
    organization.settings?.allowIncomingTransferRequests === true
  );
}

async function isPublicTransferDestination(
  ctx: QueryCtx | MutationCtx,
  sourceOrganizationId: Id<"organizations">,
  targetOrganizationId: Id<"organizations">,
) {
  if (sourceOrganizationId === targetOrganizationId) {
    return false;
  }

  const targetOrganization = await ctx.db.get(targetOrganizationId);
  if (!targetOrganization) {
    return false;
  }

  return organizationAllowsIncomingTransfers(targetOrganization);
}

const transferDestinationSummaryValidator = v.object({
  _id: v.id("organizations"),
  name: v.string(),
  slug: v.string(),
  accountNumber: v.optional(v.string()),
  roleName: v.optional(v.string()),
  source: v.union(v.literal("membership"), v.literal("public")),
});

const transferDestinationLookupValidator = v.union(
  v.object({
    status: v.literal("valid"),
    organization: transferDestinationSummaryValidator,
  }),
  v.object({
    status: v.literal("invalid"),
    message: v.string(),
  }),
);

async function generateAccessionNumber(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
): Promise<string> {
  const org = await ctx.db.get(organizationId);
  if (!org) {
    throw new Error("Organization not found");
  }

  const template = org.settings?.accessionNumberFormat;
  const autoGenerate = org.settings?.autoGenerateAccessionNumbers ?? false;

  if (!autoGenerate) {
    throw new Error(
      "Auto-generate accession numbers is disabled for the destination organization.",
    );
  }

  if (!template) {
    throw new Error(
      "The destination organization does not have an accession number format configured.",
    );
  }

  const now = new Date();
  const counterScope =
    org.settings?.accessionCounterScope ||
    accessionParser.getCounterScopeFromTemplate(template);
  const scopeKey = accessionParser.getScopeKey(counterScope, now);

  const counterValue = await getNextCounterValue(
    ctx,
    organizationId,
    counterScope,
    scopeKey,
  );

  return accessionParser.parse(template, {
    organizationSlug: org.slug,
    currentDate: now,
    counterValue,
    counterScope,
  });
}

async function findAccessionConflict(
  ctx: QueryCtx | MutationCtx,
  organizationId: Id<"organizations">,
  accessionNumber: string,
) {
  const primaryConflict = await ctx.db
    .query("collections")
    .withIndex("by_organization_and_accessionNumber", (q) =>
      q
        .eq("organizationId", organizationId)
        .eq("accessionNumber", accessionNumber),
    )
    .first();

  if (primaryConflict) {
    return primaryConflict;
  }

  const collections = await ctx.db
    .query("collections")
    .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
    .collect();

  return (
    collections.find((collection) =>
      collection.alternateAccessionNumbers?.includes(accessionNumber),
    ) ?? null
  );
}

async function ensureAccessionNumberAvailable(
  ctx: QueryCtx | MutationCtx,
  organizationId: Id<"organizations">,
  accessionNumber: string,
) {
  const conflict = await findAccessionConflict(
    ctx,
    organizationId,
    accessionNumber,
  );
  if (conflict) {
    throw new Error(
      `Accession number "${accessionNumber}" already exists in the destination organization`,
    );
  }
}

async function resolveGeneratedAccessionNumberAttempt(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
  attempt: number,
): Promise<string | null> {
  if (attempt >= 5) {
    return null;
  }

  const accessionNumber = await generateAccessionNumber(ctx, organizationId);
  const conflict = await findAccessionConflict(
    ctx,
    organizationId,
    accessionNumber,
  );
  if (!conflict) {
    return accessionNumber;
  }

  return resolveGeneratedAccessionNumberAttempt(
    ctx,
    organizationId,
    attempt + 1,
  );
}

async function resolveGeneratedAccessionNumber(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
) {
  const accessionNumber = await resolveGeneratedAccessionNumberAttempt(
    ctx,
    organizationId,
    0,
  );
  if (accessionNumber) {
    return accessionNumber;
  }

  throw new Error(
    "Unable to generate a unique accession number for the destination organization.",
  );
}

async function buildEligibilityBlockers(
  ctx: QueryCtx | MutationCtx,
  collection: {
    _id: Id<"collections">;
    organizationId: Id<"organizations">;
    status: string;
    parentObjectId?: Id<"collections">;
  },
  targetOrganizationId?: Id<"organizations">,
  options: EligibilityCheckOptions = {},
): Promise<MoveBlocker[]> {
  const blockers: MoveBlocker[] = [];

  if (collection.status !== "active") {
    blockers.push({
      code: "status_not_active",
      message: "Only active objects can be moved to another organization.",
    });
  }

  if (
    targetOrganizationId !== undefined &&
    targetOrganizationId === collection.organizationId
  ) {
    blockers.push({
      code: "same_organization",
      message:
        "The destination organization must be different from the current organization.",
    });
  }

  const loanItems = await ctx.db
    .query("loanItems")
    .withIndex("by_collection", (q) => q.eq("collectionId", collection._id))
    .collect();

  const loans = await batchGetByIds(
    ctx,
    loanItems.map((loanItem) => loanItem.loanId),
    "loans",
  );
  if (
    loans.some((loan) => loan !== null && ACTIVE_LOAN_STATUSES.has(loan.status))
  ) {
    blockers.push({
      code: "active_loan",
      message: "This object is currently on loan and cannot be moved.",
    });
  }

  const locationMoveRequests = await ctx.db
    .query("locationMoveRequests")
    .withIndex("by_collection", (q) => q.eq("collectionId", collection._id))
    .collect();

  if (
    locationMoveRequests.some((request) =>
      BLOCKING_LOCATION_MOVE_STATUSES.has(request.status),
    )
  ) {
    blockers.push({
      code: "pending_location_move",
      message: "This object already has a pending location move request.",
    });
  }

  const moveRequests = await ctx.db
    .query("organizationMoveRequests")
    .withIndex("by_collection", (q) => q.eq("collectionId", collection._id))
    .collect();

  if (
    moveRequests.some(
      (request) =>
        ACTIVE_REQUEST_STATUSES.has(request.status) &&
        request._id !== options.ignoreRequestId,
    )
  ) {
    blockers.push({
      code: "pending_organization_move",
      message: "This object already has a pending organization move request.",
    });
  }

  if (await isUnaccessionedEntryObject(ctx, collection._id)) {
    blockers.push({
      code: "temporary_custody",
      message:
        "This object is held under a temporary entry and is not part of the collection.",
    });
  }

  if (collection.parentObjectId) {
    blockers.push({
      code: "has_parent_object",
      message:
        "Objects linked to a parent object must be unlinked before they can be moved.",
    });
  }

  const childObjects = await ctx.db
    .query("collections")
    .withIndex("by_parentObject", (q) => q.eq("parentObjectId", collection._id))
    .collect();

  if (childObjects.length > 0) {
    blockers.push({
      code: "has_child_objects",
      message:
        "Objects with child objects must be unlinked before they can be moved.",
    });
  }

  const transitItems = await ctx.db
    .query("transitItems")
    .withIndex("by_collection", (q) => q.eq("collectionId", collection._id))
    .collect();

  const transitRecords = await batchGetByIds(
    ctx,
    transitItems.map((transitItem) => transitItem.transitRecordId),
    "transitRecords",
  );
  if (
    transitRecords.some(
      (transitRecord) =>
        transitRecord !== null &&
        ACTIVE_TRANSIT_STATUSES.has(transitRecord.status),
    )
  ) {
    blockers.push({
      code: "active_transit",
      message:
        "This object is part of an active transit record and cannot be moved.",
    });
  }

  const exhibitions = await getExhibitionsForObject(ctx, collection._id);

  if (
    exhibitions.some((exhibition) =>
      ACTIVE_EXHIBITION_STATUSES.has(exhibition.status ?? "proposed"),
    )
  ) {
    blockers.push({
      code: "active_exhibition",
      message:
        "This object is part of an active exhibition and cannot be moved.",
    });
  }

  const deaccessions = await ctx.db
    .query("deaccessions")
    .withIndex("by_collection", (q) => q.eq("collectionId", collection._id))
    .collect();

  const blockingDeaccessions = deaccessions.filter(
    (deaccession) => deaccession._id !== options.ignoreDeaccessionId,
  );
  if (blockingDeaccessions.length > 0) {
    blockers.push({
      code: "has_deaccessions",
      message:
        "Objects with deaccession records cannot be moved to another organization.",
    });
  }

  const insuranceCoverages = await ctx.db
    .query("insuranceCoverages")
    .withIndex("by_collection", (q) => q.eq("collectionId", collection._id))
    .collect();

  if (
    insuranceCoverages.some((coverage) =>
      BLOCKING_COVERAGE_STATUSES.has(coverage.status),
    )
  ) {
    blockers.push({
      code: "insurance_coverage",
      message:
        "This object has insurance coverage that must be resolved before it can be moved.",
    });
  }

  const insuranceClaims = await ctx.db
    .query("insuranceClaims")
    .withIndex("by_organization", (q) =>
      q.eq("organizationId", collection.organizationId),
    )
    .collect();

  if (
    insuranceClaims.some((claim) =>
      (claim.collectionIds ?? []).includes(collection._id),
    )
  ) {
    blockers.push({
      code: "insurance_claim",
      message:
        "This object is referenced by an insurance claim and cannot be moved.",
    });
  }

  return blockers;
}

async function moveCollectionGroupLinks(
  ctx: MutationCtx,
  collectionId: Id<"collections">,
) {
  const collectionGroupItems = await ctx.db
    .query("collectionGroupItems")
    .withIndex("by_collection", (q) => q.eq("collectionId", collectionId))
    .collect();

  const affectedGroupIds = new Set<Id<"collectionGroups">>();
  await Promise.all(
    Array.from(collectionGroupItems).map(async (item) => {
      affectedGroupIds.add(item.collectionGroupId);
      await ctx.db.delete(item._id);
    }),
  );

  await Promise.all(
    Array.from(affectedGroupIds).map(async (groupId) => {
      const group = await ctx.db.get(groupId);
      if (!group) {
        return;
      }

      await ctx.db.patch(groupId, {
        itemsCount: Math.max(0, (group.itemsCount ?? 0) - 1),
      });
    }),
  );
}

async function moveMediaRecords(
  ctx: MutationCtx,
  collectionId: Id<"collections">,
  targetOrganizationId: Id<"organizations">,
) {
  const mediaFiles = await ctx.db
    .query("mediaFiles")
    .withIndex("by_collection", (q) => q.eq("collectionId", collectionId))
    .collect();

  await Promise.all(
    Array.from(mediaFiles).map(async (mediaFile) => {
      const [, mediaVersions, editHistory, downloads] = await Promise.all([
        ctx.db.patch(mediaFile._id, {
          organizationId: targetOrganizationId,
        }),
        ctx.db
          .query("mediaVersions")
          .withIndex("by_original_media", (q) =>
            q.eq("originalMediaId", mediaFile._id),
          )
          .collect(),
        ctx.db
          .query("mediaEditHistory")
          .withIndex("by_media", (q) => q.eq("mediaId", mediaFile._id))
          .collect(),
        ctx.db
          .query("mediaDownloads")
          .withIndex("by_media", (q) => q.eq("mediaId", mediaFile._id))
          .collect(),
      ]);

      await Promise.all([
        ...mediaVersions.map((version) =>
          ctx.db.patch(version._id, {
            organizationId: targetOrganizationId,
          }),
        ),
        ...editHistory.map((historyEntry) =>
          ctx.db.patch(historyEntry._id, {
            organizationId: targetOrganizationId,
          }),
        ),
        ...downloads.map((download) =>
          ctx.db.patch(download._id, {
            organizationId: targetOrganizationId,
          }),
        ),
      ]);
    }),
  );
}

async function moveConservationRecords(
  ctx: MutationCtx,
  collectionId: Id<"collections">,
  targetOrganizationId: Id<"organizations">,
) {
  const [treatments, schedules, alerts] = await Promise.all([
    ctx.db
      .query("conservationTreatments")
      .withIndex("by_collection", (q) => q.eq("collectionId", collectionId))
      .collect(),
    ctx.db
      .query("assessmentSchedules")
      .withIndex("by_collection", (q) => q.eq("collectionId", collectionId))
      .collect(),
    ctx.db
      .query("conservationAlerts")
      .withIndex("by_collection", (q) => q.eq("collectionId", collectionId))
      .collect(),
  ]);

  const treatmentsWithAttachments = await Promise.all(
    treatments.map((treatment) =>
      ctx.db
        .query("conservationAttachments")
        .withIndex("by_treatment", (q) => q.eq("treatmentId", treatment._id))
        .collect()
        .then((attachments) => ({
          treatmentId: treatment._id,
          attachmentIds: attachments.map((attachment) => attachment._id),
        })),
    ),
  );

  await Promise.all([
    ...treatmentsWithAttachments.flatMap(({ treatmentId, attachmentIds }) => [
      ctx.db.patch(treatmentId, {
        organizationId: targetOrganizationId,
      }),
      ...attachmentIds.map((attachmentId) =>
        ctx.db.patch(attachmentId, {
          organizationId: targetOrganizationId,
        }),
      ),
    ]),
    ...schedules.map((schedule) =>
      ctx.db.patch(schedule._id, {
        organizationId: targetOrganizationId,
      }),
    ),
    ...alerts.map((alert) =>
      ctx.db.patch(alert._id, {
        organizationId: targetOrganizationId,
      }),
    ),
  ]);
}

async function executeMove(
  ctx: MutationCtx,
  collection: {
    _id: Id<"collections">;
    organizationId: Id<"organizations">;
    collectionGroupId?: Id<"collectionGroups">;
    accessionNumber: string;
    alternateAccessionNumbers?: string[];
    accessionNumberHistory?: Array<{
      number: string;
      validFrom: number;
      validTo?: number;
    }>;
  },
  targetOrganizationId: Id<"organizations">,
  nextAccessionNumber: string,
  executedBy: Id<"users">,
) {
  const now = Date.now();

  const accessionState = buildUpdatedAccessionState(
    collection,
    nextAccessionNumber,
    now,
  );
  await Promise.all([
    moveCollectionGroupLinks(ctx, collection._id),
    moveMediaRecords(ctx, collection._id, targetOrganizationId),
    moveCollectionDetailRecords(ctx, collection._id, targetOrganizationId),
    moveConservationRecords(ctx, collection._id, targetOrganizationId),
    moveConditionAssessmentRecords(ctx, collection._id, targetOrganizationId),
  ]);
  const [comments, appraisals] = await Promise.all([
    ctx.db
      .query("objectComments")
      .withIndex("by_object", (q) => q.eq("objectId", collection._id))
      .collect(),
    ctx.db
      .query("appraisals")
      .withIndex("by_collection", (q) => q.eq("collectionId", collection._id))
      .collect(),
  ]);

  await Promise.all([
    ...comments.map((comment) =>
      ctx.db.patch(comment._id, {
        organizationId: targetOrganizationId,
      }),
    ),
    ...appraisals.map((appraisal) =>
      ctx.db.patch(appraisal._id, {
        organizationId: targetOrganizationId,
      }),
    ),
  ]);

  await ctx.db.patch(collection._id, {
    organizationId: targetOrganizationId,
    collectionGroupId: undefined,
    currentLocationId: undefined,
    accessionNumber: accessionState.accessionNumber,
    alternateAccessionNumbers: accessionState.alternateAccessionNumbers,
    accessionNumberHistory: accessionState.accessionNumberHistory,
    lastModifiedBy: executedBy,
    lastModifiedAt: now,
  });
}

async function createApprovedTransferDeaccession(
  ctx: MutationCtx,
  request: {
    _id: Id<"organizationMoveRequests">;
    sourceOrganizationId: Id<"organizations">;
    targetOrganizationId: Id<"organizations">;
    collectionId: Id<"collections">;
    sourceAccessionNumber: string;
    reason: string;
    deaccessionId?: Id<"deaccessions">;
  },
  userId: Id<"users">,
) {
  if (request.deaccessionId) {
    return request.deaccessionId;
  }

  const [sourceOrganization, targetOrganization] = await Promise.all([
    ctx.db.get(request.sourceOrganizationId),
    ctx.db.get(request.targetOrganizationId),
  ] as const);
  if (!sourceOrganization || !targetOrganization) {
    throw new Error("Organization not found");
  }

  const now = Date.now();
  const deaccessionId = await ctx.db.insert("deaccessions", {
    organizationId: request.sourceOrganizationId,
    collectionId: request.collectionId,
    deaccessionNumber: `TR-${sourceOrganization.slug.toUpperCase().slice(0, 6)}-${now}`,
    dateDeaccessioned: now,
    reason: request.reason,
    method: "transfer",
    disposition: `Transfer to ${targetOrganization.name}`,
    approvedBy: userId,
    approvedAt: now,
    status: "approved",
    targetCollectionStatus: "deaccessioned",
    notes: `Created from transfer request for ${request.sourceAccessionNumber}.`,
    workflowHistory: [
      {
        step: 1,
        approvedBy: userId,
        approvedAt: now,
        comment: "Approved for transfer",
      },
    ],
  });

  await ctx.runMutation(internal.audit.logAction, {
    organizationId: request.sourceOrganizationId,
    userId,
    action: "created_transfer_deaccession",
    entityType: "deaccession",
    entityId: deaccessionId,
    changes: {
      requestId: request._id,
      targetOrganizationId: request.targetOrganizationId,
    },
  });

  return deaccessionId;
}

type TransferDestinationSummary = {
  _id: Id<"organizations">;
  name: string;
  slug: string;
  accountNumber?: string;
  roleName?: string;
  source: "membership" | "public";
};

async function listMembershipTransferTargets(
  ctx: QueryCtx,
  userId: Id<"users">,
  collection: Doc<"collections">,
): Promise<Array<TransferDestinationSummary>> {
  const memberships = await ctx.db
    .query("userOrganizations")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();

  const organizations = await Promise.all(
    memberships.map(async (membership) => {
      if (membership.organizationId === collection.organizationId) {
        return null;
      }

      const rolePermissions = await ctx.db
        .query("rolePermissions")
        .withIndex("by_role", (q) => q.eq("roleId", membership.roleId))
        .collect();

      const permissions = await Promise.all(
        rolePermissions.map((rolePermission) =>
          ctx.db.get(rolePermission.permissionId),
        ),
      );

      const canCreateCollections = permissions.some(
        (permission) => permission?.name === "collections.create",
      );

      if (!canCreateCollections) {
        return null;
      }

      const [organization, role] = await Promise.all([
        ctx.db.get(membership.organizationId),
        ctx.db.get(membership.roleId),
      ] as const);
      if (!organization) {
        return null;
      }

      try {
        await getTransferHierarchy(
          ctx,
          collection.organizationId,
          organization._id,
        );
      } catch {
        return null;
      }

      return {
        _id: organization._id,
        name: organization.name,
        slug: organization.slug,
        accountNumber: organization.accountNumber,
        roleName: role?.name,
        source: "membership" as const,
      };
    }),
  );

  const eligibleTargets: TransferDestinationSummary[] = [];
  for (const organization of organizations) {
    if (organization !== null) {
      eligibleTargets.push(organization);
    }
  }

  return eligibleTargets.sort((left, right) =>
    left.name.localeCompare(right.name),
  );
}

async function searchPublicTransferTargets(
  ctx: QueryCtx,
  sourceOrganizationId: Id<"organizations">,
  queryText: string,
): Promise<Array<TransferDestinationSummary>> {
  const normalizedQuery = queryText.trim();
  if (normalizedQuery.length < 2) {
    return [];
  }

  const orgAccountMatch = /^ORG-\d{5}$/i.exec(normalizedQuery);
  if (orgAccountMatch) {
    const organization = await ctx.db
      .query("organizations")
      .withIndex("by_accountNumber", (q) =>
        q.eq("accountNumber", normalizedQuery.toUpperCase()),
      )
      .first();

    if (
      organization &&
      organization._id !== sourceOrganizationId &&
      organizationAllowsIncomingTransfers(organization)
    ) {
      return [
        {
          _id: organization._id,
          name: organization.name,
          slug: organization.slug,
          accountNumber: organization.accountNumber,
          source: "public" as const,
        },
      ];
    }

    return [];
  }

  const searchResults = await ctx.db
    .query("organizations")
    .withSearchIndex("search_transfer_destinations", (q) =>
      q
        .search("name", normalizedQuery)
        .eq("allowsIncomingTransferRequests", true),
    )
    .take(20);

  const destinations: Array<TransferDestinationSummary> = [];
  for (const organization of searchResults) {
    if (organization._id === sourceOrganizationId) {
      continue;
    }
    destinations.push({
      _id: organization._id,
      name: organization.name,
      slug: organization.slug,
      accountNumber: organization.accountNumber,
      source: "public",
    });
  }
  return destinations;
}

export const searchTransferDestinations = query({
  args: {
    collectionId: v.id("collections"),
    query: v.string(),
  },
  returns: v.array(transferDestinationSummaryValidator),
  handler: async (ctx, args) => {
    const [userId, collection] = await Promise.all([
      getAuthUserId(ctx),
      ctx.db.get(args.collectionId),
    ] as const);
    if (!userId || !collection) {
      return [];
    }

    await requirePermission(
      ctx,
      collection.organizationId,
      "collections.update",
    );

    const trimmedQuery = args.query.trim();
    const membershipTargets =
      trimmedQuery.length === 0
        ? []
        : await listMembershipTransferTargets(ctx, userId, collection);

    const publicTargets =
      trimmedQuery.length >= 2
        ? await searchPublicTransferTargets(
            ctx,
            collection.organizationId,
            trimmedQuery,
          )
        : [];

    const merged = new Map<
      Id<"organizations">,
      {
        _id: Id<"organizations">;
        name: string;
        slug: string;
        accountNumber?: string;
        roleName?: string;
        source: "membership" | "public";
      }
    >();

    for (const target of membershipTargets) {
      if (
        target.name.toLowerCase().includes(trimmedQuery.toLowerCase()) ||
        target.accountNumber?.toLowerCase().includes(trimmedQuery.toLowerCase())
      ) {
        merged.set(target._id, target);
      }
    }

    for (const target of publicTargets) {
      merged.set(target._id, target);
    }

    return Array.from(merged.values()).sort((left, right) =>
      left.name.localeCompare(right.name),
    );
  },
});

export const lookupTransferDestinationByAccountNumber = query({
  args: {
    collectionId: v.id("collections"),
    accountNumber: v.string(),
  },
  returns: transferDestinationLookupValidator,
  handler: async (ctx, args) => {
    const collection = await ctx.db.get(args.collectionId);
    if (!collection) {
      return {
        status: "invalid" as const,
        message: "Object not found.",
      };
    }

    await requirePermission(
      ctx,
      collection.organizationId,
      "collections.update",
    );

    const normalizedAccountNumber = args.accountNumber.trim().toUpperCase();
    if (!/^ORG-\d{5}$/.test(normalizedAccountNumber)) {
      return {
        status: "invalid" as const,
        message: "Enter a valid organization account number (ORG-00000).",
      };
    }

    const organization = await ctx.db
      .query("organizations")
      .withIndex("by_accountNumber", (q) =>
        q.eq("accountNumber", normalizedAccountNumber),
      )
      .first();

    if (!organization) {
      return {
        status: "invalid" as const,
        message: "No organization found with this account number.",
      };
    }

    if (organization._id === collection.organizationId) {
      return {
        status: "invalid" as const,
        message: "You cannot transfer an object to its current organization.",
      };
    }

    if (!organizationAllowsIncomingTransfers(organization)) {
      return {
        status: "invalid" as const,
        message:
          "This organization is not accepting incoming transfer requests.",
      };
    }

    return {
      status: "valid" as const,
      organization: {
        _id: organization._id,
        name: organization.name,
        slug: organization.slug,
        accountNumber: organization.accountNumber,
        source: "public" as const,
      },
    };
  },
});

export const listEligibleTargetOrganizations = query({
  args: {
    collectionId: v.id("collections"),
  },
  returns: v.array(transferDestinationSummaryValidator),
  handler: async (ctx, args) => {
    const [userId, collection] = await Promise.all([
      getAuthUserId(ctx),
      ctx.db.get(args.collectionId),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    if (!collection) {
      return [];
    }

    await requirePermission(
      ctx,
      collection.organizationId,
      "collections.update",
    );
    return await listMembershipTransferTargets(ctx, userId, collection);
  },
});

export const getEligibility = query({
  args: {
    collectionId: v.id("collections"),
    targetOrganizationId: v.optional(v.id("organizations")),
  },
  returns: v.object({
    isEligible: v.boolean(),
    blockers: v.array(blockerValidator),
  }),
  handler: async (ctx, args) => {
    const collection = await ctx.db.get(args.collectionId);
    if (!collection) {
      return {
        isEligible: false,
        blockers: [
          {
            code: "collection_not_found",
            message: "Object not found.",
          },
        ],
      };
    }

    await requirePermission(
      ctx,
      collection.organizationId,
      "collections.update",
    );

    const blockers = await buildEligibilityBlockers(
      ctx,
      collection,
      args.targetOrganizationId,
    );

    if (args.targetOrganizationId) {
      const isPublicDestination = await isPublicTransferDestination(
        ctx,
        collection.organizationId,
        args.targetOrganizationId,
      );

      if (isPublicDestination) {
        const targetOrganization = await ctx.db.get(args.targetOrganizationId);
        if (
          !targetOrganization ||
          !organizationAllowsIncomingTransfers(targetOrganization)
        ) {
          blockers.push({
            code: "target_not_accepting_transfers",
            message:
              "This organization is not accepting incoming transfer requests.",
          });
        }
      } else {
        try {
          await getTransferHierarchy(
            ctx,
            collection.organizationId,
            args.targetOrganizationId,
          );
        } catch (error) {
          blockers.push({
            code: "target_not_in_hierarchy",
            message:
              error instanceof Error
                ? error.message
                : "Destination organization is not eligible for transfer.",
          });
        }

        const membership = await getCurrentUserOrganization(
          ctx,
          args.targetOrganizationId,
        );

        if (!membership) {
          blockers.push({
            code: "target_membership_required",
            message:
              "You must be a member of the destination organization to move an object there.",
          });
        } else {
          const canCreateInTarget = await hasPermission(
            ctx,
            args.targetOrganizationId,
            "collections.create",
          );

          if (!canCreateInTarget) {
            blockers.push({
              code: "target_create_permission_required",
              message:
                "You need collection creation permission in the destination organization.",
            });
          }
        }
      }
    }

    return {
      isEligible: blockers.length === 0,
      blockers,
    };
  },
});

export const createRequest = mutation({
  args: {
    collectionId: v.id("collections"),
    targetOrganizationId: v.id("organizations"),
    accessionMode: accessionModeValidator,
    requestedAccessionNumber: v.optional(v.string()),
    reason: v.string(),
    notes: v.optional(v.string()),
  },
  returns: v.id("organizationMoveRequests"),
  handler: async (ctx, args) => {
    const [userId, collection] = await Promise.all([
      getAuthUserId(ctx),
      ctx.db.get(args.collectionId),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    if (!collection) {
      throw new Error("Collection not found");
    }
    await requirePermission(
      ctx,
      collection.organizationId,
      "collections.update",
    );

    const isPublicDestination = await isPublicTransferDestination(
      ctx,
      collection.organizationId,
      args.targetOrganizationId,
    );

    const blockers = await buildEligibilityBlockers(
      ctx,
      collection,
      args.targetOrganizationId,
    );

    if (isPublicDestination) {
      const targetOrganization = await ctx.db.get(args.targetOrganizationId);
      if (
        !targetOrganization ||
        !organizationAllowsIncomingTransfers(targetOrganization)
      ) {
        throw new Error(
          "This organization is not accepting incoming transfer requests.",
        );
      }
    } else {
      await requirePermission(
        ctx,
        args.targetOrganizationId,
        "collections.create",
      );
      const [, membership] = await Promise.all([
        getTransferHierarchy(
          ctx,
          collection.organizationId,
          args.targetOrganizationId,
        ),
        getCurrentUserOrganization(ctx, args.targetOrganizationId),
      ]);
      if (!membership) {
        throw new Error(
          "You must be a member of the destination organization to move an object there.",
        );
      }
    }

    if (blockers.length > 0) {
      throw new Error(blockers.map((blocker) => blocker.message).join(" "));
    }

    const reason = args.reason.trim();
    if (!reason) {
      throw new Error("A move reason is required.");
    }

    let requestedAccessionNumber = args.requestedAccessionNumber?.trim();
    if (args.accessionMode === "manual") {
      if (!requestedAccessionNumber) {
        throw new Error(
          "A new accession number is required when using manual accession mode.",
        );
      }

      await ensureAccessionNumberAvailable(
        ctx,
        args.targetOrganizationId,
        requestedAccessionNumber,
      );
    } else {
      requestedAccessionNumber = undefined;
    }

    if (args.accessionMode === "keep") {
      await ensureAccessionNumberAvailable(
        ctx,
        args.targetOrganizationId,
        collection.accessionNumber,
      );
    }

    const requestId = await ctx.db.insert("organizationMoveRequests", {
      collectionId: args.collectionId,
      sourceOrganizationId: collection.organizationId,
      targetOrganizationId: args.targetOrganizationId,
      sourceAccessionNumber: collection.accessionNumber,
      accessionMode: args.accessionMode,
      requestedAccessionNumber,
      reason,
      notes: args.notes?.trim() || undefined,
      status: "pending_source_approval",
      requestedBy: userId,
      requestedAt: Date.now(),
    });

    await Promise.all([
      ctx.runMutation(internal.audit.logAction, {
        organizationId: collection.organizationId,
        userId,
        action: "created_organization_move_request",
        entityType: "organizationMoveRequest",
        entityId: requestId,
        changes: {
          collectionId: args.collectionId,
          targetOrganizationId: args.targetOrganizationId,
          accessionMode: args.accessionMode,
          requestedAccessionNumber,
        },
      }),
      ctx.runMutation(internal.notifications.notifyUsersWithPermission, {
        organizationId: collection.organizationId,
        permission: "organization.manage_settings",
        type: NOTIFICATION_TYPES.MOVE_REQUEST_CREATED,
        title: `Object Move Request: ${collection.accessionNumber}`,
        message: `${collection.title} requires administrator approval before it can be moved to another organization.`,
        relatedEntityType: "move_request",
        relatedEntityId: requestId,
        excludeUserId: userId,
      }),
    ]);

    return requestId;
  },
});

export const get = query({
  args: {
    requestId: v.id("organizationMoveRequests"),
  },
  returns: v.union(v.any(), v.null()),
  handler: async (ctx, args) => {
    const [userId, request] = await Promise.all([
      getAuthUserId(ctx),
      ctx.db.get(args.requestId),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    if (!request) {
      return null;
    }

    const [canReadSource, canReadTarget] = await Promise.all([
      hasPermission(ctx, request.sourceOrganizationId, "collections.read"),
      hasPermission(ctx, request.targetOrganizationId, "collections.read"),
    ] as const);
    if (!canReadSource && !canReadTarget && request.requestedBy !== userId) {
      throw new Error("Permission denied: collections.read");
    }

    const [
      collection,
      sourceOrganization,
      targetOrganization,
      requestedByUser,
    ] = await Promise.all([
      ctx.db.get(request.collectionId),
      ctx.db.get(request.sourceOrganizationId),
      ctx.db.get(request.targetOrganizationId),
      ctx.db.get(request.requestedBy),
    ] as const);
    const reviewedByUser = request.reviewedBy
      ? await ctx.db.get(request.reviewedBy)
      : null;
    const sourceReviewedByUser = request.sourceReviewedBy
      ? await ctx.db.get(request.sourceReviewedBy)
      : null;
    const targetReviewedByUser = request.targetReviewedBy
      ? await ctx.db.get(request.targetReviewedBy)
      : null;
    const executedByUser = request.executedBy
      ? await ctx.db.get(request.executedBy)
      : null;

    const custodyEvents = await ctx.db
      .query("organizationTransferCustodyEvents")
      .withIndex("by_moveRequest", (q) => q.eq("moveRequestId", request._id))
      .collect();

    const approvedSourceLocation =
      request.approvedSourceLocationId === undefined
        ? undefined
        : request.approvedSourceLocationId === null
          ? null
          : await ctx.db.get(request.approvedSourceLocationId);

    const acceptedTargetLocation = request.acceptedTargetLocationId
      ? await ctx.db.get(request.acceptedTargetLocationId)
      : null;

    return {
      ...request,
      status: normalizeRequestStatus(request.status),
      collection,
      sourceOrganization,
      targetOrganization,
      requestedByUser,
      reviewedByUser,
      sourceReviewedByUser,
      targetReviewedByUser,
      executedByUser,
      custodyEvents,
      approvedSourceLocation,
      acceptedTargetLocation,
    };
  },
});

export const listForOrganization = query({
  args: {
    organizationId: v.id("organizations"),
    status: v.optional(requestStatusValidator),
    search: v.optional(v.string()),
  },
  returns: v.array(organizationMoveRequestSummaryValidator),
  handler: async (ctx, args) => {
    await requirePermission(
      ctx,
      args.organizationId,
      "organization.manage_settings",
    );

    const sourceRequests = args.status
      ? await ctx.db
          .query("organizationMoveRequests")
          .withIndex("by_source_organization_and_status", (q) =>
            q
              .eq("sourceOrganizationId", args.organizationId)
              .eq("status", args.status!),
          )
          .collect()
      : await ctx.db
          .query("organizationMoveRequests")
          .withIndex("by_source_organization", (q) =>
            q.eq("sourceOrganizationId", args.organizationId),
          )
          .collect();

    const targetRequests = args.status
      ? await ctx.db
          .query("organizationMoveRequests")
          .withIndex("by_target_organization_and_status", (q) =>
            q
              .eq("targetOrganizationId", args.organizationId)
              .eq("status", args.status!),
          )
          .collect()
      : await ctx.db
          .query("organizationMoveRequests")
          .withIndex("by_target_organization", (q) =>
            q.eq("targetOrganizationId", args.organizationId),
          )
          .collect();

    const requestsById = new Map<
      Id<"organizationMoveRequests">,
      (typeof sourceRequests)[number]
    >();
    const visibleTargetRequests = targetRequests.filter(
      (request) =>
        normalizeRequestStatus(request.status) !== "pending_source_approval",
    );
    for (const request of [...sourceRequests, ...visibleTargetRequests]) {
      requestsById.set(request._id, request);
    }
    const requests = Array.from(requestsById.values());

    let enrichedRequests = await Promise.all(
      requests.map(async (request) => {
        const [collection, targetOrganization, requestedByUser] =
          await Promise.all([
            ctx.db.get(request.collectionId),
            ctx.db.get(request.targetOrganizationId),
            ctx.db.get(request.requestedBy),
          ] as const);
        const reviewedByUser = request.reviewedBy
          ? await ctx.db.get(request.reviewedBy)
          : null;
        const sourceReviewedByUser = request.sourceReviewedBy
          ? await ctx.db.get(request.sourceReviewedBy)
          : null;
        const targetReviewedByUser = request.targetReviewedBy
          ? await ctx.db.get(request.targetReviewedBy)
          : null;
        const direction: "incoming" | "outgoing" =
          request.targetOrganizationId === args.organizationId
            ? "incoming"
            : "outgoing";

        return {
          _id: request._id,
          collectionId: request.collectionId,
          collectionTitle: collection?.title ?? "Unknown object",
          sourceAccessionNumber: request.sourceAccessionNumber,
          finalAccessionNumber: request.finalAccessionNumber,
          requestedAccessionNumber: request.requestedAccessionNumber,
          accessionMode: request.accessionMode,
          targetOrganizationId: request.targetOrganizationId,
          targetOrganizationName:
            targetOrganization?.name ?? "Unknown organization",
          reason: request.reason,
          notes: request.notes,
          status: normalizeRequestStatus(request.status),
          requestedBy: request.requestedBy,
          requestedByName:
            requestedByUser?.name ??
            requestedByUser?.username ??
            "Unknown user",
          requestedAt: request.requestedAt,
          reviewedByName: reviewedByUser?.name ?? reviewedByUser?.username,
          reviewedAt: request.reviewedAt,
          reviewNotes: request.reviewNotes,
          sourceReviewedByName:
            sourceReviewedByUser?.name ?? sourceReviewedByUser?.username,
          sourceReviewedAt: request.sourceReviewedAt,
          sourceReviewNotes: request.sourceReviewNotes,
          targetReviewedByName:
            targetReviewedByUser?.name ?? targetReviewedByUser?.username,
          targetReviewedAt: request.targetReviewedAt,
          targetReviewNotes: request.targetReviewNotes,
          deaccessionId: request.deaccessionId,
          direction,
        };
      }),
    );

    const search = args.search?.trim().toLowerCase();
    if (search) {
      enrichedRequests = enrichedRequests.filter((request) => {
        return (
          request.collectionTitle.toLowerCase().includes(search) ||
          request.sourceAccessionNumber.toLowerCase().includes(search) ||
          request.targetOrganizationName.toLowerCase().includes(search) ||
          request.reason.toLowerCase().includes(search) ||
          request.notes?.toLowerCase().includes(search) ||
          request.requestedByName.toLowerCase().includes(search) ||
          request.requestedAccessionNumber?.toLowerCase().includes(search) ||
          request.finalAccessionNumber?.toLowerCase().includes(search) ||
          false
        );
      });
    }

    return enrichedRequests.sort(
      (left, right) => right.requestedAt - left.requestedAt,
    );
  },
});

export const getPendingForCollection = query({
  args: {
    collectionId: v.id("collections"),
  },
  returns: v.union(
    v.object({
      _id: v.id("organizationMoveRequests"),
      targetOrganizationId: v.id("organizations"),
      targetOrganizationName: v.string(),
      status: requestStatusValidator,
      reason: v.string(),
      accessionMode: accessionModeValidator,
      requestedAt: v.number(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const collection = await ctx.db.get(args.collectionId);
    if (!collection) {
      return null;
    }

    const [, request] = await Promise.all([
      requirePermission(ctx, collection.organizationId, "collections.read"),
      ctx.db
        .query("organizationMoveRequests")
        .withIndex("by_collection", (q) =>
          q.eq("collectionId", args.collectionId),
        )
        .collect(),
    ] as const);

    const pendingRequest =
      request.find((entry) => ACTIVE_REQUEST_STATUSES.has(entry.status)) ??
      null;

    if (!pendingRequest) {
      return null;
    }

    const targetOrganization = await ctx.db.get(
      pendingRequest.targetOrganizationId,
    );

    return {
      _id: pendingRequest._id,
      targetOrganizationId: pendingRequest.targetOrganizationId,
      targetOrganizationName:
        targetOrganization?.name ?? "Unknown organization",
      status: normalizeRequestStatus(pendingRequest.status),
      reason: pendingRequest.reason,
      accessionMode: pendingRequest.accessionMode,
      requestedAt: pendingRequest.requestedAt,
    };
  },
});

export const approve = mutation({
  args: {
    requestId: v.id("organizationMoveRequests"),
    reviewNotes: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const [userId, request] = await Promise.all([
      getAuthUserId(ctx),
      ctx.db.get(args.requestId),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    if (!request) {
      throw new Error("Move request not found");
    }

    if (
      request.status === "awaiting_acceptance" &&
      request.approvedSourceLocationId === undefined
    ) {
      await requirePermission(
        ctx,
        request.sourceOrganizationId,
        "organization.manage_settings",
      );
      const collection = await ctx.db.get(request.collectionId);
      if (!collection) {
        throw new Error("Collection not found");
      }
      if (collection.organizationId !== request.sourceOrganizationId) {
        throw new Error(
          "This transfer request no longer matches the object's organization.",
        );
      }
      const now = Date.now();
      const approvedSourceLocationId = collection.currentLocationId ?? null;
      await Promise.all([
        ctx.db.patch(args.requestId, {
          approvedSourceLocationId,
          sourceReviewedBy: userId,
          sourceReviewedAt: now,
          sourceReviewNotes:
            args.reviewNotes?.trim() || request.sourceReviewNotes,
        }),
        ctx.runMutation(internal.audit.logAction, {
          organizationId: request.sourceOrganizationId,
          userId,
          action: "approved_organization_move_request_for_transfer",
          entityType: "organizationMoveRequest",
          entityId: args.requestId,
          changes: {
            collectionId: request.collectionId,
            targetOrganizationId: request.targetOrganizationId,
            approvedSourceLocationId,
            reboundObservedSource: true,
          },
        }),
      ]);
      return null;
    }

    if (normalizeRequestStatus(request.status) !== "pending_source_approval") {
      throw new Error(`Move request is already ${request.status}.`);
    }

    await requirePermission(
      ctx,
      request.sourceOrganizationId,
      "organization.manage_settings",
    );

    const collection = await ctx.db.get(request.collectionId);
    if (!collection) {
      throw new Error("Collection not found");
    }

    const blockers = await buildEligibilityBlockers(
      ctx,
      collection,
      request.targetOrganizationId,
      { ignoreRequestId: request._id },
    );

    if (blockers.length > 0) {
      throw new Error(blockers.map((blocker) => blocker.message).join(" "));
    }

    await getTransferHierarchy(
      ctx,
      request.sourceOrganizationId,
      request.targetOrganizationId,
    );

    const deaccessionId = await createApprovedTransferDeaccession(
      ctx,
      request,
      userId,
    );

    const now = Date.now();
    await Promise.all([
      ctx.db.patch(args.requestId, {
        status: "awaiting_acceptance",
        sourceReviewedBy: userId,
        sourceReviewedAt: now,
        sourceReviewNotes: args.reviewNotes?.trim() || undefined,
        reviewedBy: userId,
        reviewedAt: now,
        reviewNotes: args.reviewNotes?.trim() || undefined,
        deaccessionId,
        approvedSourceLocationId: collection.currentLocationId ?? null,
      }),
      ctx.runMutation(internal.audit.logAction, {
        organizationId: request.sourceOrganizationId,
        userId,
        action: "approved_organization_move_request_for_transfer",
        entityType: "organizationMoveRequest",
        entityId: args.requestId,
        changes: {
          collectionId: request.collectionId,
          targetOrganizationId: request.targetOrganizationId,
          deaccessionId,
        },
      }),
      ctx.runMutation(internal.notifications.notifyUsersWithPermission, {
        organizationId: request.targetOrganizationId,
        permission: "organization.manage_settings",
        type: NOTIFICATION_TYPES.MOVE_REQUEST_CREATED,
        title: `Incoming Transfer Request: ${collection.accessionNumber}`,
        message: `${collection.title} is awaiting acceptance before the transfer is completed.`,
        relatedEntityType: "move_request",
        relatedEntityId: args.requestId,
        excludeUserId: userId,
      }),
    ] as const);

    return null;
  },
});

export const accept = mutation({
  args: {
    requestId: v.id("organizationMoveRequests"),
    targetLocationId: v.id("locations"),
    reviewNotes: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const [userId, request] = await Promise.all([
      getAuthUserId(ctx),
      ctx.db.get(args.requestId),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    if (!request) {
      throw new Error("Move request not found");
    }

    await requirePermission(
      ctx,
      request.targetOrganizationId,
      "organization.manage_settings",
    );

    if (request.status === "executed") {
      return null;
    }

    if (request.status !== "awaiting_acceptance") {
      throw new Error(`Move request is already ${request.status}.`);
    }

    const collection = await ctx.db.get(request.collectionId);
    if (!collection) {
      throw new Error("Collection not found");
    }

    if (collection.organizationId !== request.sourceOrganizationId) {
      throw new Error(
        "This transfer request no longer matches the object's organization.",
      );
    }

    await getTransferHierarchy(
      ctx,
      request.sourceOrganizationId,
      request.targetOrganizationId,
    );

    assertObservedSourceLocationMatches(
      collection,
      request.approvedSourceLocationId,
    );

    await requireTargetTransferLocation(
      ctx,
      request.targetOrganizationId,
      args.targetLocationId,
    );

    const blockers = await buildEligibilityBlockers(
      ctx,
      collection,
      request.targetOrganizationId,
      {
        ignoreRequestId: request._id,
        ignoreDeaccessionId: request.deaccessionId,
      },
    );

    if (blockers.length > 0) {
      throw new Error(blockers.map((blocker) => blocker.message).join(" "));
    }

    const transferScopeSnapshot = await buildTransferScopeSnapshot(
      ctx,
      collection,
    );

    await recordTransferCustodyEvent(ctx, {
      moveRequestId: request._id,
      collectionId: collection._id,
      organizationId: request.sourceOrganizationId,
      phase: "source_departure",
      observedLocationId: collection.currentLocationId ?? null,
      actorId: userId,
      notes: args.reviewNotes?.trim() || undefined,
    });

    let finalAccessionNumber = request.sourceAccessionNumber;
    if (request.accessionMode === "manual") {
      if (!request.requestedAccessionNumber) {
        throw new Error(
          "Manual accession mode requires a requested accession number.",
        );
      }
      await ensureAccessionNumberAvailable(
        ctx,
        request.targetOrganizationId,
        request.requestedAccessionNumber,
      );
      finalAccessionNumber = request.requestedAccessionNumber;
    } else if (request.accessionMode === "auto") {
      finalAccessionNumber = await resolveGeneratedAccessionNumber(
        ctx,
        request.targetOrganizationId,
      );
    } else {
      await ensureAccessionNumberAvailable(
        ctx,
        request.targetOrganizationId,
        request.sourceAccessionNumber,
      );
    }

    await executeMove(
      ctx,
      collection,
      request.targetOrganizationId,
      finalAccessionNumber,
      userId,
    );

    const arrivalMovementId = await recordTargetTransferArrival(ctx, {
      collectionId: collection._id,
      targetOrganizationId: request.targetOrganizationId,
      targetLocationId: args.targetLocationId,
      userId,
      moveRequestId: request._id,
      reason: request.reason,
    });

    await recordTransferCustodyEvent(ctx, {
      moveRequestId: request._id,
      collectionId: collection._id,
      organizationId: request.targetOrganizationId,
      phase: "target_arrival",
      observedLocationId: args.targetLocationId,
      actorId: userId,
    });

    const now = Date.now();
    await Promise.all([
      ctx.db.patch(args.requestId, {
        status: "executed",
        finalAccessionNumber,
        targetReviewedBy: userId,
        targetReviewedAt: now,
        targetReviewNotes: args.reviewNotes?.trim() || undefined,
        executedBy: userId,
        executedAt: now,
        acceptedTargetLocationId: args.targetLocationId,
        targetArrivalMovementId: arrivalMovementId,
        transferScopeSnapshot,
      }),
      ctx.runMutation(internal.audit.logAction, {
        organizationId: request.sourceOrganizationId,
        userId,
        action: "executed_organization_move_request",
        entityType: "organizationMoveRequest",
        entityId: args.requestId,
        changes: {
          collectionId: request.collectionId,
          targetOrganizationId: request.targetOrganizationId,
          finalAccessionNumber,
        },
      }),
      ctx.runMutation(internal.audit.logAction, {
        organizationId: request.targetOrganizationId,
        userId,
        action: "received_collection_from_organization_move",
        entityType: "collection",
        entityId: request.collectionId,
        changes: {
          requestId: args.requestId,
          sourceOrganizationId: request.sourceOrganizationId,
          finalAccessionNumber,
        },
      }),
    ] as const);

    if (request.requestedBy !== userId) {
      await ctx.runMutation(internal.audit.createNotificationInternal, {
        organizationId: request.sourceOrganizationId,
        userId: request.requestedBy,
        type: NOTIFICATION_TYPES.MOVE_REQUEST_APPROVED,
        title: "Object Move Approved",
        message:
          finalAccessionNumber === request.sourceAccessionNumber
            ? "Your object move request has been approved and executed."
            : `Your object move request has been approved. The new accession number is ${finalAccessionNumber}.`,
        relatedEntityType: "move_request",
        relatedEntityId: args.requestId,
      });
    }

    return null;
  },
});

export const reject = mutation({
  args: {
    requestId: v.id("organizationMoveRequests"),
    reviewNotes: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const [userId, request] = await Promise.all([
      getAuthUserId(ctx),
      ctx.db.get(args.requestId),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    if (!request) {
      throw new Error("Move request not found");
    }

    const normalizedStatus = normalizeRequestStatus(request.status);
    if (
      normalizedStatus !== "pending_source_approval" &&
      normalizedStatus !== "awaiting_acceptance"
    ) {
      throw new Error(`Move request is already ${request.status}.`);
    }

    const isTargetReview = normalizedStatus === "awaiting_acceptance";
    await requirePermission(
      ctx,
      isTargetReview
        ? request.targetOrganizationId
        : request.sourceOrganizationId,
      "organization.manage_settings",
    );

    const reviewNotes = args.reviewNotes.trim();
    if (!reviewNotes) {
      throw new Error(
        "Review notes are required when rejecting a move request.",
      );
    }

    const now = Date.now();
    await Promise.all([
      ctx.db.patch(args.requestId, {
        status: "rejected",
        reviewedBy: isTargetReview ? request.reviewedBy : userId,
        reviewedAt: isTargetReview ? request.reviewedAt : now,
        reviewNotes: isTargetReview ? request.reviewNotes : reviewNotes,
        sourceReviewedBy: isTargetReview ? request.sourceReviewedBy : userId,
        sourceReviewedAt: isTargetReview ? request.sourceReviewedAt : now,
        sourceReviewNotes: isTargetReview
          ? request.sourceReviewNotes
          : reviewNotes,
        targetReviewedBy: isTargetReview ? userId : undefined,
        targetReviewedAt: isTargetReview ? now : undefined,
        targetReviewNotes: isTargetReview ? reviewNotes : undefined,
      }),
      ctx.runMutation(internal.audit.logAction, {
        organizationId: isTargetReview
          ? request.targetOrganizationId
          : request.sourceOrganizationId,
        userId,
        action: isTargetReview
          ? "rejected_incoming_organization_move_request"
          : "rejected_organization_move_request",
        entityType: "organizationMoveRequest",
        entityId: args.requestId,
        changes: {
          reviewNotes,
        },
      }),
    ]);

    if (request.requestedBy !== userId) {
      await ctx.runMutation(internal.audit.createNotificationInternal, {
        organizationId: request.sourceOrganizationId,
        userId: request.requestedBy,
        type: "workflow_rejected",
        title: isTargetReview
          ? "Incoming Transfer Rejected"
          : "Object Move Rejected",
        message: reviewNotes,
        relatedEntityType: "move_request",
        relatedEntityId: args.requestId,
      });
    }

    return null;
  },
});

export const cancel = mutation({
  args: {
    requestId: v.id("organizationMoveRequests"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const [userId, request] = await Promise.all([
      getAuthUserId(ctx),
      ctx.db.get(args.requestId),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    if (!request) {
      throw new Error("Move request not found");
    }

    if (normalizeRequestStatus(request.status) !== "pending_source_approval") {
      throw new Error(`Move request is already ${request.status}.`);
    }

    const isSourceAdmin = await hasPermission(
      ctx,
      request.sourceOrganizationId,
      "organization.manage_settings",
    );

    if (request.requestedBy !== userId && !isSourceAdmin) {
      throw new Error(
        "Only the requester or a source organization administrator can cancel this move request.",
      );
    }

    await Promise.all([
      ctx.db.patch(args.requestId, {
        status: "cancelled",
        reviewedBy: isSourceAdmin ? userId : undefined,
        reviewedAt: Date.now(),
        sourceReviewedBy: isSourceAdmin ? userId : undefined,
        sourceReviewedAt: isSourceAdmin ? Date.now() : undefined,
      }),
      ctx.runMutation(internal.audit.logAction, {
        organizationId: request.sourceOrganizationId,
        userId,
        action: "cancelled_organization_move_request",
        entityType: "organizationMoveRequest",
        entityId: args.requestId,
        changes: {},
      }),
    ]);

    return null;
  },
});
