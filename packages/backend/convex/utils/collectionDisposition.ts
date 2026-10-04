import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import {
  applyCollectionDisposition,
  markCollectionActive,
} from "./collectionLifecycle";
import { assertCollectionNotOnLoan } from "./loanOccupancy";
import { requirePermission } from "./permissions";

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
  if (!args.reason.trim()) {
    throw new Error("Reason is required");
  }
  if (
    (collection.status === "archived" || collection.status === "deleted") &&
    (collection.archivedReason ?? collection.deletedReason) ===
      args.reason.trim()
  ) {
    return null;
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
    args.collectionId,
    "Cannot archive an object that is currently on loan",
  );

  await Promise.all([
    applyCollectionDisposition(ctx, {
      collectionId: args.collectionId,
      changedBy: userId,
      targetStatus: "archived",
      reason: args.reason.trim(),
    }),
    ctx.runMutation(internal.audit.logAction, {
      organizationId: collection.organizationId,
      userId,
      action: "archived_collection",
      entityType: "collection",
      entityId: args.collectionId,
      changes: {
        reason: args.reason.trim(),
        accessionNumber: collection.accessionNumber,
        title: collection.title,
      },
    }),
  ] as const);

  return null;
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

  if (collection.status !== "archived" && collection.status !== "deleted") {
    throw new Error("Can only restore archived or deleted objects");
  }

  await assertCollectionNotOnLoan(
    ctx,
    args.collectionId,
    "An object with an active loan cannot be restored",
  );

  const [activeIdentity, pendingDeaccession, conflictingApprovedDeaccession] =
    await Promise.all([
      ctx.db
        .query("collections")
        .withIndex("by_organization_and_accessionNumber", (q) =>
          q
            .eq("organizationId", collection.organizationId)
            .eq("accessionNumber", collection.accessionNumber),
        )
        .filter((q) => q.eq(q.field("status"), "active"))
        .first(),
      ctx.db
        .query("deaccessions")
        .withIndex("by_organization_and_collection_and_status", (q) =>
          q
            .eq("organizationId", collection.organizationId)
            .eq("collectionId", args.collectionId)
            .eq("status", "pending"),
        )
        .first(),
      ctx.db
        .query("deaccessions")
        .withIndex("by_organization_and_collection_and_status", (q) =>
          q
            .eq("organizationId", collection.organizationId)
            .eq("collectionId", args.collectionId)
            .eq("status", "approved"),
        )
        .filter((q) => q.neq(q.field("targetCollectionStatus"), "archived"))
        .first(),
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
      collectionId: args.collectionId,
      changedBy: userId,
      clearDisposition: true,
    }),
    ctx.runMutation(internal.audit.logAction, {
      organizationId: collection.organizationId,
      userId,
      action: "restored_collection",
      entityType: "collection",
      entityId: args.collectionId,
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

  return null;
}
