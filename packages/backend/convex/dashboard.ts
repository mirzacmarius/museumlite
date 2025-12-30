import { v } from "convex/values";
import { query } from "./_generated/server";
import { requirePermission } from "./utils/permissions";

export const getAnalytics = query({
  args: {
    organizationId: v.id("organizations"),
  },
  returns: v.object({
    collections: v.object({
      total: v.number(),
    }),
    objects: v.object({
      total: v.number(),
      active: v.number(),
      loaned: v.number(),
      deaccessioned: v.number(),
    }),
    loans: v.object({
      total: v.number(),
      pending: v.number(),
      active: v.number(),
      returned: v.number(),
      incoming: v.number(),
      outgoing: v.number(),
    }),
    accessions: v.object({
      pending: v.number(),
      approved: v.number(),
      rejected: v.number(),
    }),
    deaccessions: v.object({
      pending: v.number(),
      approved: v.number(),
      rejected: v.number(),
    }),
    locations: v.object({
      total: v.number(),
    }),
    recentCollectionGroups: v.array(
      v.object({
        id: v.string(),
        name: v.string(),
        description: v.optional(v.string()),
        itemsCount: v.number(),
        imageUrl: v.optional(v.string()),
      }),
    ),
    recentObjects: v.array(
      v.object({
        id: v.string(),
        title: v.string(),
        accessionNumber: v.string(),
        objectType: v.optional(v.string()),
        status: v.string(),
        imageUrl: v.optional(v.string()),
      }),
    ),
    recentActivity: v.array(
      v.object({
        type: v.union(
          v.literal("collection"),
          v.literal("loan"),
          v.literal("accession"),
          v.literal("deaccession"),
        ),
        id: v.string(),
        title: v.string(),
        subtitle: v.optional(v.string()),
        timestamp: v.number(),
        status: v.optional(v.string()),
      }),
    ),
  }),
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.organizationId, "collections.read");

    // Get collection groups count (these are the "Collections")
    const allCollectionGroups = await ctx.db
      .query("collectionGroups")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .collect();

    const collectionsStats = {
      total: allCollectionGroups.length,
    };

    // Get objects counts by status (these are the actual collection objects)
    const allObjects = await ctx.db
      .query("collections")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .collect();

    const objectsStats = {
      total: allObjects.length,
      active: allObjects.filter((c) => c.status === "active").length,
      loaned: allObjects.filter((c) => c.status === "loaned").length,
      deaccessioned: allObjects.filter((c) => c.status === "deaccessioned")
        .length,
    };

    // Get loans counts
    const allLoans = await ctx.db
      .query("loans")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .collect();

    const loansStats = {
      total: allLoans.length,
      pending: allLoans.filter((l) => l.status === "pending").length,
      active: allLoans.filter((l) => l.status === "active").length,
      returned: allLoans.filter((l) => l.status === "returned").length,
      incoming: allLoans.filter((l) => l.type === "incoming").length,
      outgoing: allLoans.filter((l) => l.type === "outgoing").length,
    };

    // Get accessions counts
    const allAccessions = await ctx.db
      .query("accessions")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .collect();

    const accessionsStats = {
      pending: allAccessions.filter((a) => a.status === "pending").length,
      approved: allAccessions.filter((a) => a.status === "approved").length,
      rejected: allAccessions.filter((a) => a.status === "rejected").length,
    };

    // Get deaccessions counts
    const allDeaccessions = await ctx.db
      .query("deaccessions")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .collect();

    const deaccessionsStats = {
      pending: allDeaccessions.filter((d) => d.status === "pending").length,
      approved: allDeaccessions.filter((d) => d.status === "approved").length,
      rejected: allDeaccessions.filter((d) => d.status === "rejected").length,
    };

    // Get locations count
    const allLocations = await ctx.db
      .query("locations")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();

    // Get recent activity (last 10 items)
    const recentCollections = allObjects
      .sort((a, b) => b._creationTime - a._creationTime)
      .slice(0, 3)
      .map((c) => ({
        type: "collection" as const,
        id: c._id,
        title: c.title,
        subtitle: c.accessionNumber,
        timestamp: c._creationTime,
        status: c.status,
      }));

    const recentLoans = allLoans
      .sort((a, b) => b._creationTime - a._creationTime)
      .slice(0, 3)
      .map((l) => ({
        type: "loan" as const,
        id: l._id,
        title: l.loanNumber,
        subtitle: l.lenderBorrowerName,
        timestamp: l._creationTime,
        status: l.status,
      }));

    const recentAccessions = allAccessions
      .sort((a, b) => b.dateReceived - a.dateReceived)
      .slice(0, 2)
      .map((a) => ({
        type: "accession" as const,
        id: a._id,
        title: a.accessionNumber,
        subtitle: a.source,
        timestamp: a.dateReceived,
        status: a.status,
      }));

    const recentDeaccessions = allDeaccessions
      .sort((a, b) => b.dateDeaccessioned - a.dateDeaccessioned)
      .slice(0, 2)
      .map((d) => ({
        type: "deaccession" as const,
        id: d._id,
        title: d.deaccessionNumber,
        subtitle: d.reason,
        timestamp: d.dateDeaccessioned,
        status: d.status,
      }));

    // Combine and sort by timestamp
    const recentActivity = [
      ...recentCollections,
      ...recentLoans,
      ...recentAccessions,
      ...recentDeaccessions,
    ]
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 5);

    const recentGroups = allCollectionGroups
      .sort((a, b) => b._creationTime - a._creationTime)
      .slice(0, 4);

    const recentCollectionGroups = await Promise.all(
      recentGroups.map(async (group) => {
        const groupItem = await ctx.db
          .query("collectionGroupItems")
          .withIndex("by_collectionGroup", (q) =>
            q.eq("collectionGroupId", group._id),
          )
          .first();

        let imageUrl: string | undefined;
        if (groupItem) {
          const primaryMedia = await ctx.db
            .query("mediaFiles")
            .withIndex("by_collection", (q) =>
              q.eq("collectionId", groupItem.collectionId),
            )
            .filter((q) => q.eq(q.field("isPrimary"), true))
            .first();

          if (primaryMedia?.storageId) {
            const url = await ctx.storage.getUrl(primaryMedia.storageId);
            imageUrl = url ?? undefined;
          }
        }

        return {
          id: group._id,
          name: group.name,
          description: group.description,
          itemsCount: group.itemsCount ?? 0,
          imageUrl,
        };
      }),
    );

    const recentObjectsList = allObjects
      .sort((a, b) => b._creationTime - a._creationTime)
      .slice(0, 4);

    const recentObjects = await Promise.all(
      recentObjectsList.map(async (obj) => {
        const primaryMedia = await ctx.db
          .query("mediaFiles")
          .withIndex("by_collection", (q) => q.eq("collectionId", obj._id))
          .filter((q) => q.eq(q.field("isPrimary"), true))
          .first();

        let imageUrl: string | undefined;
        if (primaryMedia?.storageId) {
          const url = await ctx.storage.getUrl(primaryMedia.storageId);
          imageUrl = url ?? undefined;
        }

        return {
          id: obj._id,
          title: obj.title,
          accessionNumber: obj.accessionNumber,
          objectType: obj.objectType,
          status: obj.status,
          imageUrl,
        };
      }),
    );

    return {
      collections: collectionsStats,
      objects: objectsStats,
      loans: loansStats,
      accessions: accessionsStats,
      deaccessions: deaccessionsStats,
      locations: {
        total: allLocations.length,
      },
      recentCollectionGroups,
      recentObjects,
      recentActivity,
    };
  },
});
