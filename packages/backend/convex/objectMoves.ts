import { getAuthUserId } from "@convex-dev/auth/server";
import { type Infer, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { type MutationCtx, type QueryCtx, query } from "./_generated/server";
import {
  createTransferDeaccession,
  rejectTransferDeaccession,
} from "./deaccessions";
import { batchGetByIds, batchLookup } from "./utils/batchLookup";
import { moveCollectionDetailRecords } from "./utils/collectionDetailLifecycle";
import { getExhibitionsForObject } from "./utils/exhibitionParticipation";
import { buildUpdatedAccessionState } from "./utils/identifierHistory";
import {
  ensureIdentifierAvailable,
  generateConfiguredIdentifier,
  normalizeIdentifier,
} from "./utils/identifiers";
import {
  assertObservedSourceLocationMatches,
  buildTransferScopeSnapshot,
  moveConditionAssessmentRecords,
  recordTargetTransferArrival,
  recordTransferCustodyEvent,
  requireTargetTransferLocation,
} from "./utils/institutionTransferEvidence";
import { mutation } from "./utils/mutationBuilders";
import { dispatchNotification } from "./utils/notificationDispatch";
import { isUnaccessionedEntryObject } from "./utils/objectEntryLifecycle";
import {
  ELIGIBILITY_BLOCKER_CODES,
  type EligibilityBlockerCode,
  objectMoveError,
  objectMoveErrorFromError,
} from "./utils/objectMoveErrors";
import {
  executedTransferDeaccessionIds,
  holdsObject,
} from "./utils/openDeaccessions";
import {
  getCurrentUserOrganization,
  getUserIdsWithPermission,
  hasPermission,
  requirePermission,
} from "./utils/permissions";
import { rehomeObjectProvenance } from "./utils/provenance";
import {
  approvedBySender,
  awaitsSenderReapproval,
  isOpenTransfer,
  reachedReceiver,
  type TransferStage,
  transferActionsFor,
  transferDecision,
  transferDecisionValidator,
  transferStage,
  transferStageValidator,
} from "./utils/transferStages";
import type { ColumnPage } from "./utils/workBoardColumns";

const accessionModeValidator = v.union(
  v.literal("keep"),
  v.literal("auto"),
  v.literal("manual"),
);

const blockerValidator = v.object({
  code: v.union(...ELIGIBILITY_BLOCKER_CODES.map((code) => v.literal(code))),
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
  sourceOrganizationId: v.id("organizations"),
  sourceOrganizationName: v.string(),
  targetOrganizationId: v.id("organizations"),
  targetOrganizationName: v.string(),
  reason: v.string(),
  notes: v.optional(v.string()),
  stage: transferStageValidator,
  /** The sender approved it before its Location was recorded and approves it again. */
  awaitsSenderReapproval: v.boolean(),
  /** How the transfer ended; absent while it is open. */
  decision: v.optional(transferDecisionValidator),
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
  code: EligibilityBlockerCode;
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
    throw objectMoveError(
      "DESTINATION_OUTSIDE_HIERARCHY",
      "Objects can only be transferred between organizations in the same hierarchy.",
    );
  }

  const rootOrganization = await ctx.db.get(sourceRootId);
  if (!rootOrganization) {
    throw new Error("Root organization not found");
  }

  const rootTier = rootOrganization.subscriptionTier ?? "free";
  if (rootTier !== "pro" && rootTier !== "enterprise") {
    throw objectMoveError(
      "HIERARCHY_PLAN_REQUIRED",
      "Hierarchical transfers require a Pro or Enterprise plan.",
    );
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

/**
 * The rule `createRequest` admits a destination by, checked again when the
 * transfer is approved and accepted: the destination allows incoming transfer
 * requests, or it shares the source's hierarchy on a plan that includes
 * hierarchical transfers. At acceptance the receiving organization reads the
 * refusal, so one outside the hierarchy hears it in its own terms.
 */
async function requireTransferRoute(
  ctx: QueryCtx | MutationCtx,
  sourceOrganizationId: Id<"organizations">,
  targetOrganizationId: Id<"organizations">,
  decision: "approve" | "accept",
) {
  const isPublicDestination = await isPublicTransferDestination(
    ctx,
    sourceOrganizationId,
    targetOrganizationId,
  );
  if (isPublicDestination) return;
  try {
    await getTransferHierarchy(ctx, sourceOrganizationId, targetOrganizationId);
  } catch (error) {
    const outsideHierarchy =
      objectMoveErrorFromError(error)?.code === "DESTINATION_OUTSIDE_HIERARCHY";
    if (decision === "accept" && outsideHierarchy) {
      throw objectMoveError(
        "DESTINATION_NOT_ACCEPTING",
        "Your organization does not accept incoming transfer requests and is outside the sending organization's hierarchy.",
      );
    }
    throw error;
  }
}

function requireNoMoveBlockers(blockers: MoveBlocker[]) {
  if (blockers.length === 0) return;
  throw objectMoveError(
    "MOVE_BLOCKED",
    blockers.map((blocker) => blocker.message).join(" "),
    blockers.map((blocker) => blocker.code),
  );
}

function moveRequestClosed(status: RequestStatus) {
  return objectMoveError(
    "MOVE_REQUEST_CLOSED",
    `Move request is already ${status}.`,
  );
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

/**
 * Whether the organization can generate a new accession number for an
 * object it receives: what `generateConfiguredIdentifier` refuses without.
 */
function generatesAccessionNumbers(organization: Doc<"organizations">) {
  return Boolean(
    organization.settings?.autoGenerateAccessionNumbers &&
      organization.settings.accessionNumberFormat,
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
        isOpenTransfer(request) && request._id !== options.ignoreRequestId,
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

  // A rejected Removal, whatever its method, left the object in the
  // collection, and the Removal of an executed transfer closed when the object
  // arrived, so neither stops the object from being transferred again.
  const closedByTransfer = executedTransferDeaccessionIds(moveRequests);
  const blockingDeaccessions = deaccessions.filter(
    (deaccession) =>
      deaccession._id !== options.ignoreDeaccessionId &&
      holdsObject(deaccession, closedByTransfer),
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
    rehomeObjectProvenance(ctx, {
      objectId: collection._id,
      fromOrganizationId: collection.organizationId,
      toOrganizationId: targetOrganizationId,
    }),
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
    // The receiver's register finds the Object by the number it now has.
    normalizedIdentifier: normalizeIdentifier(accessionState.accessionNumber),
    alternateAccessionNumbers: accessionState.alternateAccessionNumbers,
    accessionNumberHistory: accessionState.accessionNumberHistory,
    lastModifiedBy: executedBy,
    lastModifiedAt: now,
  });
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
            code: "collection_not_found" as const,
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

    const blockers: Array<{ code: EligibilityBlockerCode; message: string }> =
      await buildEligibilityBlockers(
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
          const planRequired =
            objectMoveErrorFromError(error)?.code === "HIERARCHY_PLAN_REQUIRED";
          blockers.push({
            code: planRequired
              ? "hierarchy_plan_required"
              : "target_not_in_hierarchy",
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
    // The receiving organization chooses the accession number when it
    // accepts. A mode given here is only the choice it starts from.
    accessionMode: v.optional(accessionModeValidator),
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

    // A public destination is one that allows incoming transfer requests.
    // Any other must be in the hierarchy, and the requester must be able to
    // add objects there, which only its members can.
    if (!isPublicDestination) {
      await requirePermission(
        ctx,
        args.targetOrganizationId,
        "collections.create",
      );
      await getTransferHierarchy(
        ctx,
        collection.organizationId,
        args.targetOrganizationId,
      );
    }

    requireNoMoveBlockers(blockers);

    const reason = args.reason.trim();
    if (!reason) {
      throw new Error("A move reason is required.");
    }

    const accessionMode = args.accessionMode ?? "keep";
    let requestedAccessionNumber = args.requestedAccessionNumber?.trim();
    if (accessionMode === "manual") {
      if (!requestedAccessionNumber) {
        throw objectMoveError(
          "ACCESSION_NUMBER_REQUIRED",
          "A new accession number is required when using manual accession mode.",
        );
      }

      await ensureIdentifierAvailable(
        ctx,
        args.targetOrganizationId,
        "catalog",
        requestedAccessionNumber,
      );
    } else {
      requestedAccessionNumber = undefined;
    }

    if (args.accessionMode === "keep") {
      await ensureIdentifierAvailable(
        ctx,
        args.targetOrganizationId,
        "catalog",
        collection.accessionNumber,
      );
    }

    const requestId = await ctx.db.insert("organizationMoveRequests", {
      collectionId: args.collectionId,
      sourceOrganizationId: collection.organizationId,
      targetOrganizationId: args.targetOrganizationId,
      sourceAccessionNumber: collection.accessionNumber,
      accessionMode,
      requestedAccessionNumber,
      reason,
      notes: args.notes?.trim() || undefined,
      status: "pending_source_approval",
      requestedBy: userId,
      requestedAt: Date.now(),
    });

    const settingsManagers = await getUserIdsWithPermission(
      ctx,
      collection.organizationId,
      "organization.manage_settings",
      { excludeUserId: userId },
    );
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
          accessionMode,
          requestedAccessionNumber,
        },
      }),
      dispatchNotification(ctx, {
        organizationId: collection.organizationId,
        type: "move_request_created",
        recipients: settingsManagers,
        title: `Object Move Request: ${collection.accessionNumber}`,
        message: `${collection.title} requires administrator approval before it can be moved to another organization.`,
        related: { entityType: "move_request", entityId: requestId },
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
      stage: transferStage(request),
      awaitsSenderReapproval: awaitsSenderReapproval(request),
      approvedBySender: approvedBySender(request),
      decision: transferDecision(request),
      actions: await transferActionsFor(ctx, request, userId),
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
      receiverGeneratesAccessionNumbers: targetOrganization
        ? generatesAccessionNumbers(targetOrganization)
        : false,
      // The receiver's own setting, whichever Organization the viewer selected.
      receiverTracksLocations:
        targetOrganization?.settings?.locationTrackingEnabled ?? true,
    };
  },
});

export const listForOrganization = query({
  args: {
    organizationId: v.id("organizations"),
    search: v.optional(v.string()),
  },
  returns: v.array(organizationMoveRequestSummaryValidator),
  handler: async (ctx, args) => {
    await requirePermission(
      ctx,
      args.organizationId,
      "organization.manage_settings",
    );

    const [sourceRequests, targetRequests] = await Promise.all([
      ctx.db
        .query("organizationMoveRequests")
        .withIndex("by_source_organization", (q) =>
          q.eq("sourceOrganizationId", args.organizationId),
        )
        .collect(),
      ctx.db
        .query("organizationMoveRequests")
        .withIndex("by_target_organization", (q) =>
          q.eq("targetOrganizationId", args.organizationId),
        )
        .collect(),
    ]);

    const requestsById = new Map<
      Id<"organizationMoveRequests">,
      (typeof sourceRequests)[number]
    >();
    const visibleTargetRequests = targetRequests.filter(reachedReceiver);
    for (const request of [...sourceRequests, ...visibleTargetRequests]) {
      requestsById.set(request._id, request);
    }
    const requests = Array.from(requestsById.values());

    let enrichedRequests = await Promise.all(
      requests.map(async (request) => {
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
          sourceOrganizationId: request.sourceOrganizationId,
          sourceOrganizationName:
            sourceOrganization?.name ?? "Unknown organization",
          targetOrganizationId: request.targetOrganizationId,
          targetOrganizationName:
            targetOrganization?.name ?? "Unknown organization",
          reason: request.reason,
          notes: request.notes,
          stage: transferStage(request),
          awaitsSenderReapproval: awaitsSenderReapproval(request),
          decision: transferDecision(request),
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
          // The other organization: the viewer's own name matches every row.
          (request.direction === "incoming"
            ? request.sourceOrganizationName
            : request.targetOrganizationName
          )
            .toLowerCase()
            .includes(search) ||
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

const transferBoardCountsValidator = v.object({
  /** Outgoing transfers waiting for this Organization's approval. */
  waitingForApproval: v.number(),
  /** Outgoing transfers this Organization approved, waiting for the receiver. */
  waitingForReceiver: v.number(),
  /** Incoming transfers waiting for this Organization to accept or decline. */
  incoming: v.number(),
  received: v.number(),
  declined: v.number(),
  cancelled: v.number(),
  /**
   * What waits on this Organization's decision, the Transfers tab count:
   * the transfers to approve and the incoming ones, as the Work board's
   * column lists them.
   */
  awaitingDecision: v.number(),
});

type TransferBoardColumn = Exclude<
  keyof Infer<typeof transferBoardCountsValidator>,
  "awaitingDecision"
>;

function boardColumn(
  stage: TransferStage,
  direction: "outgoing" | "incoming",
): TransferBoardColumn {
  switch (stage) {
    case "waiting_for_sender":
      return "waitingForApproval";
    case "waiting_for_receiver":
      return direction === "incoming" ? "incoming" : "waitingForReceiver";
    default:
      return stage;
  }
}

/**
 * The Transfers board's totals, independent of its search: every transfer
 * `listForOrganization` lists, counted by stage and direction. Null for
 * members who cannot decide transfers.
 */
export const getBoardCounts = query({
  args: {
    organizationId: v.id("organizations"),
  },
  returns: v.union(transferBoardCountsValidator, v.null()),
  handler: async (ctx, args) => {
    const canDecide = await hasPermission(
      ctx,
      args.organizationId,
      "organization.manage_settings",
    );
    if (!canDecide) return null;

    const counts: Record<TransferBoardColumn, number> = {
      waitingForApproval: 0,
      waitingForReceiver: 0,
      incoming: 0,
      received: 0,
      declined: 0,
      cancelled: 0,
    };
    const sent = ctx.db
      .query("organizationMoveRequests")
      .withIndex("by_source_organization", (q) =>
        q.eq("sourceOrganizationId", args.organizationId),
      );
    for await (const request of sent) {
      counts[boardColumn(transferStage(request), "outgoing")] += 1;
    }
    const received = ctx.db
      .query("organizationMoveRequests")
      .withIndex("by_target_organization", (q) =>
        q.eq("targetOrganizationId", args.organizationId),
      );
    for await (const request of received) {
      if (!reachedReceiver(request)) continue;
      counts[boardColumn(transferStage(request), "incoming")] += 1;
    }
    return {
      ...counts,
      awaitingDecision: counts.waitingForApproval + counts.incoming,
    };
  },
});

export const transferAwaitingDecisionValidator = v.object({
  _id: v.id("organizationMoveRequests"),
  collectionTitle: v.optional(v.string()),
  sourceAccessionNumber: v.string(),
  direction: v.union(v.literal("outgoing"), v.literal("incoming")),
});

/**
 * Transfers waiting on the organization's transfer managers, newest first:
 * outgoing ones waiting for the sender and incoming ones waiting for the
 * receiver, as `transferStage` places them. Null for members who cannot
 * decide transfers, so they never see the Work board column.
 */
export async function readAwaitingDecision(
  ctx: QueryCtx,
  organizationId: Id<"organizations">,
  limit: number,
): Promise<ColumnPage<Infer<typeof transferAwaitingDecisionValidator>> | null> {
  const canDecide = await hasPermission(
    ctx,
    organizationId,
    "organization.manage_settings",
  );
  if (!canDecide) return null;

  const take = limit + 1;
  const outgoing = (status: RequestStatus) =>
    ctx.db
      .query("organizationMoveRequests")
      .withIndex("by_source_organization_and_status", (q) =>
        q.eq("sourceOrganizationId", organizationId).eq("status", status),
      );
  const batches = await Promise.all([
    outgoing("pending_source_approval").order("desc").take(take),
    outgoing("pending").order("desc").take(take),
    outgoing("approved_for_transfer").order("desc").take(take),
    outgoing("awaiting_acceptance")
      .filter((q) => q.eq(q.field("approvedSourceLocationId"), undefined))
      .order("desc")
      .take(take),
    ctx.db
      .query("organizationMoveRequests")
      .withIndex("by_target_organization_and_status", (q) =>
        q
          .eq("targetOrganizationId", organizationId)
          .eq("status", "awaiting_acceptance"),
      )
      .filter((q) => q.neq(q.field("approvedSourceLocationId"), undefined))
      .order("desc")
      .take(take),
  ]);
  const waiting = batches
    .flat()
    .sort((left, right) => right._creationTime - left._creationTime);
  const shown = waiting.slice(0, limit);
  const collections = await batchLookup(
    ctx,
    shown.map((request) => request.collectionId),
    "collections",
  );

  return {
    cards: shown.map((request) => ({
      _id: request._id,
      collectionTitle: collections.get(request.collectionId)?.title,
      sourceAccessionNumber: request.sourceAccessionNumber,
      direction:
        request.sourceOrganizationId === organizationId
          ? ("outgoing" as const)
          : ("incoming" as const),
    })),
    hasMore: waiting.length > limit,
  };
}

export const getPendingForCollection = query({
  args: {
    collectionId: v.id("collections"),
  },
  returns: v.union(
    v.object({
      _id: v.id("organizationMoveRequests"),
      targetOrganizationId: v.id("organizations"),
      targetOrganizationName: v.string(),
      stage: transferStageValidator,
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

    const pendingRequest = request.find(isOpenTransfer) ?? null;

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
      stage: transferStage(pendingRequest),
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

    if (transferStage(request) !== "waiting_for_sender") {
      throw moveRequestClosed(request.status);
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
    if (collection.organizationId !== request.sourceOrganizationId) {
      throw new Error(
        "This transfer request no longer matches the object's organization.",
      );
    }

    // An approval the sender makes again passes the same checks as the
    // first, and keeps the Removal that first approval made.
    const reapproval = awaitsSenderReapproval(request);
    const blockers = await buildEligibilityBlockers(
      ctx,
      collection,
      request.targetOrganizationId,
      {
        ignoreRequestId: request._id,
        ignoreDeaccessionId: request.deaccessionId,
      },
    );

    requireNoMoveBlockers(blockers);

    await requireTransferRoute(
      ctx,
      request.sourceOrganizationId,
      request.targetOrganizationId,
      "approve",
    );

    const deaccessionId =
      request.deaccessionId ??
      (await createTransferDeaccession(ctx, request, userId));

    const targetManagers = await getUserIdsWithPermission(
      ctx,
      request.targetOrganizationId,
      "organization.manage_settings",
      { excludeUserId: userId },
    );
    const reviewNotes =
      args.reviewNotes?.trim() ||
      (reapproval ? request.sourceReviewNotes : undefined);
    const now = Date.now();
    await Promise.all([
      ctx.db.patch(args.requestId, {
        status: "awaiting_acceptance",
        sourceReviewedBy: userId,
        sourceReviewedAt: now,
        sourceReviewNotes: reviewNotes,
        reviewedBy: userId,
        reviewedAt: now,
        reviewNotes,
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
          ...(reapproval ? { reapproval: true } : {}),
        },
      }),
      dispatchNotification(ctx, {
        organizationId: request.targetOrganizationId,
        type: "move_request_created",
        recipients: targetManagers,
        title: `Incoming Transfer Request: ${collection.accessionNumber}`,
        message: `${collection.title} is awaiting acceptance before the transfer is completed.`,
        related: { entityType: "move_request", entityId: args.requestId },
      }),
    ] as const);

    return null;
  },
});

export const accept = mutation({
  args: {
    requestId: v.id("organizationMoveRequests"),
    // Omitted, the object arrives without a location: the receiving
    // organization may not use locations at all.
    targetLocationId: v.optional(v.id("locations")),
    reviewNotes: v.optional(v.string()),
    // The receiving organization's choice of accession number. Omitted, the
    // request's stored choice applies.
    accessionMode: v.optional(accessionModeValidator),
    requestedAccessionNumber: v.optional(v.string()),
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

    const stage = transferStage(request);
    if (stage === "received") {
      return null;
    }
    if (stage === "waiting_for_sender") {
      throw objectMoveError(
        "TRANSFER_AWAITS_SENDER",
        "The sending organization has to approve this transfer before the receiving organization can decide it.",
      );
    }
    if (stage !== "waiting_for_receiver") {
      throw moveRequestClosed(request.status);
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

    await requireTransferRoute(
      ctx,
      request.sourceOrganizationId,
      request.targetOrganizationId,
      "accept",
    );

    assertObservedSourceLocationMatches(
      collection,
      request.approvedSourceLocationId,
    );

    if (args.targetLocationId) {
      await requireTargetTransferLocation(
        ctx,
        request.targetOrganizationId,
        args.targetLocationId,
      );
    }

    const blockers = await buildEligibilityBlockers(
      ctx,
      collection,
      request.targetOrganizationId,
      {
        ignoreRequestId: request._id,
        ignoreDeaccessionId: request.deaccessionId,
      },
    );

    requireNoMoveBlockers(blockers);

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

    const accessionMode = args.accessionMode ?? request.accessionMode;
    const requestedAccessionNumber =
      accessionMode !== "manual"
        ? undefined
        : args.accessionMode === undefined
          ? request.requestedAccessionNumber
          : args.requestedAccessionNumber?.trim() || undefined;
    let finalAccessionNumber = request.sourceAccessionNumber;
    if (accessionMode === "manual") {
      if (!requestedAccessionNumber) {
        throw objectMoveError(
          "ACCESSION_NUMBER_REQUIRED",
          "Manual accession mode requires a requested accession number.",
        );
      }
      await ensureIdentifierAvailable(
        ctx,
        request.targetOrganizationId,
        "catalog",
        requestedAccessionNumber,
      );
      finalAccessionNumber = requestedAccessionNumber;
    } else if (accessionMode === "auto") {
      finalAccessionNumber = await generateConfiguredIdentifier(
        ctx,
        request.targetOrganizationId,
        "catalog",
      );
    } else {
      await ensureIdentifierAvailable(
        ctx,
        request.targetOrganizationId,
        "catalog",
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

    const arrivalMovementId = args.targetLocationId
      ? await recordTargetTransferArrival(ctx, {
          collectionId: collection._id,
          targetOrganizationId: request.targetOrganizationId,
          targetLocationId: args.targetLocationId,
          userId,
          moveRequestId: request._id,
          reason: request.reason,
        })
      : undefined;

    await recordTransferCustodyEvent(ctx, {
      moveRequestId: request._id,
      collectionId: collection._id,
      organizationId: request.targetOrganizationId,
      phase: "target_arrival",
      observedLocationId: args.targetLocationId ?? null,
      actorId: userId,
    });

    const now = Date.now();
    await Promise.all([
      ctx.db.patch(args.requestId, {
        status: "executed",
        accessionMode,
        requestedAccessionNumber,
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
      await dispatchNotification(ctx, {
        organizationId: request.sourceOrganizationId,
        type: "move_request_approved",
        recipients: [request.requestedBy],
        title: "Object Move Approved",
        message:
          finalAccessionNumber === request.sourceAccessionNumber
            ? "Your object move request has been approved and executed."
            : `Your object move request has been approved. The new accession number is ${finalAccessionNumber}.`,
        related: { entityType: "move_request", entityId: args.requestId },
      });
    }

    return null;
  },
});

export const reject = mutation({
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

    const stage = transferStage(request);
    if (stage !== "waiting_for_sender" && stage !== "waiting_for_receiver") {
      throw moveRequestClosed(request.status);
    }

    // The receiver declines a transfer that waits for them. Before that, the
    // sender's administrators may decline a request they have not approved;
    // one they approved before they approve again or cancel, and the
    // receiver cannot decide it yet (ADR 0020).
    const isTargetReview = stage === "waiting_for_receiver";
    const actsForSender =
      !isTargetReview &&
      (await hasPermission(
        ctx,
        request.sourceOrganizationId,
        "organization.manage_settings",
      ));
    const isSenderDecline = actsForSender && !awaitsSenderReapproval(request);
    if (!actsForSender) {
      await requirePermission(
        ctx,
        request.targetOrganizationId,
        "organization.manage_settings",
      );
    }
    if (!isTargetReview && !isSenderDecline) {
      throw objectMoveError(
        "TRANSFER_AWAITS_SENDER",
        "The sending organization has to approve this transfer before the receiving organization can decide it.",
      );
    }

    const reviewNotes = args.reviewNotes?.trim() || undefined;
    const now = Date.now();
    // The receiving organization declining sends the object back to the
    // sender: the Removal the sender's approval made is rejected, so the
    // object stays in the source collection and can move again.
    const transferDeaccession =
      isTargetReview && request.deaccessionId
        ? await ctx.db.get(request.deaccessionId)
        : null;
    await Promise.all([
      transferDeaccession
        ? rejectTransferDeaccession(
            ctx,
            transferDeaccession,
            request._id,
            userId,
            "Transfer declined by the receiving organization.",
          )
        : null,
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
        changes: reviewNotes ? { reviewNotes } : {},
      }),
    ]);

    if (isTargetReview) {
      await notifySenderOfDecline(ctx, request, userId, reviewNotes);
    } else if (request.requestedBy !== userId) {
      await dispatchNotification(ctx, {
        organizationId: request.sourceOrganizationId,
        type: "workflow_rejected",
        recipients: [request.requestedBy],
        title: "Object Move Rejected",
        message: reviewNotes ?? "Your object move request was rejected.",
        related: { entityType: "move_request", entityId: args.requestId },
      });
    }

    return null;
  },
});

/**
 * Tells the sending organization that the receiver declined: the requester
 * and the source administrators who approved transfers, never the person who
 * declined.
 */
async function notifySenderOfDecline(
  ctx: MutationCtx,
  request: Doc<"organizationMoveRequests">,
  declinedBy: Id<"users">,
  reviewNotes: string | undefined,
) {
  const [sourceManagers, collection, targetOrganization] = await Promise.all([
    getUserIdsWithPermission(
      ctx,
      request.sourceOrganizationId,
      "organization.manage_settings",
      { excludeUserId: declinedBy },
    ),
    ctx.db.get(request.collectionId),
    ctx.db.get(request.targetOrganizationId),
  ] as const);
  const recipients = [
    ...new Set(
      [request.requestedBy, ...sourceManagers].filter(
        (recipient) => recipient !== declinedBy,
      ),
    ),
  ];
  if (recipients.length === 0) return;

  const declined = `${targetOrganization?.name ?? "The receiving organization"} declined the transfer of ${collection?.title ?? request.sourceAccessionNumber}.`;
  await dispatchNotification(ctx, {
    organizationId: request.sourceOrganizationId,
    type: "workflow_rejected",
    recipients,
    title: "Transfer Declined",
    message: reviewNotes ? `${declined} Reason: ${reviewNotes}` : declined,
    related: { entityType: "move_request", entityId: request._id },
  });
}

export const cancel = mutation({
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

    const stage = transferStage(request);
    if (stage !== "waiting_for_sender" && stage !== "waiting_for_receiver") {
      throw moveRequestClosed(request.status);
    }

    // The sender's administrators may cancel until the receiver decides; the
    // requester only their own request, until the sender approves it
    // (ADR 0020).
    const openToRequester =
      stage === "waiting_for_sender" && !awaitsSenderReapproval(request);
    if (!openToRequester) {
      await requirePermission(
        ctx,
        request.sourceOrganizationId,
        "organization.manage_settings",
      );
    }
    const isSourceAdmin =
      !openToRequester ||
      (await hasPermission(
        ctx,
        request.sourceOrganizationId,
        "organization.manage_settings",
      ));
    if (request.requestedBy !== userId && !isSourceAdmin) {
      throw new Error(
        "Only the requester or a source organization administrator can cancel this move request.",
      );
    }

    // A source administrator's cancel is their review of the request, so
    // their notes sit where a source rejection's would. A requester without
    // that role is cancelling their own request, not reviewing it, and leaves no
    // notes. Once the sender approved, the approval stays where it is and the
    // cancel is recorded beside it.
    const reviewNotes = isSourceAdmin
      ? args.reviewNotes?.trim() || undefined
      : undefined;
    const approved = approvedBySender(request);
    const transferDeaccession = request.deaccessionId
      ? await ctx.db.get(request.deaccessionId)
      : null;
    const now = Date.now();
    await Promise.all([
      transferDeaccession
        ? rejectTransferDeaccession(
            ctx,
            transferDeaccession,
            request._id,
            userId,
            "Transfer cancelled by the sending organization.",
          )
        : null,
      ctx.db.patch(args.requestId, {
        status: "cancelled",
        reviewedBy: isSourceAdmin ? userId : undefined,
        reviewedAt: now,
        reviewNotes,
        ...(approved
          ? {}
          : {
              sourceReviewedBy: isSourceAdmin ? userId : undefined,
              sourceReviewedAt: isSourceAdmin ? now : undefined,
              sourceReviewNotes: reviewNotes,
            }),
      }),
      ctx.runMutation(internal.audit.logAction, {
        organizationId: request.sourceOrganizationId,
        userId,
        action: "cancelled_organization_move_request",
        entityType: "organizationMoveRequest",
        entityId: args.requestId,
        changes: reviewNotes ? { reviewNotes } : {},
      }),
    ]);

    if (request.requestedBy !== userId) {
      await dispatchNotification(ctx, {
        organizationId: request.sourceOrganizationId,
        type: "move_request_cancelled",
        recipients: [request.requestedBy],
        title: "Object Move Cancelled",
        message:
          reviewNotes ??
          "Your object move request was cancelled by an administrator of the source organization.",
        related: { entityType: "move_request", entityId: args.requestId },
      });
    }
    if (stage === "waiting_for_receiver") {
      await notifyReceiverOfCancel(ctx, request, userId, reviewNotes);
    }

    return null;
  },
});

/**
 * Tells the receiving organization's administrators, who were waiting to
 * decide, that the sender cancelled the transfer.
 */
async function notifyReceiverOfCancel(
  ctx: MutationCtx,
  request: Doc<"organizationMoveRequests">,
  cancelledBy: Id<"users">,
  reviewNotes: string | undefined,
) {
  const [targetManagers, collection, sourceOrganization] = await Promise.all([
    getUserIdsWithPermission(
      ctx,
      request.targetOrganizationId,
      "organization.manage_settings",
      { excludeUserId: cancelledBy },
    ),
    ctx.db.get(request.collectionId),
    ctx.db.get(request.sourceOrganizationId),
  ] as const);
  if (targetManagers.length === 0) return;

  const cancelled = `${sourceOrganization?.name ?? "The sending organization"} cancelled the transfer of ${collection?.title ?? request.sourceAccessionNumber}.`;
  await dispatchNotification(ctx, {
    organizationId: request.targetOrganizationId,
    type: "move_request_cancelled",
    recipients: targetManagers,
    title: "Transfer Cancelled",
    message: reviewNotes ? `${cancelled} Reason: ${reviewNotes}` : cancelled,
    related: { entityType: "move_request", entityId: request._id },
  });
}
