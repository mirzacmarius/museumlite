import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import {
  COLLECTION_DETAIL_LIFECYCLE_MODULES,
  type CollectionModuleId,
} from "./moduleCatalog";

interface CollectionDetailLifecycleAdapter {
  moduleId: CollectionModuleId;
  moveRecords: (
    ctx: MutationCtx,
    collectionId: Id<"collections">,
    targetOrganizationId: Id<"organizations">,
  ) => Promise<void>;
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
    moveRecords: moveFineArtDetails,
  },
  wine: {
    moduleId: "wine",
    moveRecords: moveWineDetails,
  },
  automotive: {
    moduleId: "automotive",
    moveRecords: moveVehicleDetails,
  },
  natural_history: {
    moduleId: "natural_history",
    moveRecords: moveNaturalHistoryDetails,
  },
  archive: {
    moduleId: "archive",
    moveRecords: moveArchiveDetails,
  },
  coins_stamps: {
    moduleId: "coins_stamps",
    moveRecords: moveCoinsStampsDetails,
  },
} satisfies Record<CollectionModuleId, CollectionDetailLifecycleAdapter>;

const collectionDetailLifecycleAdapters =
  COLLECTION_DETAIL_LIFECYCLE_MODULES.map(
    (moduleId) => collectionDetailLifecycleAdapterByModule[moduleId],
  );

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
