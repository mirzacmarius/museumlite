import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import {
  applyCollectionDisposition,
  markCollectionActive,
} from "./collectionLifecycle";
import { isDisposalDecision } from "./disposalPolicy";
import { assertCollectionNotOnLoan } from "./loanOccupancy";
import { assertEntryAllowsStatus } from "./objectEntryLifecycle";
import { assertNotInTransfer, isOpenDeaccession } from "./openDeaccessions";
import { requirePermission } from "./permissions";

type WithdrawalStatus = "archived" | "deleted";

export async function archiveCollectionHandler(
  ctx: MutationCtx,
  args: { collectionId: Id<"collections">; reason: string },
) {
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
  await requirePermission(ctx, collection.organizationId, "collections.delete");
  await withdrawObject(ctx, collection, {
    userId,
    reason: args.reason,
    targetStatus: "archived",
  });
  return null;
}

/**
 * Withdraws one Object from the catalog. The single Remove item path and the
 * bulk status change both go through here, so they refuse the same Objects.
 * Callers check the caller's permission first.
 */
export async function withdrawObject(
  ctx: MutationCtx,
  collection: Doc<"collections">,
  {
    reason,
    targetStatus,
    userId,
  }: { userId: Id<"users">; reason: string; targetStatus: WithdrawalStatus },
) {
  const trimmedReason = reason.trim();
  if (!trimmedReason) {
    throw new Error("Reason is required");
  }
  if (
    (collection.status === "archived" || collection.status === "deleted") &&
    (collection.archivedReason ?? collection.deletedReason) === trimmedReason
  ) {
    return;
  }
  if (collection.status === "archived" || collection.status === "deleted") {
    throw new Error("Object is already withdrawn");
  }
  if (collection.status === "deaccessioned") {
    throw new Error(
      "Deaccessioned objects cannot be withdrawn as catalog records",
    );
  }

  await assertCollectionNotOnLoan(
    ctx,
    collection._id,
    "Cannot archive an object that is currently on loan",
  );
  await assertEntryAllowsStatus(ctx, collection._id, targetStatus);
  await assertNotInTransfer(ctx, collection, targetStatus);

  await Promise.all([
    applyCollectionDisposition(ctx, {
      collectionId: collection._id,
      changedBy: userId,
      targetStatus,
      reason: trimmedReason,
    }),
    ctx.runMutation(internal.audit.logAction, {
      organizationId: collection.organizationId,
      userId,
      action:
        targetStatus === "archived"
          ? "archived_collection"
          : "deleted_collection",
      entityType: "collection",
      entityId: collection._id,
      changes: {
        reason: trimmedReason,
        accessionNumber: collection.accessionNumber,
        title: collection.title,
      },
    }),
  ] as const);
}

export async function restoreCollectionHandler(
  ctx: MutationCtx,
  args: { collectionId: Id<"collections"> },
) {
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

  await requirePermission(ctx, collection.organizationId, "collections.update");
  await restoreObject(ctx, collection, userId);
  return null;
}

/**
 * Brings one withdrawn Object back to the collection. Shared by the single
 * restore and the bulk status change; callers check the permission first.
 */
export async function restoreObject(
  ctx: MutationCtx,
  collection: Doc<"collections">,
  userId: Id<"users">,
) {
  if (collection.status !== "archived" && collection.status !== "deleted") {
    throw new Error("Can only restore archived or deleted objects");
  }

  await assertCollectionNotOnLoan(
    ctx,
    collection._id,
    "An object with an active loan cannot be restored",
  );
  await assertEntryAllowsStatus(ctx, collection._id, "active");

  const [activeIdentity, pendingDeaccession, conflictingApprovedDeaccession] =
    await Promise.all([
      ctx.db
        .query("collections")
        .withIndex("by_organization_and_accessionNumber", (q) =>
          q
            .eq("organizationId", collection.organizationId)
            .eq("accessionNumber", collection.accessionNumber),
        )
        .collect()
        .then((records) =>
          records.find((record) => record.status === "active"),
        ),
      ctx.db
        .query("deaccessions")
        .withIndex("by_organization_and_collection_and_status", (q) =>
          q
            .eq("organizationId", collection.organizationId)
            .eq("collectionId", collection._id)
            .eq("status", "pending"),
        )
        .first(),
      ctx.db
        .query("deaccessions")
        .withIndex("by_organization_and_collection_and_status", (q) =>
          q
            .eq("organizationId", collection.organizationId)
            .eq("collectionId", collection._id)
            .eq("status", "approved"),
        )
        .collect()
        .then(async (decisions) => {
          for (const decision of decisions) {
            if (
              isDisposalDecision(decision) &&
              (await isOpenDeaccession(ctx, decision))
            )
              return decision;
          }
          return undefined;
        }),
    ] as const);
  if (activeIdentity && activeIdentity._id !== collection._id) {
    throw new Error("An active object already uses this accession number");
  }
  if (pendingDeaccession || conflictingApprovedDeaccession) {
    throw new Error(
      "A linked deaccession decision must be resolved before restore",
    );
  }

  await Promise.all([
    markCollectionActive(ctx, {
      collectionId: collection._id,
      changedBy: userId,
      clearDisposition: true,
    }),
    ctx.runMutation(internal.audit.logAction, {
      organizationId: collection.organizationId,
      userId,
      action: "restored_collection",
      entityType: "collection",
      entityId: collection._id,
      changes: {
        previousStatus: collection.status,
        accessionNumber: collection.accessionNumber,
        title: collection.title,
        withdrawalReason: collection.archivedReason ?? collection.deletedReason,
        withdrawnAt: collection.archivedAt ?? collection.deletedAt,
        withdrawnBy: collection.archivedBy ?? collection.deletedBy,
      },
    }),
  ] as const);
}
