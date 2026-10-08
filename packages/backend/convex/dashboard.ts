import { v } from "convex/values";
import { query } from "./_generated/server";
import { INVENTORY_METRIC_DEFINITION } from "./utils/collectionMetrics";
import { buildOrganizationAnalytics } from "./utils/dashboardAnalytics";
import { EXHIBITION_METRIC_DEFINITION } from "./utils/exhibitionMetrics";
import { requireFeatureAccess } from "./utils/featureGates";
import { loadOperationalKpis } from "./utils/operationalKpis";
import { requirePermission } from "./utils/permissions";
import {
  buildCollectionGrowth,
  buildComplianceReport,
  buildKpiTrends,
  buildLocationUtilization,
} from "./utils/projectionReports";
import { projectionUnavailableResult } from "./utils/projectionValidators";

export const getAnalytics = query({
  args: {
    organizationId: v.id("organizations"),
    siteId: v.optional(v.id("sites")),
  },
  returns: v.union(
    projectionUnavailableResult,
    v.object({
      availability: v.literal("ready"),
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
  ),
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

    if (analytics.availability === "unavailable") return analytics;
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
  returns: v.union(
    projectionUnavailableResult,
    v.object({
      availability: v.literal("ready"),
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
        breakdownsComplete: v.boolean(),
      }),
      generatedAt: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    await Promise.all([
      requireFeatureAccess(ctx, args.organizationId, "compliance"),
      requirePermission(ctx, args.organizationId, "collections.read"),
    ]);
    const rangeStart =
      args.dateRangeStart ?? args.now - 30 * 24 * 60 * 60 * 1000;
    const rangeEnd = args.dateRangeEnd ?? args.now;
    return await buildComplianceReport(
      ctx,
      args.organizationId,
      args.now,
      rangeStart,
      rangeEnd,
    );
  },
});

export const getLocationUtilization = query({
  args: {
    organizationId: v.id("organizations"),
    now: v.number(),
  },
  returns: v.union(
    projectionUnavailableResult,
    v.object({
      availability: v.literal("ready"),
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
      byTypeComplete: v.boolean(),
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
  ),
  handler: async (ctx, args) => {
    await Promise.all([
      requireFeatureAccess(ctx, args.organizationId, "reporting"),
      requirePermission(ctx, args.organizationId, "locations.read"),
    ]);
    return await buildLocationUtilization(ctx, args.organizationId, args.now);
  },
});

export const getCollectionGrowth = query({
  args: {
    organizationId: v.id("organizations"),
  },
  returns: v.union(
    projectionUnavailableResult,
    v.object({
      availability: v.literal("ready"),
      months: v.array(
        v.object({
          month: v.string(),
          count: v.number(),
        }),
      ),
    }),
  ),
  handler: async (ctx, args) => {
    await requirePermission(
      ctx,
      args.organizationId,
      "organization.view_analytics",
    );
    return await buildCollectionGrowth(ctx, args.organizationId, new Date());
  },
});

export const getKpiTrends = query({
  args: {
    organizationId: v.id("organizations"),
    now: v.number(),
  },
  returns: v.union(
    projectionUnavailableResult,
    v.object({
      availability: v.literal("ready"),
      totalObjects: v.array(v.number()),
      objectsOnLoan: v.array(v.number()),
      activeLoans: v.array(v.number()),
      pendingAccessions: v.array(v.number()),
    }),
  ),
  handler: async (ctx, args) => {
    await requirePermission(
      ctx,
      args.organizationId,
      "organization.view_analytics",
    );
    return await buildKpiTrends(ctx, args.organizationId, args.now);
  },
});

export const getOperationalKpis = query({
  args: {
    organizationId: v.id("organizations"),
    now: v.optional(v.number()),
    asOf: v.optional(v.number()),
  },
  returns: v.union(
    projectionUnavailableResult,
    v.object({
      availability: v.literal("ready"),
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
  ),
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
