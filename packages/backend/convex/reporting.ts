import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation, mutation, query } from "./_generated/server";
import { requireFeatureAccess } from "./utils/featureGates";
import { requirePermission } from "./utils/permissions";

// ============================================
// VALIDATORS
// ============================================

const reportTypeValidator = v.union(
  v.literal("collection_health"),
  v.literal("conservation_status"),
  v.literal("insurance_coverage"),
  v.literal("location_utilization"),
  v.literal("loan_performance"),
  v.literal("accession_activity"),
  v.literal("deaccession_activity"),
  v.literal("media_rights"),
  v.literal("compliance_audit"),
  v.literal("operational_kpis"),
  v.literal("custom"),
);

const scheduleValidator = v.union(
  v.literal("daily"),
  v.literal("weekly"),
  v.literal("monthly"),
  v.literal("quarterly"),
  v.literal("on_demand"),
);

const dateRangeValidator = v.union(
  v.literal("last_7_days"),
  v.literal("last_30_days"),
  v.literal("last_90_days"),
  v.literal("last_year"),
  v.literal("year_to_date"),
  v.literal("custom"),
);

const comparisonPeriodValidator = v.union(
  v.literal("previous_period"),
  v.literal("same_period_last_year"),
);

// ============================================
// 2.10.1 SCHEDULED REPORTS
// ============================================

/**
 * Create a scheduled report
 */
export const createScheduledReport = mutation({
  args: {
    organizationId: v.id("organizations"),
    name: v.string(),
    description: v.optional(v.string()),
    reportType: reportTypeValidator,
    reportConfig: v.optional(
      v.object({
        dateRange: v.optional(dateRangeValidator),
        customStartDate: v.optional(v.number()),
        customEndDate: v.optional(v.number()),
        includeComparison: v.optional(v.boolean()),
        comparisonPeriod: v.optional(comparisonPeriodValidator),
        filters: v.optional(
          v.object({
            siteIds: v.optional(v.array(v.id("sites"))),
            locationIds: v.optional(v.array(v.id("locations"))),
            collectionGroupIds: v.optional(v.array(v.id("collectionGroups"))),
            objectTypes: v.optional(v.array(v.string())),
          }),
        ),
      }),
    ),
    schedule: scheduleValidator,
    scheduledDay: v.optional(v.number()),
    scheduledTime: v.optional(v.string()),
    timezone: v.optional(v.string()),
    emailRecipients: v.optional(v.array(v.string())),
    emailSubject: v.optional(v.string()),
    includeAttachment: v.optional(v.boolean()),
    attachmentFormat: v.optional(
      v.union(v.literal("pdf"), v.literal("csv"), v.literal("excel")),
    ),
  },
  returns: v.id("scheduledReports"),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    await requireFeatureAccess(ctx, args.organizationId, "reporting");
    await requirePermission(
      ctx,
      args.organizationId,
      "organization.manage_settings",
    );

    const nextRunAt = calculateNextRun(
      args.schedule,
      args.scheduledDay,
      args.scheduledTime,
      args.timezone,
    );

    const reportId = await ctx.db.insert("scheduledReports", {
      organizationId: args.organizationId,
      name: args.name,
      description: args.description,
      reportType: args.reportType,
      reportConfig: args.reportConfig,
      schedule: args.schedule,
      scheduledDay: args.scheduledDay,
      scheduledTime: args.scheduledTime,
      timezone: args.timezone ?? "UTC",
      emailRecipients: args.emailRecipients,
      emailSubject: args.emailSubject,
      includeAttachment: args.includeAttachment,
      attachmentFormat: args.attachmentFormat,
      isActive: true,
      nextRunAt,
      createdBy: userId,
      createdAt: Date.now(),
    });

    return reportId;
  },
});

/**
 * Update a scheduled report
 */
export const updateScheduledReport = mutation({
  args: {
    reportId: v.id("scheduledReports"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    reportConfig: v.optional(
      v.object({
        dateRange: v.optional(dateRangeValidator),
        customStartDate: v.optional(v.number()),
        customEndDate: v.optional(v.number()),
        includeComparison: v.optional(v.boolean()),
        comparisonPeriod: v.optional(comparisonPeriodValidator),
        filters: v.optional(
          v.object({
            siteIds: v.optional(v.array(v.id("sites"))),
            locationIds: v.optional(v.array(v.id("locations"))),
            collectionGroupIds: v.optional(v.array(v.id("collectionGroups"))),
            objectTypes: v.optional(v.array(v.string())),
          }),
        ),
      }),
    ),
    schedule: v.optional(scheduleValidator),
    scheduledDay: v.optional(v.number()),
    scheduledTime: v.optional(v.string()),
    timezone: v.optional(v.string()),
    emailRecipients: v.optional(v.array(v.string())),
    emailSubject: v.optional(v.string()),
    includeAttachment: v.optional(v.boolean()),
    attachmentFormat: v.optional(
      v.union(v.literal("pdf"), v.literal("csv"), v.literal("excel")),
    ),
    isActive: v.optional(v.boolean()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const report = await ctx.db.get(args.reportId);
    if (!report) {
      throw new Error("Report not found");
    }

    await requireFeatureAccess(ctx, report.organizationId, "reporting");
    await requirePermission(
      ctx,
      report.organizationId,
      "organization.manage_settings",
    );

    const updates: Record<string, unknown> = { updatedAt: Date.now() };

    if (args.name !== undefined) updates.name = args.name;
    if (args.description !== undefined) updates.description = args.description;
    if (args.reportConfig !== undefined)
      updates.reportConfig = args.reportConfig;
    if (args.schedule !== undefined) updates.schedule = args.schedule;
    if (args.scheduledDay !== undefined)
      updates.scheduledDay = args.scheduledDay;
    if (args.scheduledTime !== undefined)
      updates.scheduledTime = args.scheduledTime;
    if (args.timezone !== undefined) updates.timezone = args.timezone;
    if (args.emailRecipients !== undefined)
      updates.emailRecipients = args.emailRecipients;
    if (args.emailSubject !== undefined)
      updates.emailSubject = args.emailSubject;
    if (args.includeAttachment !== undefined)
      updates.includeAttachment = args.includeAttachment;
    if (args.attachmentFormat !== undefined)
      updates.attachmentFormat = args.attachmentFormat;
    if (args.isActive !== undefined) updates.isActive = args.isActive;

    // Recalculate next run if schedule changed
    if (
      args.schedule ||
      args.scheduledDay ||
      args.scheduledTime ||
      args.timezone
    ) {
      updates.nextRunAt = calculateNextRun(
        args.schedule ?? report.schedule,
        args.scheduledDay ?? report.scheduledDay,
        args.scheduledTime ?? report.scheduledTime,
        args.timezone ?? report.timezone,
      );
    }

    await ctx.db.patch(args.reportId, updates);

    return null;
  },
});

/**
 * Delete a scheduled report
 */
export const deleteScheduledReport = mutation({
  args: {
    reportId: v.id("scheduledReports"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const report = await ctx.db.get(args.reportId);
    if (!report) {
      throw new Error("Report not found");
    }

    await requireFeatureAccess(ctx, report.organizationId, "reporting");
    await requirePermission(
      ctx,
      report.organizationId,
      "organization.manage_settings",
    );

    await ctx.db.delete(args.reportId);

    return null;
  },
});

/**
 * List scheduled reports for an organization
 */
export const listScheduledReports = query({
  args: {
    organizationId: v.id("organizations"),
  },
  returns: v.array(
    v.object({
      _id: v.id("scheduledReports"),
      name: v.string(),
      description: v.optional(v.string()),
      reportType: reportTypeValidator,
      schedule: scheduleValidator,
      isActive: v.boolean(),
      lastRunAt: v.optional(v.number()),
      lastRunStatus: v.optional(
        v.union(
          v.literal("success"),
          v.literal("failed"),
          v.literal("partial"),
        ),
      ),
      nextRunAt: v.optional(v.number()),
      emailRecipients: v.optional(v.array(v.string())),
    }),
  ),
  handler: async (ctx, args) => {
    await requireFeatureAccess(ctx, args.organizationId, "reporting");
    await requirePermission(
      ctx,
      args.organizationId,
      "organization.view_analytics",
    );

    const reports = await ctx.db
      .query("scheduledReports")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .collect();

    return reports.map((r) => ({
      _id: r._id,
      name: r.name,
      description: r.description,
      reportType: r.reportType,
      schedule: r.schedule,
      isActive: r.isActive,
      lastRunAt: r.lastRunAt,
      lastRunStatus: r.lastRunStatus,
      nextRunAt: r.nextRunAt,
      emailRecipients: r.emailRecipients,
    }));
  },
});

/**
 * Get scheduled report details
 */
export const getScheduledReport = query({
  args: {
    reportId: v.id("scheduledReports"),
  },
  returns: v.union(
    v.object({
      _id: v.id("scheduledReports"),
      organizationId: v.id("organizations"),
      name: v.string(),
      description: v.optional(v.string()),
      reportType: reportTypeValidator,
      reportConfig: v.optional(v.any()),
      schedule: scheduleValidator,
      scheduledDay: v.optional(v.number()),
      scheduledTime: v.optional(v.string()),
      timezone: v.optional(v.string()),
      emailRecipients: v.optional(v.array(v.string())),
      emailSubject: v.optional(v.string()),
      includeAttachment: v.optional(v.boolean()),
      attachmentFormat: v.optional(
        v.union(v.literal("pdf"), v.literal("csv"), v.literal("excel")),
      ),
      isActive: v.boolean(),
      lastRunAt: v.optional(v.number()),
      lastRunStatus: v.optional(
        v.union(
          v.literal("success"),
          v.literal("failed"),
          v.literal("partial"),
        ),
      ),
      lastRunError: v.optional(v.string()),
      nextRunAt: v.optional(v.number()),
      createdAt: v.number(),
      createdByName: v.optional(v.string()),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const report = await ctx.db.get(args.reportId);
    if (!report) {
      return null;
    }

    await requireFeatureAccess(ctx, report.organizationId, "reporting");
    await requirePermission(
      ctx,
      report.organizationId,
      "organization.view_analytics",
    );

    const createdBy = await ctx.db.get(report.createdBy);

    return {
      _id: report._id,
      organizationId: report.organizationId,
      name: report.name,
      description: report.description,
      reportType: report.reportType,
      reportConfig: report.reportConfig,
      schedule: report.schedule,
      scheduledDay: report.scheduledDay,
      scheduledTime: report.scheduledTime,
      timezone: report.timezone,
      emailRecipients: report.emailRecipients,
      emailSubject: report.emailSubject,
      includeAttachment: report.includeAttachment,
      attachmentFormat: report.attachmentFormat,
      isActive: report.isActive,
      lastRunAt: report.lastRunAt,
      lastRunStatus: report.lastRunStatus,
      lastRunError: report.lastRunError,
      nextRunAt: report.nextRunAt,
      createdAt: report.createdAt,
      createdByName: createdBy?.name || createdBy?.username,
    };
  },
});

/**
 * Run a report manually
 */
export const runReportManually = mutation({
  args: {
    reportId: v.id("scheduledReports"),
  },
  returns: v.id("reportRuns"),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const report = await ctx.db.get(args.reportId);
    if (!report) {
      throw new Error("Report not found");
    }

    await requireFeatureAccess(ctx, report.organizationId, "reporting");
    await requirePermission(
      ctx,
      report.organizationId,
      "organization.view_analytics",
    );

    // Create a run record
    const runId = await ctx.db.insert("reportRuns", {
      organizationId: report.organizationId,
      scheduledReportId: args.reportId,
      reportType: report.reportType,
      reportName: report.name,
      startedAt: Date.now(),
      status: "running",
      triggeredBy: "manual",
      triggeredByUserId: userId,
    });

    // Schedule the report generation
    await ctx.scheduler.runAfter(0, internal.reporting.generateReport, {
      runId,
      reportId: args.reportId,
    });

    return runId;
  },
});

/**
 * List report run history
 */
export const listReportRuns = query({
  args: {
    organizationId: v.id("organizations"),
    scheduledReportId: v.optional(v.id("scheduledReports")),
    limit: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      _id: v.id("reportRuns"),
      reportType: v.string(),
      reportName: v.string(),
      startedAt: v.number(),
      completedAt: v.optional(v.number()),
      status: v.union(
        v.literal("running"),
        v.literal("success"),
        v.literal("failed"),
        v.literal("cancelled"),
      ),
      errorMessage: v.optional(v.string()),
      triggeredBy: v.union(v.literal("schedule"), v.literal("manual")),
      triggeredByUserName: v.optional(v.string()),
    }),
  ),
  handler: async (ctx, args) => {
    await requireFeatureAccess(ctx, args.organizationId, "reporting");
    await requirePermission(
      ctx,
      args.organizationId,
      "organization.view_analytics",
    );

    const runs = args.scheduledReportId
      ? await ctx.db
          .query("reportRuns")
          .withIndex("by_scheduled_report", (q) =>
            q.eq("scheduledReportId", args.scheduledReportId),
          )
          .collect()
      : await ctx.db
          .query("reportRuns")
          .withIndex("by_organization", (q) =>
            q.eq("organizationId", args.organizationId),
          )
          .collect();

    // Sort by start time descending
    runs.sort((a, b) => b.startedAt - a.startedAt);

    // Apply limit
    const limitedRuns = args.limit
      ? runs.slice(0, args.limit)
      : runs.slice(0, 50);

    // Enrich with user names
    const enriched = await Promise.all(
      limitedRuns.map(async (run) => {
        let triggeredByUserName: string | undefined;
        if (run.triggeredByUserId) {
          const user = await ctx.db.get(run.triggeredByUserId);
          triggeredByUserName = user?.name || user?.username;
        }

        return {
          _id: run._id,
          reportType: run.reportType,
          reportName: run.reportName,
          startedAt: run.startedAt,
          completedAt: run.completedAt,
          status: run.status,
          errorMessage: run.errorMessage,
          triggeredBy: run.triggeredBy,
          triggeredByUserName,
        };
      }),
    );

    return enriched;
  },
});

/**
 * Internal: Generate report (called by scheduler)
 */
export const generateReport = internalMutation({
  args: {
    runId: v.id("reportRuns"),
    reportId: v.id("scheduledReports"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const report = await ctx.db.get(args.reportId);
    if (!report) {
      await ctx.db.patch(args.runId, {
        status: "failed",
        errorMessage: "Report configuration not found",
        completedAt: Date.now(),
      });
      return null;
    }

    try {
      // Generate report data based on type
      // This is a placeholder - actual report generation would query relevant data
      const reportData = {
        generatedAt: Date.now(),
        reportType: report.reportType,
        organizationId: report.organizationId,
        // Add report-specific data here
      };

      // Update run record with success
      await ctx.db.patch(args.runId, {
        status: "success",
        completedAt: Date.now(),
        reportData,
      });

      // Update scheduled report
      await ctx.db.patch(args.reportId, {
        lastRunAt: Date.now(),
        lastRunStatus: "success",
        nextRunAt: calculateNextRun(
          report.schedule,
          report.scheduledDay,
          report.scheduledTime,
          report.timezone,
        ),
      });

      // TODO: Send email if configured
      // This would integrate with Resend or similar email service

      return null;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      await ctx.db.patch(args.runId, {
        status: "failed",
        errorMessage,
        completedAt: Date.now(),
      });

      await ctx.db.patch(args.reportId, {
        lastRunAt: Date.now(),
        lastRunStatus: "failed",
        lastRunError: errorMessage,
      });

      return null;
    }
  },
});

// ============================================
// 2.10.2 TREND ANALYSIS
// ============================================

/**
 * Get collection growth trends over time
 */
export const getCollectionTrends = query({
  args: {
    organizationId: v.id("organizations"),
    period: v.union(
      v.literal("daily"),
      v.literal("weekly"),
      v.literal("monthly"),
    ),
    startDate: v.number(),
    endDate: v.number(),
    includeComparison: v.optional(v.boolean()),
  },
  returns: v.object({
    current: v.array(
      v.object({
        date: v.string(),
        timestamp: v.number(),
        totalObjects: v.number(),
        newAccessions: v.number(),
        deaccessions: v.number(),
        netChange: v.number(),
      }),
    ),
    comparison: v.optional(
      v.array(
        v.object({
          date: v.string(),
          timestamp: v.number(),
          totalObjects: v.number(),
          newAccessions: v.number(),
          deaccessions: v.number(),
          netChange: v.number(),
        }),
      ),
    ),
    summary: v.object({
      currentPeriodNet: v.number(),
      comparisonPeriodNet: v.optional(v.number()),
      percentChange: v.optional(v.number()),
    }),
  }),
  handler: async (ctx, args) => {
    await requireFeatureAccess(ctx, args.organizationId, "reporting");
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

    const accessions = await ctx.db
      .query("accessions")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .filter((q) => q.eq(q.field("status"), "approved"))
      .collect();

    const deaccessions = await ctx.db
      .query("deaccessions")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .filter((q) => q.eq(q.field("status"), "approved"))
      .collect();

    // Generate date buckets
    const buckets = generateDateBuckets(
      args.startDate,
      args.endDate,
      args.period,
    );
    const currentData = buckets.map((bucket) => {
      const bucketAccessions = accessions.filter(
        (a) =>
          a.approvedAt &&
          a.approvedAt >= bucket.start &&
          a.approvedAt < bucket.end,
      ).length;

      const bucketDeaccessions = deaccessions.filter(
        (d) =>
          d.approvedAt &&
          d.approvedAt >= bucket.start &&
          d.approvedAt < bucket.end,
      ).length;

      const totalAtEnd = collections.filter(
        (c) => c._creationTime <= bucket.end && c.status !== "deaccessioned",
      ).length;

      return {
        date: bucket.label,
        timestamp: bucket.start,
        totalObjects: totalAtEnd,
        newAccessions: bucketAccessions,
        deaccessions: bucketDeaccessions,
        netChange: bucketAccessions - bucketDeaccessions,
      };
    });

    // Calculate comparison period if requested
    let comparisonData: typeof currentData | undefined;
    if (args.includeComparison) {
      const periodLength = args.endDate - args.startDate;
      const comparisonStart = args.startDate - periodLength;
      const comparisonEnd = args.startDate;

      const comparisonBuckets = generateDateBuckets(
        comparisonStart,
        comparisonEnd,
        args.period,
      );

      comparisonData = comparisonBuckets.map((bucket) => {
        const bucketAccessions = accessions.filter(
          (a) =>
            a.approvedAt &&
            a.approvedAt >= bucket.start &&
            a.approvedAt < bucket.end,
        ).length;

        const bucketDeaccessions = deaccessions.filter(
          (d) =>
            d.approvedAt &&
            d.approvedAt >= bucket.start &&
            d.approvedAt < bucket.end,
        ).length;

        const totalAtEnd = collections.filter(
          (c) => c._creationTime <= bucket.end && c.status !== "deaccessioned",
        ).length;

        return {
          date: bucket.label,
          timestamp: bucket.start,
          totalObjects: totalAtEnd,
          newAccessions: bucketAccessions,
          deaccessions: bucketDeaccessions,
          netChange: bucketAccessions - bucketDeaccessions,
        };
      });
    }

    const currentPeriodNet = currentData.reduce(
      (sum, d) => sum + d.netChange,
      0,
    );
    const comparisonPeriodNet = comparisonData
      ? comparisonData.reduce((sum, d) => sum + d.netChange, 0)
      : undefined;

    const percentChange =
      comparisonPeriodNet !== undefined && comparisonPeriodNet !== 0
        ? Math.round(
            ((currentPeriodNet - comparisonPeriodNet) /
              Math.abs(comparisonPeriodNet)) *
              100,
          )
        : undefined;

    return {
      current: currentData,
      comparison: comparisonData,
      summary: {
        currentPeriodNet,
        comparisonPeriodNet,
        percentChange,
      },
    };
  },
});

/**
 * Get loan activity trends
 */
export const getLoanTrends = query({
  args: {
    organizationId: v.id("organizations"),
    period: v.union(
      v.literal("daily"),
      v.literal("weekly"),
      v.literal("monthly"),
    ),
    startDate: v.number(),
    endDate: v.number(),
  },
  returns: v.array(
    v.object({
      date: v.string(),
      timestamp: v.number(),
      newLoans: v.number(),
      returnedLoans: v.number(),
      activeLoans: v.number(),
      overdueLoans: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    await requireFeatureAccess(ctx, args.organizationId, "reporting");
    await requirePermission(
      ctx,
      args.organizationId,
      "organization.view_analytics",
    );

    const loans = await ctx.db
      .query("loans")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .collect();

    const buckets = generateDateBuckets(
      args.startDate,
      args.endDate,
      args.period,
    );

    return buckets.map((bucket) => {
      const newLoans = loans.filter(
        (l) => l.startDate >= bucket.start && l.startDate < bucket.end,
      ).length;

      // Count loans that are currently returned and started within this bucket
      // (We use status since there's no returnedDate timestamp)
      const returnedLoans = loans.filter(
        (l) =>
          l.status === "returned" &&
          l.startDate >= bucket.start &&
          l.startDate < bucket.end,
      ).length;

      const activeLoans = loans.filter(
        (l) =>
          l.startDate <= bucket.end &&
          (l.status === "active" || l.status === "dispatched"),
      ).length;

      const overdueLoans = loans.filter(
        (l) =>
          l.startDate <= bucket.end &&
          l.endDate &&
          l.endDate < bucket.end &&
          (l.status === "active" || l.status === "dispatched"),
      ).length;

      return {
        date: bucket.label,
        timestamp: bucket.start,
        newLoans,
        returnedLoans,
        activeLoans,
        overdueLoans,
      };
    });
  },
});

/**
 * Get conservation activity trends
 */
export const getConservationTrends = query({
  args: {
    organizationId: v.id("organizations"),
    period: v.union(
      v.literal("daily"),
      v.literal("weekly"),
      v.literal("monthly"),
    ),
    startDate: v.number(),
    endDate: v.number(),
  },
  returns: v.array(
    v.object({
      date: v.string(),
      timestamp: v.number(),
      newTreatments: v.number(),
      completedTreatments: v.number(),
      totalCost: v.number(),
      averageDuration: v.optional(v.number()),
    }),
  ),
  handler: async (ctx, args) => {
    await requireFeatureAccess(ctx, args.organizationId, "reporting");
    await requirePermission(
      ctx,
      args.organizationId,
      "organization.view_analytics",
    );

    const treatments = await ctx.db
      .query("conservationTreatments")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .collect();

    const buckets = generateDateBuckets(
      args.startDate,
      args.endDate,
      args.period,
    );

    return buckets.map((bucket) => {
      // Use performedAt as the treatment start date
      const newTreatments = treatments.filter(
        (t) => t.performedAt >= bucket.start && t.performedAt < bucket.end,
      ).length;

      // Use status === "completed" and performedAt within range for completed treatments
      const completedInBucket = treatments.filter(
        (t) =>
          t.status === "completed" &&
          t.performedAt >= bucket.start &&
          t.performedAt < bucket.end,
      );

      const completedTreatments = completedInBucket.length;

      const totalCost = completedInBucket.reduce((sum, t) => {
        const materialsCost = t.materialsCost ?? 0;
        const laborCost = (t.laborHours ?? 0) * (t.laborRate ?? 0);
        return sum + materialsCost + laborCost;
      }, 0);

      // Duration calculation not possible without a completedDate field
      // Return undefined since we only have performedAt (treatment date)
      const averageDuration: number | undefined = undefined;

      return {
        date: bucket.label,
        timestamp: bucket.start,
        newTreatments,
        completedTreatments,
        totalCost,
        averageDuration,
      };
    });
  },
});

// ============================================
// 2.10.3 COLLECTION HEALTH DASHBOARD
// ============================================

/**
 * Get comprehensive collection health metrics
 */
export const getCollectionHealthDashboard = query({
  args: {
    organizationId: v.id("organizations"),
  },
  returns: v.object({
    conservation: v.object({
      totalObjects: v.number(),
      goodCondition: v.number(),
      fairCondition: v.number(),
      poorCondition: v.number(),
      unknownCondition: v.number(),
      pendingTreatments: v.number(),
      activeTreatments: v.number(),
      completedTreatmentsThisYear: v.number(),
      overdueAssessments: v.number(),
    }),
    insurance: v.object({
      totalCoveredValue: v.number(),
      objectsWithCoverage: v.number(),
      objectsWithoutCoverage: v.number(),
      expiringPolicies: v.number(),
      pendingClaims: v.number(),
      staleAppraisals: v.number(),
    }),
    locations: v.object({
      totalLocations: v.number(),
      objectsWithLocation: v.number(),
      objectsWithoutLocation: v.number(),
      atCapacityLocations: v.number(),
      overCapacityLocations: v.number(),
      utilizationPercentage: v.number(),
    }),
    loans: v.object({
      activeLoans: v.number(),
      overdueLoans: v.number(),
      dueSoon: v.number(),
      returnRate: v.number(),
      averageLoanDuration: v.number(),
    }),
    media: v.object({
      totalMediaFiles: v.number(),
      objectsWithMedia: v.number(),
      objectsWithoutMedia: v.number(),
      unknownRights: v.number(),
      expiringLicenses: v.number(),
    }),
    overall: v.object({
      healthScore: v.number(),
      criticalIssues: v.number(),
      warningIssues: v.number(),
      recommendations: v.array(v.string()),
    }),
    generatedAt: v.number(),
  }),
  handler: async (ctx, args) => {
    await requireFeatureAccess(ctx, args.organizationId, "reporting");
    await requirePermission(
      ctx,
      args.organizationId,
      "organization.view_analytics",
    );

    const now = Date.now();
    const yearStart = new Date(new Date().getFullYear(), 0, 1).getTime();
    const thirtyDaysFromNow = now + 30 * 24 * 60 * 60 * 1000;
    const threeYearsAgo = now - 3 * 365 * 24 * 60 * 60 * 1000;

    // Get all collections
    const collections = await ctx.db
      .query("collections")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .filter((q) => q.neq(q.field("status"), "deaccessioned"))
      .collect();

    const totalObjects = collections.length;

    // Conservation metrics
    const treatments = await ctx.db
      .query("conservationTreatments")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .collect();

    const conditionCounts = {
      excellent: 0,
      good: 0,
      fair: 0,
      poor: 0,
      unknown: 0,
    };

    for (const c of collections) {
      const condition = c.condition?.toLowerCase() || "unknown";
      if (condition === "excellent" || condition === "good") {
        conditionCounts.good++;
      } else if (condition === "fair") {
        conditionCounts.fair++;
      } else if (condition === "poor" || condition === "critical") {
        conditionCounts.poor++;
      } else {
        conditionCounts.unknown++;
      }
    }

    const pendingTreatments = treatments.filter(
      (t) => t.status === "proposed" || t.status === "approved",
    ).length;
    const activeTreatments = treatments.filter(
      (t) => t.status === "in_progress",
    ).length;
    const completedTreatmentsThisYear = treatments.filter(
      (t) => t.status === "completed" && t.performedAt >= yearStart,
    ).length;

    // Assessment schedules
    const schedules = await ctx.db
      .query("assessmentSchedules")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();

    const overdueAssessments = schedules.filter(
      (s) => s.nextDueDate && s.nextDueDate < now,
    ).length;

    // Insurance metrics
    const coverages = await ctx.db
      .query("insuranceCoverages")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .filter((q) => q.eq(q.field("status"), "active"))
      .collect();

    const policies = await ctx.db
      .query("insurancePolicies")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .filter((q) => q.eq(q.field("status"), "active"))
      .collect();

    const claims = await ctx.db
      .query("insuranceClaims")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .collect();

    const appraisals = await ctx.db
      .query("appraisals")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .collect();

    const coveredCollectionIds = new Set(
      coverages.flatMap((coverage) =>
        coverage.collectionId ? [coverage.collectionId] : [],
      ),
    );
    const totalCoveredValue = coverages.reduce(
      (sum, c) => sum + (c.coveredValue || 0),
      0,
    );
    const objectsWithCoverage = coveredCollectionIds.size;
    const objectsWithoutCoverage = totalObjects - objectsWithCoverage;

    const expiringPolicies = policies.filter(
      (p) => p.expirationDate && p.expirationDate < thirtyDaysFromNow,
    ).length;

    const pendingClaims = claims.filter(
      (c) => c.status === "submitted" || c.status === "under_review",
    ).length;

    const staleAppraisals = appraisals.filter(
      (a) => a.appraisalDate < threeYearsAgo,
    ).length;

    // Location metrics
    const locations = await ctx.db
      .query("locations")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();

    const objectsWithLocation = collections.filter(
      (c) => c.currentLocationId,
    ).length;
    const objectsWithoutLocation = totalObjects - objectsWithLocation;

    // Calculate occupancy
    const occupancyMap = new Map<string, number>();
    for (const c of collections) {
      if (c.currentLocationId) {
        occupancyMap.set(
          c.currentLocationId,
          (occupancyMap.get(c.currentLocationId) || 0) + 1,
        );
      }
    }

    const locationsWithCapacity = locations.filter(
      (l) => l.capacity != null && l.capacity > 0,
    );
    let atCapacityLocations = 0;
    let overCapacityLocations = 0;
    let totalCapacity = 0;
    let totalOccupied = 0;

    for (const loc of locationsWithCapacity) {
      const occupied = occupancyMap.get(loc._id) || 0;
      const capacity = loc.capacity ?? 0;
      totalCapacity += capacity;
      totalOccupied += occupied;

      if (occupied >= capacity && capacity > 0) {
        atCapacityLocations++;
      }
      if (occupied > capacity && capacity > 0) {
        overCapacityLocations++;
      }
    }

    const utilizationPercentage =
      totalCapacity > 0 ? Math.round((totalOccupied / totalCapacity) * 100) : 0;

    // Loan metrics
    const loans = await ctx.db
      .query("loans")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .collect();

    const activeLoans = loans.filter(
      (l) => l.status === "active" || l.status === "dispatched",
    ).length;
    const overdueLoans = loans.filter(
      (l) =>
        (l.status === "active" || l.status === "dispatched") &&
        l.endDate &&
        l.endDate < now,
    ).length;
    const dueSoon = loans.filter(
      (l) =>
        (l.status === "active" || l.status === "dispatched") &&
        l.endDate &&
        l.endDate >= now &&
        l.endDate < thirtyDaysFromNow,
    ).length;

    const returnedLoans = loans.filter((l) => l.status === "returned");
    const returnRate =
      loans.length > 0
        ? Math.round((returnedLoans.length / loans.length) * 100)
        : 0;

    // Calculate average loan duration using endDate as proxy for return date
    // (since there's no returnedDate field, we use the scheduled endDate)
    const completedLoans = returnedLoans.filter(
      (l) => l.endDate && l.startDate,
    );
    const averageLoanDuration =
      completedLoans.length > 0
        ? Math.round(
            completedLoans.reduce(
              (sum, l) => sum + ((l.endDate ?? 0) - l.startDate),
              0,
            ) /
              completedLoans.length /
              (24 * 60 * 60 * 1000),
          )
        : 0;

    // Media metrics
    const mediaFiles = await ctx.db
      .query("mediaFiles")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .collect();

    const collectionsWithMedia = new Set(mediaFiles.map((m) => m.collectionId));
    const objectsWithMedia = collectionsWithMedia.size;
    const objectsWithoutMedia = totalObjects - objectsWithMedia;
    const unknownRights = mediaFiles.filter(
      (m) => !m.rightsStatus || m.rightsStatus === "unknown",
    ).length;
    const expiringLicenses = mediaFiles.filter(
      (m) => m.licenseExpiry && m.licenseExpiry < thirtyDaysFromNow,
    ).length;

    // Calculate overall health score and recommendations
    let healthScore = 100;
    const criticalIssues: string[] = [];
    const warningIssues: string[] = [];
    const recommendations: string[] = [];

    // Conservation health
    const poorConditionPercent =
      totalObjects > 0 ? (conditionCounts.poor / totalObjects) * 100 : 0;
    if (poorConditionPercent > 20) {
      healthScore -= 20;
      criticalIssues.push("High percentage of objects in poor condition");
      recommendations.push(
        "Prioritize conservation treatments for objects in poor condition",
      );
    } else if (poorConditionPercent > 10) {
      healthScore -= 10;
      warningIssues.push("Elevated number of objects in poor condition");
    }

    if (overdueAssessments > 10) {
      healthScore -= 10;
      warningIssues.push("Multiple overdue conservation assessments");
      recommendations.push("Schedule overdue conservation assessments");
    }

    // Insurance health
    if (objectsWithoutCoverage > totalObjects * 0.3) {
      healthScore -= 15;
      criticalIssues.push("Many objects lack insurance coverage");
      recommendations.push("Review insurance coverage for uncovered objects");
    }

    if (expiringPolicies > 0) {
      healthScore -= 5;
      warningIssues.push(
        `${expiringPolicies} insurance policies expiring soon`,
      );
      recommendations.push("Renew expiring insurance policies");
    }

    if (staleAppraisals > totalObjects * 0.2) {
      healthScore -= 5;
      warningIssues.push("Many objects have stale appraisals");
      recommendations.push("Update appraisals older than 3 years");
    }

    // Location health
    if (objectsWithoutLocation > totalObjects * 0.1) {
      healthScore -= 10;
      warningIssues.push("Objects without assigned locations");
      recommendations.push("Assign locations to unlocated objects");
    }

    if (overCapacityLocations > 0) {
      healthScore -= 5;
      warningIssues.push(
        `${overCapacityLocations} locations are over capacity`,
      );
      recommendations.push("Redistribute objects from over-capacity locations");
    }

    // Loan health
    if (overdueLoans > activeLoans * 0.2 && activeLoans > 0) {
      healthScore -= 10;
      criticalIssues.push("High percentage of overdue loans");
      recommendations.push("Follow up on overdue loans");
    }

    // Media health
    if (objectsWithoutMedia > totalObjects * 0.5) {
      healthScore -= 5;
      warningIssues.push("Many objects lack media documentation");
      recommendations.push("Add photographs for undocumented objects");
    }

    if (unknownRights > mediaFiles.length * 0.3 && mediaFiles.length > 0) {
      healthScore -= 5;
      warningIssues.push("Many media files have unknown rights status");
      recommendations.push("Review and update media rights information");
    }

    // Ensure score is between 0 and 100
    healthScore = Math.max(0, Math.min(100, healthScore));

    return {
      conservation: {
        totalObjects,
        goodCondition: conditionCounts.good + conditionCounts.excellent,
        fairCondition: conditionCounts.fair,
        poorCondition: conditionCounts.poor,
        unknownCondition: conditionCounts.unknown,
        pendingTreatments,
        activeTreatments,
        completedTreatmentsThisYear,
        overdueAssessments,
      },
      insurance: {
        totalCoveredValue,
        objectsWithCoverage,
        objectsWithoutCoverage,
        expiringPolicies,
        pendingClaims,
        staleAppraisals,
      },
      locations: {
        totalLocations: locations.length,
        objectsWithLocation,
        objectsWithoutLocation,
        atCapacityLocations,
        overCapacityLocations,
        utilizationPercentage,
      },
      loans: {
        activeLoans,
        overdueLoans,
        dueSoon,
        returnRate,
        averageLoanDuration,
      },
      media: {
        totalMediaFiles: mediaFiles.length,
        objectsWithMedia,
        objectsWithoutMedia,
        unknownRights,
        expiringLicenses,
      },
      overall: {
        healthScore,
        criticalIssues: criticalIssues.length,
        warningIssues: warningIssues.length,
        recommendations,
      },
      generatedAt: now,
    };
  },
});

// ============================================
// HELPER FUNCTIONS
// ============================================

function calculateNextRun(
  schedule: string,
  scheduledDay?: number,
  scheduledTime?: string,
  _timezone?: string,
): number | undefined {
  if (schedule === "on_demand") {
    return undefined;
  }

  const now = new Date();
  const [hours, minutes] = (scheduledTime || "09:00").split(":").map(Number);

  const nextRun = new Date(now);
  nextRun.setHours(hours ?? 9, minutes ?? 0, 0, 0);

  if (schedule === "daily") {
    if (nextRun <= now) {
      nextRun.setDate(nextRun.getDate() + 1);
    }
  } else if (schedule === "weekly") {
    const targetDay = scheduledDay ?? 1; // Default to Monday
    const currentDay = nextRun.getDay();
    let daysUntilTarget = targetDay - currentDay;
    if (daysUntilTarget < 0 || (daysUntilTarget === 0 && nextRun <= now)) {
      daysUntilTarget += 7;
    }
    nextRun.setDate(nextRun.getDate() + daysUntilTarget);
  } else if (schedule === "monthly") {
    const targetDate = scheduledDay ?? 1; // Default to 1st
    nextRun.setDate(targetDate);
    if (nextRun <= now) {
      nextRun.setMonth(nextRun.getMonth() + 1);
    }
  } else if (schedule === "quarterly") {
    const targetDate = scheduledDay ?? 1;
    const currentMonth = nextRun.getMonth();
    const quarterStartMonth = Math.floor(currentMonth / 3) * 3;
    nextRun.setMonth(quarterStartMonth);
    nextRun.setDate(targetDate);
    if (nextRun <= now) {
      nextRun.setMonth(nextRun.getMonth() + 3);
    }
  }

  return nextRun.getTime();
}

function generateDateBuckets(
  startDate: number,
  endDate: number,
  period: "daily" | "weekly" | "monthly",
): Array<{ start: number; end: number; label: string }> {
  const buckets: Array<{ start: number; end: number; label: string }> = [];
  const current = new Date(startDate);

  while (current.getTime() < endDate) {
    const bucketStart = current.getTime();
    let bucketEnd: number;
    let label: string;

    if (period === "daily") {
      current.setDate(current.getDate() + 1);
      bucketEnd = current.getTime();
      label = new Date(bucketStart).toISOString().split("T")[0] ?? "";
    } else if (period === "weekly") {
      current.setDate(current.getDate() + 7);
      bucketEnd = current.getTime();
      const weekStart = new Date(bucketStart);
      label = `Week of ${weekStart.toISOString().split("T")[0]}`;
    } else {
      current.setMonth(current.getMonth() + 1);
      bucketEnd = current.getTime();
      const monthDate = new Date(bucketStart);
      label = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, "0")}`;
    }

    buckets.push({
      start: bucketStart,
      end: Math.min(bucketEnd, endDate),
      label,
    });
  }

  return buckets;
}
