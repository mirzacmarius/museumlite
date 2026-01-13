import { v } from "convex/values";
import { query } from "./_generated/server";
import { requirePermission } from "./utils/permissions";

function startOfDay(date: Date): number {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  ).getTime();
}

function addDays(timestamp: number, days: number): number {
  return timestamp + days * 24 * 60 * 60 * 1000;
}

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

export const getOperationalKpis = query({
  args: {
    organizationId: v.id("organizations"),
  },
  returns: v.object({
    inventory: v.object({
      totalValue: v.number(),
      fineArt: v.object({
        totalValue: v.number(),
        itemCount: v.number(),
        valuedCount: v.number(),
      }),
      wine: v.object({
        totalValue: v.number(),
        itemCount: v.number(),
        valuedCount: v.number(),
      }),
      vehicles: v.object({
        totalValue: v.number(),
        itemCount: v.number(),
        valuedCount: v.number(),
      }),
    }),
    loans: v.object({
      overdue: v.number(),
      dueToday: v.number(),
      dueNext7Days: v.number(),
      dueNext30Days: v.number(),
      upcomingReturns: v.array(
        v.object({
          id: v.string(),
          loanNumber: v.string(),
          lenderBorrowerName: v.string(),
          type: v.union(v.literal("incoming"), v.literal("outgoing")),
          endDate: v.number(),
          daysRemaining: v.number(),
          status: v.string(),
        }),
      ),
    }),
    exhibitions: v.object({
      proposed: v.number(),
      approved: v.number(),
      active: v.number(),
      closed: v.number(),
      rejected: v.number(),
      upcomingStarts: v.array(
        v.object({
          id: v.string(),
          title: v.string(),
          location: v.optional(v.string()),
          startDate: v.number(),
          endDate: v.optional(v.number()),
          status: v.optional(v.string()),
          daysUntilStart: v.number(),
        }),
      ),
      activeNow: v.array(
        v.object({
          id: v.string(),
          title: v.string(),
          location: v.optional(v.string()),
          startDate: v.number(),
          endDate: v.optional(v.number()),
        }),
      ),
    }),
    generatedAt: v.number(),
  }),
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.organizationId, "collections.read");

    const now = Date.now();
    const todayStart = startOfDay(new Date());
    const todayEnd = addDays(todayStart, 1);
    const next7Days = addDays(todayStart, 7);
    const next30Days = addDays(todayStart, 30);

    const fineArtDetails = await ctx.db
      .query("fineArtDetails")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .collect();

    const fineArtValuation = fineArtDetails.reduce(
      (acc, item) => {
        acc.itemCount++;
        if (item.appraisedValue != null && item.appraisedValue > 0) {
          acc.valuedCount++;
          acc.totalValue += item.appraisedValue;
        }
        return acc;
      },
      { totalValue: 0, itemCount: 0, valuedCount: 0 },
    );

    const wineDetails = await ctx.db
      .query("wineDetails")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .collect();

    const wineValuation = wineDetails.reduce(
      (acc, item) => {
        acc.itemCount++;
        if (item.currentValue != null && item.currentValue > 0) {
          acc.valuedCount++;
          const quantity = item.quantity ?? 1;
          acc.totalValue += item.currentValue * quantity;
        }
        return acc;
      },
      { totalValue: 0, itemCount: 0, valuedCount: 0 },
    );

    const vehicleDetails = await ctx.db
      .query("vehicleDetails")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .collect();

    const vehicleValuation = vehicleDetails.reduce(
      (acc, item) => {
        acc.itemCount++;
        if (item.insuranceValue != null && item.insuranceValue > 0) {
          acc.valuedCount++;
          acc.totalValue += item.insuranceValue;
        }
        return acc;
      },
      { totalValue: 0, itemCount: 0, valuedCount: 0 },
    );

    const allLoans = await ctx.db
      .query("loans")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .collect();

    const activeLoans = allLoans.filter(
      (l) => l.status === "active" || l.status === "dispatched",
    );

    const loanBuckets = activeLoans.reduce(
      (acc, loan) => {
        if (!loan.endDate) return acc;
        if (loan.endDate < todayStart) {
          acc.overdue++;
        } else if (loan.endDate >= todayStart && loan.endDate < todayEnd) {
          acc.dueToday++;
        } else if (loan.endDate >= todayEnd && loan.endDate < next7Days) {
          acc.dueNext7Days++;
        } else if (loan.endDate >= next7Days && loan.endDate < next30Days) {
          acc.dueNext30Days++;
        }
        return acc;
      },
      { overdue: 0, dueToday: 0, dueNext7Days: 0, dueNext30Days: 0 },
    );

    const upcomingReturns = activeLoans
      .filter((l) => l.endDate != null)
      .sort((a, b) => (a.endDate ?? 0) - (b.endDate ?? 0))
      .slice(0, 10)
      .map((loan) => ({
        id: loan._id,
        loanNumber: loan.loanNumber,
        lenderBorrowerName: loan.lenderBorrowerName,
        type: loan.type,
        endDate: loan.endDate as number,
        daysRemaining: Math.ceil(
          ((loan.endDate as number) - now) / (24 * 60 * 60 * 1000),
        ),
        status: loan.status,
      }));

    const allExhibitions = await ctx.db
      .query("exhibitions")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .collect();

    const exhibitionsByStatus = allExhibitions.reduce(
      (acc, exhibition) => {
        const status = exhibition.status ?? "proposed";
        if (status === "proposed") acc.proposed++;
        else if (status === "approved") acc.approved++;
        else if (status === "active") acc.active++;
        else if (status === "closed") acc.closed++;
        else if (status === "rejected") acc.rejected++;
        return acc;
      },
      { proposed: 0, approved: 0, active: 0, closed: 0, rejected: 0 },
    );

    const upcomingExhibitions = allExhibitions
      .filter(
        (e) =>
          e.startDate > now &&
          (e.status === "proposed" || e.status === "approved"),
      )
      .sort((a, b) => a.startDate - b.startDate)
      .slice(0, 10)
      .map((e) => ({
        id: e._id,
        title: e.title,
        location: e.location,
        startDate: e.startDate,
        endDate: e.endDate,
        status: e.status,
        daysUntilStart: Math.ceil((e.startDate - now) / (24 * 60 * 60 * 1000)),
      }));

    const activeExhibitions = allExhibitions
      .filter(
        (e) =>
          e.status === "active" ||
          e.isCurrent ||
          (e.startDate <= now && (e.endDate == null || e.endDate >= now)),
      )
      .slice(0, 10)
      .map((e) => ({
        id: e._id,
        title: e.title,
        location: e.location,
        startDate: e.startDate,
        endDate: e.endDate,
      }));

    return {
      inventory: {
        totalValue:
          fineArtValuation.totalValue +
          wineValuation.totalValue +
          vehicleValuation.totalValue,
        fineArt: fineArtValuation,
        wine: wineValuation,
        vehicles: vehicleValuation,
      },
      loans: {
        ...loanBuckets,
        upcomingReturns,
      },
      exhibitions: {
        ...exhibitionsByStatus,
        upcomingStarts: upcomingExhibitions,
        activeNow: activeExhibitions,
      },
      generatedAt: now,
    };
  },
});
