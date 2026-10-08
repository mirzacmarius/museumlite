import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { query } from "./_generated/server";
import { INVENTORY_METRIC_DEFINITION } from "./utils/collectionMetrics";
import { buildOrganizationAnalytics } from "./utils/dashboardAnalytics";
import { EXHIBITION_METRIC_DEFINITION } from "./utils/exhibitionMetrics";
import { requireFeatureAccess } from "./utils/featureGates";
import { loadOperationalKpis } from "./utils/operationalKpis";
import { requirePermission } from "./utils/permissions";

export const getAnalytics = query({
  args: {
    organizationId: v.id("organizations"),
    siteId: v.optional(v.id("sites")),
  },
  returns: v.object({
    asOf: v.number(),
    definitionId: v.literal(INVENTORY_METRIC_DEFINITION),
    scope: v.object({
      organizationId: v.id("organizations"),
      siteId: v.optional(v.id("sites")),
      inventory: v.literal("owned"),
      transferApprovals: v.literal("outgoing_source"),
    }),
    collections: v.object({
      total: v.number(),
    }),
    objects: v.object({
      total: v.number(),
      active: v.number(),
      loaned: v.number(),
      incomingLoanExcluded: v.number(),
      ownershipUnclassified: v.number(),
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
    transfers: v.object({
      pending: v.number(),
      executed: v.number(),
      rejected: v.number(),
      cancelled: v.number(),
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
        entityId: v.optional(v.string()),
        title: v.string(),
        subtitle: v.optional(v.string()),
        timestamp: v.number(),
        status: v.optional(v.string()),
      }),
    ),
  }),
  handler: async (ctx, args) => {
    const asOf = Date.now();
    const [, analytics] = await Promise.all([
      requirePermission(
        ctx,
        args.organizationId,
        "organization.view_analytics",
      ),
      buildOrganizationAnalytics(ctx, args.organizationId, args.siteId),
    ] as const);

    return {
      ...analytics,
      asOf,
      definitionId: INVENTORY_METRIC_DEFINITION,
      scope: {
        organizationId: args.organizationId,
        siteId: args.siteId,
        inventory: "owned" as const,
        transferApprovals: "outgoing_source" as const,
      },
    };
  },
});

export const getComplianceReport = query({
  args: {
    organizationId: v.id("organizations"),
    now: v.number(),
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
    await Promise.all([
      requireFeatureAccess(ctx, args.organizationId, "compliance"),
      requirePermission(ctx, args.organizationId, "collections.read"),
    ]);

    const now = args.now;
    const rangeStart = args.dateRangeStart ?? now - 30 * 24 * 60 * 60 * 1000;
    const rangeEnd = args.dateRangeEnd ?? now;

    // TODO: bound if accession volume grows
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

    const [recentAccessionApprovalDetails, allDeaccessions] = await Promise.all(
      [
        Promise.all(
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
        ),
        ctx.db
          .query("deaccessions")
          .withIndex("by_organization", (q) =>
            q.eq("organizationId", args.organizationId),
          )
          .collect(),
      ],
    );
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

    const [recentDeaccessionApprovalDetails, auditEvents] = await Promise.all([
      Promise.all(
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
      ),
      ctx.db
        .query("auditLog")
        .withIndex("by_organization_and_timestamp", (q) =>
          q
            .eq("organizationId", args.organizationId)
            .gte("timestamp", rangeStart)
            .lte("timestamp", rangeEnd),
        )
        .order("desc")
        .collect(),
    ]);
    const filteredEvents = auditEvents;

    const recentEvents = filteredEvents.slice(0, 20);

    const uniqueRecentUserIds = [
      ...new Set(recentEvents.map((event) => event.userId)),
    ];
    const recentUsers = await Promise.all(
      uniqueRecentUserIds.map(async (userId) => {
        const user = await ctx.db.get(userId);
        return { userId, user };
      }),
    );
    const recentUserNameById = new Map(
      recentUsers.map(({ userId, user }) => [
        userId,
        user?.name ?? user?.email ?? "Unknown",
      ]),
    );

    const recentEventDetails = recentEvents.map((event) => ({
      id: event._id,
      action: event.action,
      entityType: event.entityType,
      entityId: event.entityId,
      userName: recentUserNameById.get(event.userId) ?? "Unknown",
      timestamp: event.timestamp,
    }));

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

    const topEventsByUser = Array.from(eventsByUserMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
    const eventsByUserIds = [
      ...new Set(topEventsByUser.map(({ userId }) => userId)),
    ];
    const eventsByUserRecords = await Promise.all(
      eventsByUserIds.map(async (userId) => {
        const user = await ctx.db.get(userId as Id<"users">);
        return [userId, user] as const;
      }),
    );
    const eventsByUserNameById = new Map(eventsByUserRecords);
    const eventsByUserWithNames = topEventsByUser.map(({ userId, count }) => {
      const user = eventsByUserNameById.get(userId);
      return {
        userId,
        userName: user?.name ?? user?.email ?? "Unknown",
        count,
      };
    });

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
    now: v.number(),
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
    await Promise.all([
      requireFeatureAccess(ctx, args.organizationId, "reporting"),
      requirePermission(ctx, args.organizationId, "locations.read"),
    ]);

    const now = args.now;

    const [allLocations, allCollections] = await Promise.all([
      ctx.db
        .query("locations")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", args.organizationId),
        )
        .filter((q) => q.eq(q.field("isActive"), true))
        .collect(),
      ctx.db
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
        .collect(),
    ]);
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
    const [, collections] = await Promise.all([
      requirePermission(
        ctx,
        args.organizationId,
        "organization.view_analytics",
      ),
      ctx.db
        .query("collections")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", args.organizationId),
        )
        .collect(),
    ] as const);

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
    now: v.number(),
  },
  returns: v.object({
    totalObjects: v.array(v.number()),
    objectsOnLoan: v.array(v.number()),
    activeLoans: v.array(v.number()),
    pendingAccessions: v.array(v.number()),
  }),
  handler: async (ctx, args) => {
    const days = 7;
    const now = args.now;
    const dayMs = 24 * 60 * 60 * 1000;

    const [, [collections, loans, accessions]] = await Promise.all([
      requirePermission(
        ctx,
        args.organizationId,
        "organization.view_analytics",
      ),
      Promise.all([
        ctx.db
          .query("collections")
          .withIndex("by_organization", (q) =>
            q.eq("organizationId", args.organizationId),
          )
          .collect(),
        ctx.db
          .query("loans")
          .withIndex("by_organization", (q) =>
            q.eq("organizationId", args.organizationId),
          )
          .collect(),
        ctx.db
          .query("accessions")
          .withIndex("by_organization", (q) =>
            q.eq("organizationId", args.organizationId),
          )
          .collect(),
      ]),
    ] as const);
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
    now: v.optional(v.number()),
    asOf: v.optional(v.number()),
  },
  returns: v.object({
    definitionId: v.literal(EXHIBITION_METRIC_DEFINITION),
    scope: v.object({
      organizationId: v.id("organizations"),
      excludeExhibitionLoans: v.literal(true),
    }),
    inventory: v.object({
      available: v.boolean(),
      unavailableReason: v.optional(v.string()),
      totalValue: v.union(v.number(), v.null()),
      fineArt: v.object({
        totalValue: v.union(v.number(), v.null()),
        itemCount: v.union(v.number(), v.null()),
        valuedCount: v.union(v.number(), v.null()),
      }),
      wine: v.object({
        totalValue: v.union(v.number(), v.null()),
        itemCount: v.union(v.number(), v.null()),
        valuedCount: v.union(v.number(), v.null()),
      }),
      vehicles: v.object({
        totalValue: v.union(v.number(), v.null()),
        itemCount: v.union(v.number(), v.null()),
        valuedCount: v.union(v.number(), v.null()),
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
      installing: v.number(),
      active: v.number(),
      deinstalling: v.number(),
      closed: v.number(),
      rejected: v.number(),
      unclassified: v.number(),
      excludedLoans: v.number(),
      legacyContradictions: v.number(),
      bySchedule: v.object({
        current: v.number(),
        upcoming: v.number(),
        past: v.number(),
      }),
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
    asOf: v.number(),
    generatedAt: v.number(),
  }),
  handler: async (ctx, args) => {
    await Promise.all([
      requireFeatureAccess(ctx, args.organizationId, "reporting"),
      requirePermission(ctx, args.organizationId, "collections.read"),
    ]);

    const asOf = args.asOf ?? args.now ?? Date.now();
    if (!Number.isFinite(asOf))
      throw new Error("asOf must be a finite timestamp");
    return await loadOperationalKpis(ctx, args.organizationId, asOf);
  },
});
