import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import {
  applyCollectionDisposition,
  markCollectionActive,
  markCollectionDeaccessioned,
} from "./collectionLifecycle";
import { assertCollectionNotOnLoan } from "./loanOccupancy";
import { requirePermission } from "./permissions";

export async function deleteCollectionHandler(
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

  await assertCollectionNotOnLoan(
    ctx,
    args.collectionId,
    "Cannot deaccession an object that is currently on loan",
  );

  await Promise.all([
    requirePermission(ctx, collection.organizationId, "collections.delete"),
    markCollectionDeaccessioned(ctx, {
      collectionId: args.collectionId,
      changedBy: userId,
    }),
    ctx.runMutation(internal.audit.logAction, {
      organizationId: collection.organizationId,
      userId,
      action: "deaccessioned_collection",
      entityType: "collection",
      entityId: args.collectionId,
      changes: {
        accessionNumber: collection.accessionNumber,
        title: collection.title,
        previousStatus: collection.status,
      },
    }),
  ] as const);

  return null;
}

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

  await assertCollectionNotOnLoan(
    ctx,
    args.collectionId,
    "Cannot archive an object that is currently on loan",
  );

  await requirePermission(ctx, collection.organizationId, "collections.delete");

  await Promise.all([
    applyCollectionDisposition(ctx, {
      collectionId: args.collectionId,
      changedBy: userId,
      targetStatus: "archived",
      reason: args.reason,
    }),
    ctx.runMutation(internal.audit.logAction, {
      organizationId: collection.organizationId,
      userId,
      action: "archived_collection",
      entityType: "collection",
      entityId: args.collectionId,
      changes: {
        reason: args.reason,
        accessionNumber: collection.accessionNumber,
        title: collection.title,
      },
    }),
  ] as const);

  return null;
}

export async function softDeleteCollectionHandler(
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

  await assertCollectionNotOnLoan(
    ctx,
    args.collectionId,
    "Cannot delete an object that is currently on loan",
  );

  await requirePermission(ctx, collection.organizationId, "collections.delete");

  await Promise.all([
    applyCollectionDisposition(ctx, {
      collectionId: args.collectionId,
      changedBy: userId,
      targetStatus: "deleted",
      reason: args.reason,
    }),
    ctx.runMutation(internal.audit.logAction, {
      organizationId: collection.organizationId,
      userId,
      action: "deleted_collection",
      entityType: "collection",
      entityId: args.collectionId,
      changes: {
        reason: args.reason,
        accessionNumber: collection.accessionNumber,
        title: collection.title,
      },
    }),
  ] as const);

  return null;
}

export async function countDeletedCollectionsHandler(
  ctx: QueryCtx,
  args: { organizationId: Id<"organizations"> },
) {
  const [, deletedCollections] = await Promise.all([
    requirePermission(ctx, args.organizationId, "collections.read"),
    ctx.db
      .query("collections")
      .withIndex("by_organization_and_status", (q) =>
        q.eq("organizationId", args.organizationId).eq("status", "deleted"),
      )
      .collect(),
  ] as const);

  return deletedCollections.length;
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

  if (collection.status !== "archived" && collection.status !== "deleted") {
    throw new Error("Can only restore archived or deleted objects");
  }

  await requirePermission(ctx, collection.organizationId, "collections.update");

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
      },
    }),
  ] as const);

  return null;
}
