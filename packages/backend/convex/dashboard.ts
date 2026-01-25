import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { query } from "./_generated/server";
import { requireFeatureAccess } from "./utils/featureGates";
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
      onDisplay: v.number(),
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
        storageLocation: v.optional(v.string()),
        valuation: v.optional(v.number()),
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
    await requirePermission(
      ctx,
      args.organizationId,
      "organization.view_analytics",
    );

    const collectionGroups = await ctx.db
      .query("collectionGroups")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .collect();

    const collections = await ctx.db
      .query("collections")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .collect();

    const loans = await ctx.db
      .query("loans")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .collect();

    const accessions = await ctx.db
      .query("accessions")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .collect();

    const deaccessions = await ctx.db
      .query("deaccessions")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .collect();

    const locations = await ctx.db
      .query("locations")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .collect();

    const recentCollectionGroups = await Promise.all(
      [...collectionGroups]
        .sort((a, b) => b._creationTime - a._creationTime)
        .slice(0, 4)
        .map(async (group) => {
          const imageUrl = group.imageId
            ? (await ctx.storage.getUrl(group.imageId)) ?? undefined
            : undefined;
          return {
            id: group._id,
            name: group.name,
            description: group.description,
            itemsCount: group.itemsCount ?? 0,
            imageUrl,
            storageLocation: group.storageLocation,
            valuation: group.valuation,
          };
        }),
    );

    const recentObjects = await Promise.all(
      [...collections]
        .sort((a, b) => b._creationTime - a._creationTime)
        .slice(0, 6)
        .map(async (collection) => {
          const primaryMedia = await ctx.db
            .query("mediaFiles")
            .withIndex("by_collection", (q) =>
              q.eq("collectionId", collection._id),
            )
            .filter((q) => q.eq(q.field("isPrimary"), true))
            .first();

          const imageUrl = primaryMedia?.storageId
            ? (await ctx.storage.getUrl(primaryMedia.storageId)) ?? undefined
            : undefined;

          return {
            id: collection._id,
            title: collection.title,
            accessionNumber: collection.accessionNumber,
            objectType: collection.objectType,
            status: collection.status,
            imageUrl,
          };
        }),
    );

    const recentActivity = await Promise.all(
      [
        ...(await ctx.db
          .query("auditLog")
          .withIndex("by_organization", (q) =>
            q.eq("organizationId", args.organizationId),
          )
          .collect()),
      ]
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, 12)
        .map(async (event) => {
          let type: "collection" | "loan" | "accession" | "deaccession" =
            "collection";

          if (event.entityType.includes("loan")) {
            type = "loan";
          } else if (event.entityType.includes("accession")) {
            type = "accession";
          } else if (event.entityType.includes("deaccession")) {
            type = "deaccession";
          } else if (event.entityType.includes("collection")) {
            type = "collection";
          }

          let title = event.entityType;
          let subtitle: string | undefined = event.action;
          let status: string | undefined;

          // Helper to validate if a string looks like a valid Convex ID
          const isValidConvexId = (id: string): boolean => {
            // Convex IDs are base64url encoded, typically 32+ characters
            // and contain only alphanumeric, underscore, and hyphen
            return id != null && id.length >= 20 && /^[a-zA-Z0-9_-]+$/.test(id);
          };

          if (type === "collection") {
            if (isValidConvexId(event.entityId)) {
              try {
                const collectionId =
                  event.entityId as unknown as Id<"collections">;
                const collection = await ctx.db.get(collectionId);
                title = collection?.title ?? event.entityType;
                subtitle = collection?.accessionNumber ?? event.action;
                status = collection?.status;
              } catch {
                // Invalid ID or entity not found, use defaults
              }
            }
          } else if (type === "loan") {
            if (isValidConvexId(event.entityId)) {
              try {
                const loanId = event.entityId as unknown as Id<"loans">;
                const loan = await ctx.db.get(loanId);
                title = loan?.loanNumber ?? event.entityType;
                subtitle = loan?.lenderBorrowerName ?? event.action;
                status = loan?.status;
              } catch {
                // Invalid ID or entity not found, use defaults
              }
            }
          } else if (type === "accession") {
            if (isValidConvexId(event.entityId)) {
              try {
                const accessionId =
                  event.entityId as unknown as Id<"accessions">;
                const accession = await ctx.db.get(accessionId);
                title = accession?.accessionNumber ?? event.entityType;
                subtitle = accession?.source ?? event.action;
                status = accession?.status;
              } catch {
                // Invalid ID or entity not found, use defaults
              }
            }
          } else if (type === "deaccession") {
            if (isValidConvexId(event.entityId)) {
              try {
                const deaccessionId =
                  event.entityId as unknown as Id<"deaccessions">;
                const deaccession = await ctx.db.get(deaccessionId);
                title = deaccession?.deaccessionNumber ?? event.entityType;
                subtitle = deaccession?.reason ?? event.action;
                status = deaccession?.status;
              } catch {
                // Invalid ID or entity not found, use defaults
              }
            }
          }

          return {
            type,
            id: event.entityId,
            title,
            subtitle,
            timestamp: event.timestamp,
            status,
          };
        }),
    );

    return {
      collections: {
        total: collectionGroups.length,
      },
      objects: {
        total: collections.length,
        active: collections.filter((c) => c.status === "active").length,
        loaned: collections.filter((c) => c.status === "loaned").length,
        deaccessioned: collections.filter((c) => c.status === "deaccessioned")
          .length,
        onDisplay: collections.filter((c) => c.displayStatus === "on_display")
          .length,
      },
      loans: {
        total: loans.length,
        pending: loans.filter((l) => l.status === "pending").length,
        active: loans.filter((l) => l.status === "active").length,
        returned: loans.filter((l) => l.status === "returned").length,
        incoming: loans.filter((l) => l.type === "incoming").length,
        outgoing: loans.filter((l) => l.type === "outgoing").length,
      },
      accessions: {
        pending: accessions.filter((a) => a.status === "pending").length,
        approved: accessions.filter((a) => a.status === "approved").length,
        rejected: accessions.filter((a) => a.status === "rejected").length,
      },
      deaccessions: {
        pending: deaccessions.filter((d) => d.status === "pending").length,
        approved: deaccessions.filter((d) => d.status === "approved").length,
        rejected: deaccessions.filter((d) => d.status === "rejected").length,
      },
      locations: {
        total: locations.length,
      },
      recentCollectionGroups,
      recentObjects,
      recentActivity,
    };
  },
});

export const getComplianceReport = query({
  args: {
    organizationId: v.id("organizations"),
    dateRangeStart: v.optional(v.number()),
    dateRangeEnd: v.optional(v.number()),
  },
  returns: v.object({
    accessions: v.object({
      total: v.number(),
      pending: v.number(),
      approved: v.number(),
      rejected: v.number(),
      pendingApprovals: v.array(
        v.object({
          id: v.string(),
          accessionNumber: v.string(),
          source: v.string(),
          dateReceived: v.number(),
          method: v.string(),
          assignedToName: v.optional(v.string()),
          workflowStep: v.optional(v.number()),
        }),
      ),
      recentApprovals: v.array(
        v.object({
          id: v.string(),
          accessionNumber: v.string(),
          source: v.string(),
          approvedAt: v.number(),
          approvedByName: v.string(),
          status: v.string(),
        }),
      ),
    }),
    deaccessions: v.object({
      total: v.number(),
      pending: v.number(),
      approved: v.number(),
      rejected: v.number(),
      pendingApprovals: v.array(
        v.object({
          id: v.string(),
          deaccessionNumber: v.string(),
          reason: v.string(),
          method: v.string(),
          dateDeaccessioned: v.number(),
          workflowStep: v.optional(v.number()),
        }),
      ),
      recentApprovals: v.array(
        v.object({
          id: v.string(),
          deaccessionNumber: v.string(),
          reason: v.string(),
          approvedAt: v.number(),
          approvedByName: v.string(),
          status: v.string(),
          proceedsAmount: v.optional(v.number()),
        }),
      ),
    }),
    auditTrail: v.object({
      totalEvents: v.number(),
      recentEvents: v.array(
        v.object({
          id: v.string(),
          action: v.string(),
          entityType: v.string(),
          entityId: v.string(),
          userName: v.string(),
          timestamp: v.number(),
        }),
      ),
      eventsByType: v.array(
        v.object({
          entityType: v.string(),
          count: v.number(),
        }),
      ),
      eventsByUser: v.array(
        v.object({
          userId: v.string(),
          userName: v.string(),
          count: v.number(),
        }),
      ),
    }),
    generatedAt: v.number(),
  }),
  handler: async (ctx, args) => {
    await requireFeatureAccess(ctx, args.organizationId, "compliance");
    await requirePermission(ctx, args.organizationId, "collections.read");

    const now = Date.now();
    const rangeStart = args.dateRangeStart ?? now - 30 * 24 * 60 * 60 * 1000;
    const rangeEnd = args.dateRangeEnd ?? now;

    const allAccessions = await ctx.db
      .query("accessions")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .collect();

    const accessionsByStatus = {
      total: allAccessions.length,
      pending: allAccessions.filter((a) => a.status === "pending").length,
      approved: allAccessions.filter((a) => a.status === "approved").length,
      rejected: allAccessions.filter((a) => a.status === "rejected").length,
    };

    const pendingAccessions = allAccessions
      .filter((a) => a.status === "pending")
      .sort((a, b) => b.dateReceived - a.dateReceived)
      .slice(0, 10);

    const pendingAccessionDetails = await Promise.all(
      pendingAccessions.map(async (accession) => {
        let assignedToName: string | undefined;
        if (accession.assignedTo) {
          const user = await ctx.db.get(accession.assignedTo);
          assignedToName = user?.name ?? user?.email ?? undefined;
        }
        return {
          id: accession._id,
          accessionNumber: accession.accessionNumber,
          source: accession.source,
          dateReceived: accession.dateReceived,
          method: accession.method,
          assignedToName,
          workflowStep: accession.workflowStep,
        };
      }),
    );

    const recentAccessionApprovals = allAccessions
      .filter(
        (a) =>
          (a.status === "approved" || a.status === "rejected") &&
          a.approvedAt &&
          a.approvedAt >= rangeStart &&
          a.approvedAt <= rangeEnd,
      )
      .sort((a, b) => (b.approvedAt ?? 0) - (a.approvedAt ?? 0))
      .slice(0, 10);

    const recentAccessionApprovalDetails = await Promise.all(
      recentAccessionApprovals.map(async (accession) => {
        let approvedByName = "Unknown";
        if (accession.approvedBy) {
          const user = await ctx.db.get(accession.approvedBy);
          approvedByName = user?.name ?? user?.email ?? "Unknown";
        }
        return {
          id: accession._id,
          accessionNumber: accession.accessionNumber,
          source: accession.source,
          approvedAt: accession.approvedAt as number,
          approvedByName,
          status: accession.status,
        };
      }),
    );

    const allDeaccessions = await ctx.db
      .query("deaccessions")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .collect();

    const deaccessionsByStatus = {
      total: allDeaccessions.length,
      pending: allDeaccessions.filter((d) => d.status === "pending").length,
      approved: allDeaccessions.filter((d) => d.status === "approved").length,
      rejected: allDeaccessions.filter((d) => d.status === "rejected").length,
    };

    const pendingDeaccessions = allDeaccessions
      .filter((d) => d.status === "pending")
      .sort((a, b) => b.dateDeaccessioned - a.dateDeaccessioned)
      .slice(0, 10);

    const pendingDeaccessionDetails = pendingDeaccessions.map(
      (deaccession) => ({
        id: deaccession._id,
        deaccessionNumber: deaccession.deaccessionNumber,
        reason: deaccession.reason,
        method: deaccession.method,
        dateDeaccessioned: deaccession.dateDeaccessioned,
        workflowStep: deaccession.workflowStep,
      }),
    );

    const recentDeaccessionApprovals = allDeaccessions
      .filter(
        (d) =>
          (d.status === "approved" || d.status === "rejected") &&
          d.approvedAt &&
          d.approvedAt >= rangeStart &&
          d.approvedAt <= rangeEnd,
      )
      .sort((a, b) => (b.approvedAt ?? 0) - (a.approvedAt ?? 0))
      .slice(0, 10);

    const recentDeaccessionApprovalDetails = await Promise.all(
      recentDeaccessionApprovals.map(async (deaccession) => {
        let approvedByName = "Unknown";
        if (deaccession.approvedBy) {
          const user = await ctx.db.get(deaccession.approvedBy);
          approvedByName = user?.name ?? user?.email ?? "Unknown";
        }
        return {
          id: deaccession._id,
          deaccessionNumber: deaccession.deaccessionNumber,
          reason: deaccession.reason,
          approvedAt: deaccession.approvedAt as number,
          approvedByName,
          status: deaccession.status,
          proceedsAmount: deaccession.proceedsAmount,
        };
      }),
    );

    const auditEvents = await ctx.db
      .query("auditLog")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .collect();

    const filteredEvents = auditEvents.filter(
      (e) => e.timestamp >= rangeStart && e.timestamp <= rangeEnd,
    );

    const recentEvents = filteredEvents
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 20);

    const recentEventDetails = await Promise.all(
      recentEvents.map(async (event) => {
        const user = await ctx.db.get(event.userId);
        return {
          id: event._id,
          action: event.action,
          entityType: event.entityType,
          entityId: event.entityId,
          userName: user?.name ?? user?.email ?? "Unknown",
          timestamp: event.timestamp,
        };
      }),
    );

    const eventsByTypeMap = new Map<string, number>();
    for (const event of filteredEvents) {
      const count = eventsByTypeMap.get(event.entityType) ?? 0;
      eventsByTypeMap.set(event.entityType, count + 1);
    }
    const eventsByType = Array.from(eventsByTypeMap.entries())
      .map(([entityType, count]) => ({ entityType, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const eventsByUserMap = new Map<
      string,
      { userId: string; count: number }
    >();
    for (const event of filteredEvents) {
      const existing = eventsByUserMap.get(event.userId);
      if (existing) {
        existing.count++;
      } else {
        eventsByUserMap.set(event.userId, { userId: event.userId, count: 1 });
      }
    }

    const eventsByUserWithNames = await Promise.all(
      Array.from(eventsByUserMap.values())
        .sort((a, b) => b.count - a.count)
        .slice(0, 10)
        .map(async ({ userId, count }) => {
          const user = await ctx.db.get(userId as Id<"users">);
          return {
            userId,
            userName: user?.name ?? user?.email ?? "Unknown",
            count,
          };
        }),
    );

    return {
      accessions: {
        ...accessionsByStatus,
        pendingApprovals: pendingAccessionDetails,
        recentApprovals: recentAccessionApprovalDetails,
      },
      deaccessions: {
        ...deaccessionsByStatus,
        pendingApprovals: pendingDeaccessionDetails,
        recentApprovals: recentDeaccessionApprovalDetails,
      },
      auditTrail: {
        totalEvents: filteredEvents.length,
        recentEvents: recentEventDetails,
        eventsByType,
        eventsByUser: eventsByUserWithNames,
      },
      generatedAt: now,
    };
  },
});

export const getLocationUtilization = query({
  args: {
    organizationId: v.id("organizations"),
  },
  returns: v.object({
    summary: v.object({
      totalLocations: v.number(),
      locationsWithCapacity: v.number(),
      totalCapacity: v.number(),
      totalOccupied: v.number(),
      utilizationPercentage: v.number(),
    }),
    byType: v.array(
      v.object({
        type: v.string(),
        count: v.number(),
        withCapacity: v.number(),
        totalCapacity: v.number(),
        totalOccupied: v.number(),
        utilizationPercentage: v.number(),
      }),
    ),
    topUtilized: v.array(
      v.object({
        id: v.string(),
        name: v.string(),
        type: v.string(),
        capacity: v.number(),
        occupied: v.number(),
        utilizationPercentage: v.number(),
        path: v.string(),
      }),
    ),
    underutilized: v.array(
      v.object({
        id: v.string(),
        name: v.string(),
        type: v.string(),
        capacity: v.number(),
        occupied: v.number(),
        utilizationPercentage: v.number(),
        path: v.string(),
      }),
    ),
    atCapacity: v.array(
      v.object({
        id: v.string(),
        name: v.string(),
        type: v.string(),
        capacity: v.number(),
        occupied: v.number(),
        path: v.string(),
      }),
    ),
    generatedAt: v.number(),
  }),
  handler: async (ctx, args) => {
    await requireFeatureAccess(ctx, args.organizationId, "reporting");
    await requirePermission(ctx, args.organizationId, "locations.read");

    const now = Date.now();

    const allLocations = await ctx.db
      .query("locations")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();

    const allCollections = await ctx.db
      .query("collections")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .filter((q) =>
        q.and(
          q.neq(q.field("currentLocationId"), undefined),
          q.neq(q.field("status"), "deaccessioned"),
        ),
      )
      .collect();

    const occupancyMap = new Map<string, number>();
    for (const collection of allCollections) {
      if (collection.currentLocationId) {
        const locationId = collection.currentLocationId;
        occupancyMap.set(locationId, (occupancyMap.get(locationId) ?? 0) + 1);
      }
    }

    const locationMap = new Map(allLocations.map((loc) => [loc._id, loc]));

    function getLocationPath(locationId: Id<"locations">): string {
      const parts: string[] = [];
      let currentId: Id<"locations"> | undefined = locationId;

      while (currentId) {
        const location = locationMap.get(currentId);
        if (!location) break;
        parts.unshift(location.name);
        currentId = location.parentLocationId;
      }

      return parts.join(" > ");
    }

    const locationsWithCapacity = allLocations.filter(
      (loc) => loc.capacity != null && loc.capacity > 0,
    );

    const totalCapacity = locationsWithCapacity.reduce(
      (sum, loc) => sum + (loc.capacity ?? 0),
      0,
    );

    const totalOccupied = locationsWithCapacity.reduce(
      (sum, loc) => sum + (occupancyMap.get(loc._id) ?? 0),
      0,
    );

    const utilizationPercentage =
      totalCapacity > 0 ? Math.round((totalOccupied / totalCapacity) * 100) : 0;

    const byTypeMap = new Map<
      string,
      {
        count: number;
        withCapacity: number;
        totalCapacity: number;
        totalOccupied: number;
      }
    >();

    for (const loc of allLocations) {
      const existing = byTypeMap.get(loc.type) ?? {
        count: 0,
        withCapacity: 0,
        totalCapacity: 0,
        totalOccupied: 0,
      };
      existing.count++;
      if (loc.capacity != null && loc.capacity > 0) {
        existing.withCapacity++;
        existing.totalCapacity += loc.capacity;
        existing.totalOccupied += occupancyMap.get(loc._id) ?? 0;
      }
      byTypeMap.set(loc.type, existing);
    }

    const byType = Array.from(byTypeMap.entries())
      .map(([type, stats]) => ({
        type,
        ...stats,
        utilizationPercentage:
          stats.totalCapacity > 0
            ? Math.round((stats.totalOccupied / stats.totalCapacity) * 100)
            : 0,
      }))
      .sort((a, b) => b.count - a.count);

    const locationStats = locationsWithCapacity.map((loc) => {
      const occupied = occupancyMap.get(loc._id) ?? 0;
      const capacity = loc.capacity ?? 1;
      return {
        id: loc._id,
        name: loc.name,
        type: loc.type,
        capacity,
        occupied,
        utilizationPercentage: Math.round((occupied / capacity) * 100),
        path: getLocationPath(loc._id),
      };
    });

    const topUtilized = [...locationStats]
      .filter((loc) => loc.utilizationPercentage < 100)
      .sort((a, b) => b.utilizationPercentage - a.utilizationPercentage)
      .slice(0, 10);

    const underutilized = [...locationStats]
      .filter((loc) => loc.utilizationPercentage < 50 && loc.capacity >= 5)
      .sort((a, b) => a.utilizationPercentage - b.utilizationPercentage)
      .slice(0, 10);

    const atCapacity = locationStats
      .filter((loc) => loc.occupied >= loc.capacity)
      .slice(0, 10)
      .map((loc) => ({
        id: loc.id,
        name: loc.name,
        type: loc.type,
        capacity: loc.capacity,
        occupied: loc.occupied,
        path: loc.path,
      }));

    return {
      summary: {
        totalLocations: allLocations.length,
        locationsWithCapacity: locationsWithCapacity.length,
        totalCapacity,
        totalOccupied,
        utilizationPercentage,
      },
      byType,
      topUtilized,
      underutilized,
      atCapacity,
      generatedAt: now,
    };
  },
});

export const getCollectionGrowth = query({
  args: {
    organizationId: v.id("organizations"),
  },
  returns: v.array(
    v.object({
      month: v.string(),
      count: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    await requirePermission(
      ctx,
      args.organizationId,
      "organization.view_analytics",
    );

    const collections = await ctx.db
      .query("collections")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .collect();

    const now = new Date();
    const months: { month: string; count: number }[] = [];

    for (let i = 11; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthStr = date.toLocaleDateString("en-US", {
        month: "short",
        year: "2-digit",
      });
      const startOfMonth = date.getTime();
      const endOfMonth = new Date(
        date.getFullYear(),
        date.getMonth() + 1,
        0,
        23,
        59,
        59,
        999,
      ).getTime();

      const count = collections.filter(
        (c) => c._creationTime >= startOfMonth && c._creationTime <= endOfMonth,
      ).length;

      months.push({ month: monthStr, count });
    }

    return months;
  },
});

export const getKpiTrends = query({
  args: {
    organizationId: v.id("organizations"),
  },
  returns: v.object({
    totalObjects: v.array(v.number()),
    objectsOnLoan: v.array(v.number()),
    activeLoans: v.array(v.number()),
    pendingAccessions: v.array(v.number()),
  }),
  handler: async (ctx, args) => {
    await requirePermission(
      ctx,
      args.organizationId,
      "organization.view_analytics",
    );

    const days = 7;
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;

    const collections = await ctx.db
      .query("collections")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .collect();

    const loans = await ctx.db
      .query("loans")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .collect();

    const accessions = await ctx.db
      .query("accessions")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .collect();

    const totalObjects: number[] = [];
    const objectsOnLoan: number[] = [];
    const activeLoans: number[] = [];
    const pendingAccessions: number[] = [];

    for (let i = days - 1; i >= 0; i--) {
      const dayEnd = now - i * dayMs;

      totalObjects.push(
        collections.filter((c) => c._creationTime <= dayEnd).length,
      );
      objectsOnLoan.push(
        collections.filter(
          (c) => c._creationTime <= dayEnd && c.status === "loaned",
        ).length,
      );
      activeLoans.push(
        loans.filter((l) => l._creationTime <= dayEnd && l.status === "active")
          .length,
      );
      pendingAccessions.push(
        accessions.filter(
          (a) => a._creationTime <= dayEnd && a.status === "pending",
        ).length,
      );
    }

    return { totalObjects, objectsOnLoan, activeLoans, pendingAccessions };
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
    await requireFeatureAccess(ctx, args.organizationId, "reporting");
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
