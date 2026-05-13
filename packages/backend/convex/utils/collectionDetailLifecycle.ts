import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

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

export async function deleteCollectionDetailRecords(
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

  const wineDetails = await ctx.db
    .query("wineDetails")
    .withIndex("by_collection", (q) => q.eq("collectionId", collectionId))
    .collect();
  for (const detail of wineDetails) {
    await ctx.db.delete(detail._id);
  }

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

  const naturalHistoryDetails = await ctx.db
    .query("naturalHistoryDetails")
    .withIndex("by_collection", (q) => q.eq("collectionId", collectionId))
    .collect();
  for (const detail of naturalHistoryDetails) {
    await ctx.db.delete(detail._id);
  }

  const archiveDetails = await ctx.db
    .query("archiveDetails")
    .withIndex("by_collection", (q) => q.eq("collectionId", collectionId))
    .collect();
  for (const detail of archiveDetails) {
    await ctx.db.delete(detail._id);
  }

  const coinsStampsDetails = await ctx.db
    .query("coinsStampsDetails")
    .withIndex("by_collection", (q) => q.eq("collectionId", collectionId))
    .collect();
  for (const detail of coinsStampsDetails) {
    await ctx.db.delete(detail._id);
  }
}

export async function moveCollectionDetailRecords(
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

  const wineDetails = await ctx.db
    .query("wineDetails")
    .withIndex("by_collection", (q) => q.eq("collectionId", collectionId))
    .collect();
  for (const detail of wineDetails) {
    await ctx.db.patch(detail._id, { organizationId: targetOrganizationId });
  }

  const vehicleDetails = await ctx.db
    .query("vehicleDetails")
    .withIndex("by_collection", (q) => q.eq("collectionId", collectionId))
    .collect();
  for (const detail of vehicleDetails) {
    await ctx.db.patch(detail._id, { organizationId: targetOrganizationId });
  }

  const naturalHistoryDetails = await ctx.db
    .query("naturalHistoryDetails")
    .withIndex("by_collection", (q) => q.eq("collectionId", collectionId))
    .collect();
  for (const detail of naturalHistoryDetails) {
    await ctx.db.patch(detail._id, { organizationId: targetOrganizationId });
  }

  const archiveDetails = await ctx.db
    .query("archiveDetails")
    .withIndex("by_collection", (q) => q.eq("collectionId", collectionId))
    .collect();
  for (const detail of archiveDetails) {
    await ctx.db.patch(detail._id, { organizationId: targetOrganizationId });
  }

  const coinsStampsDetails = await ctx.db
    .query("coinsStampsDetails")
    .withIndex("by_collection", (q) => q.eq("collectionId", collectionId))
    .collect();
  for (const detail of coinsStampsDetails) {
    await ctx.db.patch(detail._id, { organizationId: targetOrganizationId });
  }
}
