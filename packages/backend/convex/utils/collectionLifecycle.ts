import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

export type CollectionDispositionStatus =
  | "deaccessioned"
  | "archived"
  | "deleted";

function lifecycleTimestamp(timestamp: number | undefined) {
  return timestamp ?? Date.now();
}

export async function markCollectionLoaned(
  ctx: MutationCtx,
  {
    changedAt,
    changedBy,
    clearLocation = false,
    collectionId,
  }: {
    collectionId: Id<"collections">;
    changedBy: Id<"users">;
    changedAt?: number;
    clearLocation?: boolean;
  },
) {
  const timestamp = lifecycleTimestamp(changedAt);
  const patch = clearLocation
    ? {
        status: "loaned" as const,
        currentLocationId: undefined,
        lastModifiedBy: changedBy,
        lastModifiedAt: timestamp,
      }
    : {
        status: "loaned" as const,
        lastModifiedBy: changedBy,
        lastModifiedAt: timestamp,
      };

  await ctx.db.patch(collectionId, patch);
}

export async function markCollectionActive(
  ctx: MutationCtx,
  {
    changedAt,
    changedBy,
    clearDisposition = false,
    collectionId,
  }: {
    collectionId: Id<"collections">;
    changedBy: Id<"users">;
    changedAt?: number;
    clearDisposition?: boolean;
  },
) {
  const timestamp = lifecycleTimestamp(changedAt);
  const patch = clearDisposition
    ? {
        status: "active" as const,
        archivedAt: undefined,
        archivedBy: undefined,
        archivedReason: undefined,
        deletedAt: undefined,
        deletedBy: undefined,
        deletedReason: undefined,
        lastModifiedBy: changedBy,
        lastModifiedAt: timestamp,
      }
    : {
        status: "active" as const,
        lastModifiedBy: changedBy,
        lastModifiedAt: timestamp,
      };

  await ctx.db.patch(collectionId, patch);
}

export async function markCollectionDeaccessioned(
  ctx: MutationCtx,
  {
    changedAt,
    changedBy,
    collectionId,
    displayStatus,
  }: {
    collectionId: Id<"collections">;
    changedBy: Id<"users">;
    changedAt?: number;
    displayStatus?: string;
  },
) {
  await ctx.db.patch(collectionId, {
    status: "deaccessioned",
    displayStatus,
    lastModifiedBy: changedBy,
    lastModifiedAt: lifecycleTimestamp(changedAt),
  });
}

export async function applyCollectionDisposition(
  ctx: MutationCtx,
  {
    changedAt,
    changedBy,
    collectionId,
    reason,
    targetStatus,
  }: {
    collectionId: Id<"collections">;
    changedBy: Id<"users">;
    targetStatus: CollectionDispositionStatus;
    reason?: string;
    changedAt?: number;
  },
) {
  const timestamp = lifecycleTimestamp(changedAt);

  if (targetStatus === "archived") {
    await ctx.db.patch(collectionId, {
      status: "archived",
      archivedAt: timestamp,
      archivedBy: changedBy,
      archivedReason: reason,
      deletedAt: undefined,
      deletedBy: undefined,
      deletedReason: undefined,
      lastModifiedBy: changedBy,
      lastModifiedAt: timestamp,
    });
    return;
  }

  if (targetStatus === "deleted") {
    await ctx.db.patch(collectionId, {
      status: "deleted",
      deletedAt: timestamp,
      deletedBy: changedBy,
      deletedReason: reason,
      archivedAt: undefined,
      archivedBy: undefined,
      archivedReason: undefined,
      lastModifiedBy: changedBy,
      lastModifiedAt: timestamp,
    });
    return;
  }

  await markCollectionDeaccessioned(ctx, {
    collectionId,
    changedBy,
    changedAt: timestamp,
  });
}

export function canRestoreRejectedDisposition(
  collection: Doc<"collections">,
  targetStatus: CollectionDispositionStatus,
) {
  return (
    collection.status === targetStatus ||
    collection.status === "archived" ||
    collection.status === "deleted" ||
    collection.status === "deaccessioned"
  );
}
