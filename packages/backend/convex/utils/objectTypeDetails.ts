import { type Infer, v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import {
  archiveDetailFields,
  coinsStampsDetailFields,
  fineArtDetailFields,
  naturalHistoryDetailFields,
  typeDetailRecordFields,
  vehicleDetailFields,
  wineDetailFields,
} from "./collectionTypeDetailFields";
import { hasModuleEnabled } from "./featureGates";
import { getCollectionTypeModuleRequirement } from "./moduleCatalog";

/** An Object's type details, tagged with the collection type they belong to. */
export const objectTypeDetailsValidator = v.union(
  v.object({
    collectionType: v.literal("fine_art"),
    details: v.object({
      _id: v.id("fineArtDetails"),
      _creationTime: v.number(),
      ...typeDetailRecordFields,
      ...fineArtDetailFields,
    }),
  }),
  v.object({
    collectionType: v.literal("wine"),
    details: v.object({
      _id: v.id("wineDetails"),
      _creationTime: v.number(),
      ...typeDetailRecordFields,
      ...wineDetailFields,
    }),
  }),
  v.object({
    collectionType: v.literal("automotive"),
    details: v.object({
      _id: v.id("vehicleDetails"),
      _creationTime: v.number(),
      ...typeDetailRecordFields,
      ...vehicleDetailFields,
    }),
  }),
  v.object({
    collectionType: v.literal("natural_history"),
    details: v.object({
      _id: v.id("naturalHistoryDetails"),
      _creationTime: v.number(),
      ...typeDetailRecordFields,
      ...naturalHistoryDetailFields,
    }),
  }),
  v.object({
    collectionType: v.literal("archive"),
    details: v.object({
      _id: v.id("archiveDetails"),
      _creationTime: v.number(),
      ...typeDetailRecordFields,
      ...archiveDetailFields,
    }),
  }),
  v.object({
    collectionType: v.literal("coins_stamps"),
    details: v.object({
      _id: v.id("coinsStampsDetails"),
      _creationTime: v.number(),
      ...typeDetailRecordFields,
      ...coinsStampsDetailFields,
    }),
  }),
);

export type ObjectTypeDetails = Infer<typeof objectTypeDetailsValidator>;

/**
 * The details recorded for the Object's own collection type, or null when it
 * has none or that type's Settings Module is off.
 */
export async function getObjectTypeDetails(
  ctx: QueryCtx,
  collection: Doc<"collections">,
): Promise<ObjectTypeDetails | null> {
  const moduleId = getCollectionTypeModuleRequirement(
    collection.collectionType,
  );
  if (
    !moduleId ||
    !(await hasModuleEnabled(ctx, collection.organizationId, moduleId))
  ) {
    return null;
  }

  switch (moduleId) {
    case "fine_art": {
      const details = await ctx.db
        .query("fineArtDetails")
        .withIndex("by_collection", (q) => q.eq("collectionId", collection._id))
        .unique();
      return details && { collectionType: moduleId, details };
    }
    case "wine": {
      const details = await ctx.db
        .query("wineDetails")
        .withIndex("by_collection", (q) => q.eq("collectionId", collection._id))
        .unique();
      return details && { collectionType: moduleId, details };
    }
    case "automotive": {
      const details = await ctx.db
        .query("vehicleDetails")
        .withIndex("by_collection", (q) => q.eq("collectionId", collection._id))
        .unique();
      return details && { collectionType: moduleId, details };
    }
    case "natural_history": {
      const details = await ctx.db
        .query("naturalHistoryDetails")
        .withIndex("by_collection", (q) => q.eq("collectionId", collection._id))
        .unique();
      return details && { collectionType: moduleId, details };
    }
    case "archive": {
      const details = await ctx.db
        .query("archiveDetails")
        .withIndex("by_collection", (q) => q.eq("collectionId", collection._id))
        .unique();
      return details && { collectionType: moduleId, details };
    }
    case "coins_stamps": {
      const details = await ctx.db
        .query("coinsStampsDetails")
        .withIndex("by_collection", (q) => q.eq("collectionId", collection._id))
        .unique();
      return details && { collectionType: moduleId, details };
    }
  }
}
