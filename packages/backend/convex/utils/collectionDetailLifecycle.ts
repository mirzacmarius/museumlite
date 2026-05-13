import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import type { CollectionModuleId } from "./moduleCatalog";

interface CollectionDetailLifecycleAdapter {
  moduleId: CollectionModuleId;
  deleteRecords: (
    ctx: MutationCtx,
    collectionId: Id<"collections">,
  ) => Promise<void>;
  moveRecords: (
    ctx: MutationCtx,
    collectionId: Id<"collections">,
    targetOrganizationId: Id<"organizations">,
  ) => Promise<void>;
}

async function deleteStorageIds(
  ctx: MutationCtx,
  storageIds: Array<Id<"_storage"> | undefined>,
) {
  for (const storageId of storageIds) {
    if (storageId) {
      await ctx.storage.delete(storageId);
    }
  }
}

async function deleteFineArtDetails(
  ctx: MutationCtx,
  collectionId: Id<"collections">,
) {
  const fineArtDetails = await ctx.db
    .query("fineArtDetails")
    .withIndex("by_collection", (q) => q.eq("collectionId", collectionId))
    .collect();
  for (const detail of fineArtDetails) {
    const provenanceDocumentIds =
      detail.provenanceChain?.flatMap((entry) => entry.documentIds ?? []) ?? [];
    await deleteStorageIds(ctx, provenanceDocumentIds);
    await ctx.db.delete(detail._id);
  }
}

async function moveFineArtDetails(
  ctx: MutationCtx,
  collectionId: Id<"collections">,
  targetOrganizationId: Id<"organizations">,
) {
  const fineArtDetails = await ctx.db
    .query("fineArtDetails")
    .withIndex("by_collection", (q) => q.eq("collectionId", collectionId))
    .collect();
  for (const detail of fineArtDetails) {
    await ctx.db.patch(detail._id, { organizationId: targetOrganizationId });
  }
}

async function deleteWineDetails(
  ctx: MutationCtx,
  collectionId: Id<"collections">,
) {
  const wineDetails = await ctx.db
    .query("wineDetails")
    .withIndex("by_collection", (q) => q.eq("collectionId", collectionId))
    .collect();
  for (const detail of wineDetails) {
    await ctx.db.delete(detail._id);
  }
}

async function moveWineDetails(
  ctx: MutationCtx,
  collectionId: Id<"collections">,
  targetOrganizationId: Id<"organizations">,
) {
  const wineDetails = await ctx.db
    .query("wineDetails")
    .withIndex("by_collection", (q) => q.eq("collectionId", collectionId))
    .collect();
  for (const detail of wineDetails) {
    await ctx.db.patch(detail._id, { organizationId: targetOrganizationId });
  }
}

async function deleteVehicleDetails(
  ctx: MutationCtx,
  collectionId: Id<"collections">,
) {
  const vehicleDetails = await ctx.db
    .query("vehicleDetails")
    .withIndex("by_collection", (q) => q.eq("collectionId", collectionId))
    .collect();
  for (const detail of vehicleDetails) {
    const serviceDocumentIds =
      detail.serviceLog?.flatMap((entry) => entry.documentIds ?? []) ?? [];
    await deleteStorageIds(ctx, serviceDocumentIds);
    await ctx.db.delete(detail._id);
  }
}

async function moveVehicleDetails(
  ctx: MutationCtx,
  collectionId: Id<"collections">,
  targetOrganizationId: Id<"organizations">,
) {
  const vehicleDetails = await ctx.db
    .query("vehicleDetails")
    .withIndex("by_collection", (q) => q.eq("collectionId", collectionId))
    .collect();
  for (const detail of vehicleDetails) {
    await ctx.db.patch(detail._id, { organizationId: targetOrganizationId });
  }
}

async function deleteNaturalHistoryDetails(
  ctx: MutationCtx,
  collectionId: Id<"collections">,
) {
  const naturalHistoryDetails = await ctx.db
    .query("naturalHistoryDetails")
    .withIndex("by_collection", (q) => q.eq("collectionId", collectionId))
    .collect();
  for (const detail of naturalHistoryDetails) {
    await ctx.db.delete(detail._id);
  }
}

async function moveNaturalHistoryDetails(
  ctx: MutationCtx,
  collectionId: Id<"collections">,
  targetOrganizationId: Id<"organizations">,
) {
  const naturalHistoryDetails = await ctx.db
    .query("naturalHistoryDetails")
    .withIndex("by_collection", (q) => q.eq("collectionId", collectionId))
    .collect();
  for (const detail of naturalHistoryDetails) {
    await ctx.db.patch(detail._id, { organizationId: targetOrganizationId });
  }
}

async function deleteArchiveDetails(
  ctx: MutationCtx,
  collectionId: Id<"collections">,
) {
  const archiveDetails = await ctx.db
    .query("archiveDetails")
    .withIndex("by_collection", (q) => q.eq("collectionId", collectionId))
    .collect();
  for (const detail of archiveDetails) {
    await ctx.db.delete(detail._id);
  }
}

async function moveArchiveDetails(
  ctx: MutationCtx,
  collectionId: Id<"collections">,
  targetOrganizationId: Id<"organizations">,
) {
  const archiveDetails = await ctx.db
    .query("archiveDetails")
    .withIndex("by_collection", (q) => q.eq("collectionId", collectionId))
    .collect();
  for (const detail of archiveDetails) {
    await ctx.db.patch(detail._id, { organizationId: targetOrganizationId });
  }
}

async function deleteCoinsStampsDetails(
  ctx: MutationCtx,
  collectionId: Id<"collections">,
) {
  const coinsStampsDetails = await ctx.db
    .query("coinsStampsDetails")
    .withIndex("by_collection", (q) => q.eq("collectionId", collectionId))
    .collect();
  for (const detail of coinsStampsDetails) {
    await ctx.db.delete(detail._id);
  }
}

async function moveCoinsStampsDetails(
  ctx: MutationCtx,
  collectionId: Id<"collections">,
  targetOrganizationId: Id<"organizations">,
) {
  const coinsStampsDetails = await ctx.db
    .query("coinsStampsDetails")
    .withIndex("by_collection", (q) => q.eq("collectionId", collectionId))
    .collect();
  for (const detail of coinsStampsDetails) {
    await ctx.db.patch(detail._id, { organizationId: targetOrganizationId });
  }
}

const collectionDetailLifecycleAdapters: ReadonlyArray<CollectionDetailLifecycleAdapter> =
  [
    {
      moduleId: "fine_art",
      deleteRecords: deleteFineArtDetails,
      moveRecords: moveFineArtDetails,
    },
    {
      moduleId: "wine",
      deleteRecords: deleteWineDetails,
      moveRecords: moveWineDetails,
    },
    {
      moduleId: "automotive",
      deleteRecords: deleteVehicleDetails,
      moveRecords: moveVehicleDetails,
    },
    {
      moduleId: "natural_history",
      deleteRecords: deleteNaturalHistoryDetails,
      moveRecords: moveNaturalHistoryDetails,
    },
    {
      moduleId: "archive",
      deleteRecords: deleteArchiveDetails,
      moveRecords: moveArchiveDetails,
    },
    {
      moduleId: "coins_stamps",
      deleteRecords: deleteCoinsStampsDetails,
      moveRecords: moveCoinsStampsDetails,
    },
  ];

export const COLLECTION_DETAIL_LIFECYCLE_MODULES =
  collectionDetailLifecycleAdapters.map((adapter) => adapter.moduleId);

export async function deleteCollectionDetailRecords(
  ctx: MutationCtx,
  collectionId: Id<"collections">,
) {
  for (const adapter of collectionDetailLifecycleAdapters) {
    await adapter.deleteRecords(ctx, collectionId);
  }
}

export async function moveCollectionDetailRecords(
  ctx: MutationCtx,
  collectionId: Id<"collections">,
  targetOrganizationId: Id<"organizations">,
) {
  for (const adapter of collectionDetailLifecycleAdapters) {
    await adapter.moveRecords(ctx, collectionId, targetOrganizationId);
  }
}
