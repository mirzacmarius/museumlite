import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  type MutationCtx,
  type QueryCtx,
  mutation,
  query,
} from "./_generated/server";
import { NOTIFICATION_TYPES } from "./notifications";
import { getNextCounterValue } from "./utils/accessionCounter";
import { accessionParser } from "./utils/accessionNumberParser";
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

type EligibilityCheckOptions = {
  ignoreRequestId?: Id<"organizationMoveRequests">;
};

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

async function resolveGeneratedAccessionNumber(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const accessionNumber = await generateAccessionNumber(ctx, organizationId);
    const conflict = await findAccessionConflict(
      ctx,
      organizationId,
      accessionNumber,
    );
    if (!conflict) {
      return accessionNumber;
    }
  }

  throw new Error(
    "Unable to generate a unique accession number for the destination organization.",
  );
}

function dedupeStrings(values: string[] | undefined) {
  if (!values || values.length === 0) {
    return undefined;
  }

  return Array.from(
    new Set(
      values.map((value) => value.trim()).filter((value) => value.length > 0),
    ),
  );
}

function buildUpdatedAccessionState(
  collection: {
    accessionNumber: string;
    alternateAccessionNumbers?: string[];
    accessionNumberHistory?: Array<{
      number: string;
      validFrom: number;
      validTo?: number;
    }>;
  },
  nextAccessionNumber: string,
  now: number,
) {
  if (collection.accessionNumber === nextAccessionNumber) {
    return {
      accessionNumber: collection.accessionNumber,
      alternateAccessionNumbers: dedupeStrings(
        collection.alternateAccessionNumbers,
      ),
      accessionNumberHistory: collection.accessionNumberHistory,
    };
  }

  const alternateAccessionNumbers = dedupeStrings([
    ...(collection.alternateAccessionNumbers ?? []),
    collection.accessionNumber,
  ]);

  const existingHistory = [...(collection.accessionNumberHistory ?? [])];
  const history = existingHistory.map((entry) =>
    entry.validTo === undefined && entry.number === collection.accessionNumber
      ? { ...entry, validTo: now }
      : entry,
  );

  const hasOpenCurrentEntry = history.some(
    (entry) =>
      entry.number === collection.accessionNumber &&
      entry.validTo === undefined,
  );

  if (!hasOpenCurrentEntry) {
    history.push({
      number: collection.accessionNumber,
      validFrom: now,
      validTo: now,
    });
  }

  history.push({
    number: nextAccessionNumber,
    validFrom: now,
  });

  return {
    accessionNumber: nextAccessionNumber,
    alternateAccessionNumbers,
    accessionNumberHistory: history,
  };
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

  for (const loanItem of loanItems) {
    const loan = await ctx.db.get(loanItem.loanId);
    if (loan && ACTIVE_LOAN_STATUSES.has(loan.status)) {
      blockers.push({
        code: "active_loan",
        message: "This object is currently on loan and cannot be moved.",
      });
      break;
    }
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
        request.status === "pending" && request._id !== options.ignoreRequestId,
    )
  ) {
    blockers.push({
      code: "pending_organization_move",
      message: "This object already has a pending organization move request.",
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

  for (const transitItem of transitItems) {
    const transitRecord = await ctx.db.get(transitItem.transitRecordId);
    if (transitRecord && ACTIVE_TRANSIT_STATUSES.has(transitRecord.status)) {
      blockers.push({
        code: "active_transit",
        message:
          "This object is part of an active transit record and cannot be moved.",
      });
      break;
    }
  }

  const exhibitions = await ctx.db
    .query("exhibitions")
    .withIndex("by_collection", (q) => q.eq("collectionId", collection._id))
    .collect();

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

  if (deaccessions.length > 0) {
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
  for (const item of collectionGroupItems) {
    affectedGroupIds.add(item.collectionGroupId);
    await ctx.db.delete(item._id);
  }

  for (const groupId of affectedGroupIds) {
    const group = await ctx.db.get(groupId);
    if (!group) {
      continue;
    }

    await ctx.db.patch(groupId, {
      itemsCount: Math.max(0, (group.itemsCount ?? 0) - 1),
    });
  }
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

  for (const mediaFile of mediaFiles) {
    await ctx.db.patch(mediaFile._id, {
      organizationId: targetOrganizationId,
    });

    const mediaVersions = await ctx.db
      .query("mediaVersions")
      .withIndex("by_original_media", (q) =>
        q.eq("originalMediaId", mediaFile._id),
      )
      .collect();

    for (const version of mediaVersions) {
      await ctx.db.patch(version._id, {
        organizationId: targetOrganizationId,
      });
    }

    const editHistory = await ctx.db
      .query("mediaEditHistory")
      .withIndex("by_media", (q) => q.eq("mediaId", mediaFile._id))
      .collect();

    for (const historyEntry of editHistory) {
      await ctx.db.patch(historyEntry._id, {
        organizationId: targetOrganizationId,
      });
    }

    const downloads = await ctx.db
      .query("mediaDownloads")
      .withIndex("by_media", (q) => q.eq("mediaId", mediaFile._id))
      .collect();

    for (const download of downloads) {
      await ctx.db.patch(download._id, {
        organizationId: targetOrganizationId,
      });
    }
  }
}

async function moveSingleDetailRecord(
  ctx: MutationCtx,
  table:
    | "fineArtDetails"
    | "wineDetails"
    | "vehicleDetails"
    | "naturalHistoryDetails"
    | "archiveDetails",
  collectionId: Id<"collections">,
  targetOrganizationId: Id<"organizations">,
) {
  const detailRecord = await ctx.db
    .query(table)
    .withIndex("by_collection", (q) => q.eq("collectionId", collectionId))
    .unique();

  if (detailRecord) {
    await ctx.db.patch(detailRecord._id, {
      organizationId: targetOrganizationId,
    });
  }
}

async function moveConservationRecords(
  ctx: MutationCtx,
  collectionId: Id<"collections">,
  targetOrganizationId: Id<"organizations">,
) {
  const treatments = await ctx.db
    .query("conservationTreatments")
    .withIndex("by_collection", (q) => q.eq("collectionId", collectionId))
    .collect();

  for (const treatment of treatments) {
    await ctx.db.patch(treatment._id, {
      organizationId: targetOrganizationId,
    });

    const attachments = await ctx.db
      .query("conservationAttachments")
      .withIndex("by_treatment", (q) => q.eq("treatmentId", treatment._id))
      .collect();

    for (const attachment of attachments) {
      await ctx.db.patch(attachment._id, {
        organizationId: targetOrganizationId,
      });
    }
  }

  const schedules = await ctx.db
    .query("assessmentSchedules")
    .withIndex("by_collection", (q) => q.eq("collectionId", collectionId))
    .collect();

  for (const schedule of schedules) {
    await ctx.db.patch(schedule._id, {
      organizationId: targetOrganizationId,
    });
  }

  const alerts = await ctx.db
    .query("conservationAlerts")
    .withIndex("by_collection", (q) => q.eq("collectionId", collectionId))
    .collect();

  for (const alert of alerts) {
    await ctx.db.patch(alert._id, {
      organizationId: targetOrganizationId,
    });
  }
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

  await moveCollectionGroupLinks(ctx, collection._id);
  await moveMediaRecords(ctx, collection._id, targetOrganizationId);
  await moveSingleDetailRecord(
    ctx,
    "fineArtDetails",
    collection._id,
    targetOrganizationId,
  );
  await moveSingleDetailRecord(
    ctx,
    "wineDetails",
    collection._id,
    targetOrganizationId,
  );
  await moveSingleDetailRecord(
    ctx,
    "vehicleDetails",
    collection._id,
    targetOrganizationId,
  );
  await moveSingleDetailRecord(
    ctx,
    "naturalHistoryDetails",
    collection._id,
    targetOrganizationId,
  );
  await moveSingleDetailRecord(
    ctx,
    "archiveDetails",
    collection._id,
    targetOrganizationId,
  );
  await moveConservationRecords(ctx, collection._id, targetOrganizationId);

  const comments = await ctx.db
    .query("objectComments")
    .withIndex("by_object", (q) => q.eq("objectId", collection._id))
    .collect();

  for (const comment of comments) {
    await ctx.db.patch(comment._id, {
      organizationId: targetOrganizationId,
    });
  }

  const appraisals = await ctx.db
    .query("appraisals")
    .withIndex("by_collection", (q) => q.eq("collectionId", collection._id))
    .collect();

  for (const appraisal of appraisals) {
    await ctx.db.patch(appraisal._id, {
      organizationId: targetOrganizationId,
    });
  }

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

export const listEligibleTargetOrganizations = query({
  args: {
    collectionId: v.id("collections"),
  },
  returns: v.array(
    v.object({
      _id: v.id("organizations"),
      name: v.string(),
      slug: v.string(),
      roleName: v.optional(v.string()),
    }),
  ),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const collection = await ctx.db.get(args.collectionId);
    if (!collection) {
      return [];
    }

    await requirePermission(
      ctx,
      collection.organizationId,
      "collections.update",
    );

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

        const organization = await ctx.db.get(membership.organizationId);
        const role = await ctx.db.get(membership.roleId);
        if (!organization) {
          return null;
        }

        return {
          _id: organization._id,
          name: organization.name,
          slug: organization.slug,
          roleName: role?.name,
        };
      }),
    );

    return organizations
      .filter(
        (organization): organization is NonNullable<typeof organization> =>
          organization !== null,
      )
      .sort((left, right) => left.name.localeCompare(right.name));
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
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const collection = await ctx.db.get(args.collectionId);
    if (!collection) {
      throw new Error("Collection not found");
    }

    await requirePermission(
      ctx,
      collection.organizationId,
      "collections.update",
    );
    await requirePermission(
      ctx,
      args.targetOrganizationId,
      "collections.create",
    );

    const membership = await getCurrentUserOrganization(
      ctx,
      args.targetOrganizationId,
    );
    if (!membership) {
      throw new Error(
        "You must be a member of the destination organization to move an object there.",
      );
    }

    const blockers = await buildEligibilityBlockers(
      ctx,
      collection,
      args.targetOrganizationId,
    );

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
      status: "pending",
      requestedBy: userId,
      requestedAt: Date.now(),
    });

    await ctx.runMutation(internal.audit.logAction, {
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
    });

    await ctx.runMutation(internal.notifications.notifyUsersWithPermission, {
      organizationId: collection.organizationId,
      permission: "organization.manage_settings",
      type: NOTIFICATION_TYPES.MOVE_REQUEST_CREATED,
      title: `Object Move Request: ${collection.accessionNumber}`,
      message: `${collection.title} requires administrator approval before it can be moved to another organization.`,
      relatedEntityType: "move_request",
      relatedEntityId: requestId,
      excludeUserId: userId,
    });

    return requestId;
  },
});

export const get = query({
  args: {
    requestId: v.id("organizationMoveRequests"),
  },
  returns: v.union(v.any(), v.null()),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const request = await ctx.db.get(args.requestId);
    if (!request) {
      return null;
    }

    const canReadSource = await hasPermission(
      ctx,
      request.sourceOrganizationId,
      "collections.read",
    );
    const canReadTarget = await hasPermission(
      ctx,
      request.targetOrganizationId,
      "collections.read",
    );

    if (!canReadSource && !canReadTarget && request.requestedBy !== userId) {
      throw new Error("Permission denied: collections.read");
    }

    const collection = await ctx.db.get(request.collectionId);
    const sourceOrganization = await ctx.db.get(request.sourceOrganizationId);
    const targetOrganization = await ctx.db.get(request.targetOrganizationId);
    const requestedByUser = await ctx.db.get(request.requestedBy);
    const reviewedByUser = request.reviewedBy
      ? await ctx.db.get(request.reviewedBy)
      : null;
    const executedByUser = request.executedBy
      ? await ctx.db.get(request.executedBy)
      : null;

    return {
      ...request,
      collection,
      sourceOrganization,
      targetOrganization,
      requestedByUser,
      reviewedByUser,
      executedByUser,
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

    const queryRef = args.status
      ? ctx.db
          .query("organizationMoveRequests")
          .withIndex("by_source_organization_and_status", (q) =>
            q
              .eq("sourceOrganizationId", args.organizationId)
              .eq("status", args.status!),
          )
      : ctx.db
          .query("organizationMoveRequests")
          .withIndex("by_source_organization", (q) =>
            q.eq("sourceOrganizationId", args.organizationId),
          );

    const requests = await queryRef.collect();

    let enrichedRequests = await Promise.all(
      requests.map(async (request) => {
        const collection = await ctx.db.get(request.collectionId);
        const targetOrganization = await ctx.db.get(
          request.targetOrganizationId,
        );
        const requestedByUser = await ctx.db.get(request.requestedBy);
        const reviewedByUser = request.reviewedBy
          ? await ctx.db.get(request.reviewedBy)
          : null;

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
          status: request.status,
          requestedBy: request.requestedBy,
          requestedByName:
            requestedByUser?.name ??
            requestedByUser?.username ??
            "Unknown user",
          requestedAt: request.requestedAt,
          reviewedByName: reviewedByUser?.name ?? reviewedByUser?.username,
          reviewedAt: request.reviewedAt,
          reviewNotes: request.reviewNotes,
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

    await requirePermission(ctx, collection.organizationId, "collections.read");

    const request = await ctx.db
      .query("organizationMoveRequests")
      .withIndex("by_collection", (q) =>
        q.eq("collectionId", args.collectionId),
      )
      .collect();

    const pendingRequest =
      request.find((entry) => entry.status === "pending") ?? null;

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
      status: pendingRequest.status,
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
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const request = await ctx.db.get(args.requestId);
    if (!request) {
      throw new Error("Move request not found");
    }

    await requirePermission(
      ctx,
      request.sourceOrganizationId,
      "organization.manage_settings",
    );

    if (request.status !== "pending") {
      throw new Error(`Move request is already ${request.status}.`);
    }

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

    const now = Date.now();
    await ctx.db.patch(args.requestId, {
      status: "executed",
      finalAccessionNumber,
      reviewedBy: userId,
      reviewedAt: now,
      reviewNotes: args.reviewNotes?.trim() || undefined,
      executedBy: userId,
      executedAt: now,
    });

    await ctx.runMutation(internal.audit.logAction, {
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
    });

    await ctx.runMutation(internal.audit.logAction, {
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
    });

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
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const request = await ctx.db.get(args.requestId);
    if (!request) {
      throw new Error("Move request not found");
    }

    await requirePermission(
      ctx,
      request.sourceOrganizationId,
      "organization.manage_settings",
    );

    if (request.status !== "pending") {
      throw new Error(`Move request is already ${request.status}.`);
    }

    const reviewNotes = args.reviewNotes.trim();
    if (!reviewNotes) {
      throw new Error(
        "Review notes are required when rejecting a move request.",
      );
    }

    await ctx.db.patch(args.requestId, {
      status: "rejected",
      reviewedBy: userId,
      reviewedAt: Date.now(),
      reviewNotes,
    });

    await ctx.runMutation(internal.audit.logAction, {
      organizationId: request.sourceOrganizationId,
      userId,
      action: "rejected_organization_move_request",
      entityType: "organizationMoveRequest",
      entityId: args.requestId,
      changes: {
        reviewNotes,
      },
    });

    if (request.requestedBy !== userId) {
      await ctx.runMutation(internal.audit.createNotificationInternal, {
        organizationId: request.sourceOrganizationId,
        userId: request.requestedBy,
        type: "workflow_rejected",
        title: "Object Move Rejected",
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
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const request = await ctx.db.get(args.requestId);
    if (!request) {
      throw new Error("Move request not found");
    }

    if (request.status !== "pending") {
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

    await ctx.db.patch(args.requestId, {
      status: "cancelled",
      reviewedBy: isSourceAdmin ? userId : undefined,
      reviewedAt: Date.now(),
    });

    await ctx.runMutation(internal.audit.logAction, {
      organizationId: request.sourceOrganizationId,
      userId,
      action: "cancelled_organization_move_request",
      entityType: "organizationMoveRequest",
      entityId: args.requestId,
      changes: {},
    });

    return null;
  },
});
