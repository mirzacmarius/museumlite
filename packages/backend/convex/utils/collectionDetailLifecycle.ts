import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import {
  COLLECTION_DETAIL_LIFECYCLE_MODULES,
  type CollectionModuleId,
} from "./moduleCatalog";

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
  await Promise.all(
    storageIds.map((storageId) =>
      storageId ? ctx.storage.delete(storageId) : Promise.resolve(),
    ),
  );
}

async function deleteFineArtDetails(
  ctx: MutationCtx,
  collectionId: Id<"collections">,
) {
  const fineArtDetails = await ctx.db
    .query("fineArtDetails")
    .withIndex("by_collection", (q) => q.eq("collectionId", collectionId))
    .collect();
  await Promise.all(
    fineArtDetails.map(async (detail) => {
      const provenanceDocumentIds =
        detail.provenanceChain?.flatMap((entry) => entry.documentIds ?? []) ??
        [];
      await Promise.all([
        deleteStorageIds(ctx, provenanceDocumentIds),
        ctx.db.delete(detail._id),
      ]);
    }),
  );
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
  await Promise.all(
    fineArtDetails.map((detail) =>
      ctx.db.patch(detail._id, { organizationId: targetOrganizationId }),
    ),
  );
}

async function deleteWineDetails(
  ctx: MutationCtx,
  collectionId: Id<"collections">,
) {
  const wineDetails = await ctx.db
    .query("wineDetails")
    .withIndex("by_collection", (q) => q.eq("collectionId", collectionId))
    .collect();
  await Promise.all(wineDetails.map((detail) => ctx.db.delete(detail._id)));
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
  await Promise.all(
    wineDetails.map((detail) =>
      ctx.db.patch(detail._id, { organizationId: targetOrganizationId }),
    ),
  );
}

async function deleteVehicleDetails(
  ctx: MutationCtx,
  collectionId: Id<"collections">,
) {
  const vehicleDetails = await ctx.db
    .query("vehicleDetails")
    .withIndex("by_collection", (q) => q.eq("collectionId", collectionId))
    .collect();
  await Promise.all(
    vehicleDetails.map(async (detail) => {
      const serviceDocumentIds =
        detail.serviceLog?.flatMap((entry) => entry.documentIds ?? []) ?? [];
      await Promise.all([
        deleteStorageIds(ctx, serviceDocumentIds),
        ctx.db.delete(detail._id),
      ]);
    }),
  );
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
  await Promise.all(
    vehicleDetails.map((detail) =>
      ctx.db.patch(detail._id, { organizationId: targetOrganizationId }),
    ),
  );
}

async function deleteNaturalHistoryDetails(
  ctx: MutationCtx,
  collectionId: Id<"collections">,
) {
  const naturalHistoryDetails = await ctx.db
    .query("naturalHistoryDetails")
    .withIndex("by_collection", (q) => q.eq("collectionId", collectionId))
    .collect();
  await Promise.all(
    naturalHistoryDetails.map((detail) => ctx.db.delete(detail._id)),
  );
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
  await Promise.all(
    naturalHistoryDetails.map((detail) =>
      ctx.db.patch(detail._id, { organizationId: targetOrganizationId }),
    ),
  );
}

async function deleteArchiveDetails(
  ctx: MutationCtx,
  collectionId: Id<"collections">,
) {
  const archiveDetails = await ctx.db
    .query("archiveDetails")
    .withIndex("by_collection", (q) => q.eq("collectionId", collectionId))
    .collect();
  await Promise.all(archiveDetails.map((detail) => ctx.db.delete(detail._id)));
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
  await Promise.all(
    archiveDetails.map((detail) =>
      ctx.db.patch(detail._id, { organizationId: targetOrganizationId }),
    ),
  );
}

async function deleteCoinsStampsDetails(
  ctx: MutationCtx,
  collectionId: Id<"collections">,
) {
  const coinsStampsDetails = await ctx.db
    .query("coinsStampsDetails")
    .withIndex("by_collection", (q) => q.eq("collectionId", collectionId))
    .collect();
  await Promise.all(
    coinsStampsDetails.map((detail) => ctx.db.delete(detail._id)),
  );
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
  await Promise.all(
    coinsStampsDetails.map((detail) =>
      ctx.db.patch(detail._id, { organizationId: targetOrganizationId }),
    ),
  );
}

const collectionDetailLifecycleAdapterByModule = {
  fine_art: {
    moduleId: "fine_art",
    deleteRecords: deleteFineArtDetails,
    moveRecords: moveFineArtDetails,
  },
  wine: {
    moduleId: "wine",
    deleteRecords: deleteWineDetails,
    moveRecords: moveWineDetails,
  },
  automotive: {
    moduleId: "automotive",
    deleteRecords: deleteVehicleDetails,
    moveRecords: moveVehicleDetails,
  },
  natural_history: {
    moduleId: "natural_history",
    deleteRecords: deleteNaturalHistoryDetails,
    moveRecords: moveNaturalHistoryDetails,
  },
  archive: {
    moduleId: "archive",
    deleteRecords: deleteArchiveDetails,
    moveRecords: moveArchiveDetails,
  },
  coins_stamps: {
    moduleId: "coins_stamps",
    deleteRecords: deleteCoinsStampsDetails,
    moveRecords: moveCoinsStampsDetails,
  },
} satisfies Record<CollectionModuleId, CollectionDetailLifecycleAdapter>;

const collectionDetailLifecycleAdapters =
  COLLECTION_DETAIL_LIFECYCLE_MODULES.map(
    (moduleId) => collectionDetailLifecycleAdapterByModule[moduleId],
  );

export async function deleteCollectionDetailRecords(
  ctx: MutationCtx,
  collectionId: Id<"collections">,
) {
  await Promise.all(
    collectionDetailLifecycleAdapters.map((adapter) =>
      adapter.deleteRecords(ctx, collectionId),
    ),
  );
}

export async function moveCollectionDetailRecords(
  ctx: MutationCtx,
  collectionId: Id<"collections">,
  targetOrganizationId: Id<"organizations">,
) {
  await Promise.all(
    collectionDetailLifecycleAdapters.map((adapter) =>
      adapter.moveRecords(ctx, collectionId, targetOrganizationId),
    ),
  );
}
