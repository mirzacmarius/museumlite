import { getAuthUserId } from "@convex-dev/auth/server";
import { type Infer, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { query } from "./_generated/server";
import schema from "./schema";
import { requireFeatureAccess } from "./utils/featureGates";
import { internalMutation, mutation } from "./utils/mutationBuilders";
import { loadOperationalKpis } from "./utils/operationalKpis";
import { requirePermission } from "./utils/permissions";
import { openProjection } from "./utils/projectionReads";
import {
  assertTrendRange,
  buildCollectionHealth,
  buildCollectionTrendSeries,
  buildConservationTrendSeries,
  buildLoanTrendSeries,
} from "./utils/projectionReports";
import { projectionUnavailableResult } from "./utils/projectionValidators";
import { nextReportRun, validateReportSchedule } from "./utils/reportSchedule";

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

const outputStateValidator = v.union(
  v.literal("generated"),
  v.literal("stored"),
  v.literal("unavailable"),
);
const deliveryStateValidator = v.union(
  v.literal("delivered"),
  v.literal("unavailable"),
);

function runResultState(run: Doc<"reportRuns">) {
  const data: unknown = run.reportData;
  const generated =
    run.reportType === "operational_kpis" &&
    run.status === "success" &&
    data !== null &&
    typeof data === "object" &&
    "generatorVersion" in data &&
    data.generatorVersion === "v1" &&
    "inventory" in data &&
    "loans" in data &&
    "exhibitions" in data;
  return {
    outputState: generated
      ? run.artifact
        ? ("stored" as const)
        : ("generated" as const)
      : ("unavailable" as const),
    deliveryState:
      run.emailSentAt !== undefined && (run.emailsSent?.length ?? 0) > 0
        ? ("delivered" as const)
        : ("unavailable" as const),
  };
}

function validateKpiConfig(config: Doc<"scheduledReports">["reportConfig"]) {
  if (config && Object.values(config).some((value) => value !== undefined))
    throw new Error(
      "KPI reports are current snapshots. Date ranges, filters and comparisons are unavailable; clear the legacy configuration to retry.",
    );
}

function validateDelivery(args: {
  emailRecipients?: string[];
  emailSubject?: string;
  includeAttachment?: boolean;
  attachmentFormat?: string;
}) {
  if (
    args.emailRecipients !== undefined ||
    args.emailSubject !== undefined ||
    args.includeAttachment !== undefined ||
    args.attachmentFormat !== undefined
  )
    throw new Error(
      "Email delivery and attachment formats are unavailable. KPI output is stored as JSON.",
    );
}

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
    const [userId] = await Promise.all([
      getAuthUserId(ctx),

      requireFeatureAccess(ctx, args.organizationId, "reporting"),
      requirePermission(
        ctx,
        args.organizationId,
        "organization.manage_settings",
      ),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    if (args.reportType !== "operational_kpis") {
      throw new Error(
        "Report generator unavailable. Only operational KPIs are supported.",
      );
    }

    if (!args.name.trim() || args.name.length > 200)
      throw new Error("Enter a report name of 1–200 characters");

    validateKpiConfig(args.reportConfig);
    validateDelivery(args);
    const nextRunAt = calculateNextRun(
      args.schedule,
      args.scheduledDay,
      args.scheduledTime,
      args.timezone,
    );

    const reportId = await ctx.db.insert("scheduledReports", {
      organizationId: args.organizationId,
      name: args.name.trim(),
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
      scheduleRevision: 1,
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
    const [userId, report] = await Promise.all([
      getAuthUserId(ctx),
      ctx.db.get(args.reportId),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    if (!report) {
      throw new Error("Report not found");
    }

    await Promise.all([
      requireFeatureAccess(ctx, report.organizationId, "reporting"),
      requirePermission(
        ctx,
        report.organizationId,
        "organization.manage_settings",
      ),
    ]);

    if (
      args.name !== undefined &&
      (!args.name.trim() || args.name.length > 200)
    )
      throw new Error("Enter a report name of 1–200 characters");
    if (report.reportType !== "operational_kpis" && args.isActive === true)
      throw new Error("Report generator unavailable");
    if (args.reportConfig !== undefined) validateKpiConfig(args.reportConfig);
    validateDelivery(args);
    const schedule = args.schedule ?? report.schedule;
    const scheduledDay =
      args.scheduledDay ??
      (args.schedule !== undefined && args.schedule !== report.schedule
        ? undefined
        : report.scheduledDay);
    const scheduledTime = args.scheduledTime ?? report.scheduledTime;
    const timezone = args.timezone ?? report.timezone ?? "UTC";
    const isActive = args.isActive ?? report.isActive;
    const calendarChanged =
      args.schedule !== undefined ||
      args.scheduledDay !== undefined ||
      args.scheduledTime !== undefined ||
      args.timezone !== undefined ||
      args.isActive !== undefined;
    if (calendarChanged)
      validateReportSchedule({
        schedule,
        scheduledDay,
        scheduledTime,
        timezone,
      });
    const { reportId: _reportId, ...provided } = args;
    const updates: Partial<Doc<"scheduledReports">> = {
      ...provided,
      updatedAt: Date.now(),
      ...(args.name !== undefined ? { name: args.name.trim() } : {}),
    };
    if (calendarChanged) {
      updates.scheduledDay = scheduledDay;
      updates.scheduleRevision = (report.scheduleRevision ?? 0) + 1;
      updates.nextRunAt = isActive
        ? nextReportRun({ schedule, scheduledDay, scheduledTime, timezone })
        : undefined;
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
    const [userId, report] = await Promise.all([
      getAuthUserId(ctx),
      ctx.db.get(args.reportId),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    if (!report) {
      throw new Error("Report not found");
    }
    await Promise.all([
      requireFeatureAccess(ctx, report.organizationId, "reporting"),
      requirePermission(
        ctx,
        report.organizationId,
        "organization.manage_settings",
      ),
      ctx.db.delete(args.reportId),
    ] as const);

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
      scheduledDay: v.optional(v.number()),
      scheduledTime: v.optional(v.string()),
      timezone: v.optional(v.string()),
      generatorAvailable: v.boolean(),
      lastRunError: v.optional(v.string()),
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
    await Promise.all([
      requireFeatureAccess(ctx, args.organizationId, "reporting"),
      requirePermission(
        ctx,
        args.organizationId,
        "organization.view_analytics",
      ),
    ]);
    const reports = await ctx.db
      .query("scheduledReports")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .take(100);

    return reports.map((r) => ({
      _id: r._id,
      name: r.name,
      description: r.description,
      reportType: r.reportType,
      schedule: r.schedule,
      scheduledDay: r.scheduledDay,
      scheduledTime: r.scheduledTime,
      timezone: r.timezone,
      generatorAvailable: r.reportType === "operational_kpis",
      lastRunError: r.lastRunError,
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
    await Promise.all([
      requireFeatureAccess(ctx, report.organizationId, "reporting"),
      requirePermission(
        ctx,
        report.organizationId,
        "organization.view_analytics",
      ),
    ]);
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
    const [userId, report] = await Promise.all([
      getAuthUserId(ctx),
      ctx.db.get(args.reportId),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    if (!report) {
      throw new Error("Report not found");
    }
    await Promise.all([
      requireFeatureAccess(ctx, report.organizationId, "reporting"),
      requirePermission(
        ctx,
        report.organizationId,
        "organization.view_analytics",
      ),
    ]);
    const runId = await ctx.db.insert("reportRuns", {
      organizationId: report.organizationId,
      scheduledReportId: args.reportId,
      reportType: report.reportType,
      reportName: report.name,
      startedAt: Date.now(),
      lastAttemptAt: Date.now(),
      attemptCount: 1,
      scheduleRevision: report.scheduleRevision ?? 0,
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

/** Retry the same logical run; an interrupted worker becomes recoverable after 15 minutes. */
export const retryReportRun = mutation({
  args: { runId: v.id("reportRuns") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.runId);
    if (!run) throw new Error("Report run not found");
    await requireFeatureAccess(ctx, run.organizationId, "reporting");
    await requirePermission(
      ctx,
      run.organizationId,
      "organization.view_analytics",
    );
    if (
      run.status === "running" &&
      Date.now() - (run.lastAttemptAt ?? run.startedAt) < 15 * 60_000
    )
      throw new Error("Report is already running");
    if (run.status !== "failed" && run.status !== "running")
      throw new Error("This run cannot be retried");
    const report = run.scheduledReportId
      ? await ctx.db.get(run.scheduledReportId)
      : null;
    if (!report || report.organizationId !== run.organizationId)
      throw new Error("Report configuration not found");
    if (
      report.reportType !== "operational_kpis" ||
      report.reportType !== run.reportType
    )
      throw new Error("Report generator unavailable");
    validateKpiConfig(report.reportConfig);
    await ctx.db.patch(run._id, {
      status: "running",
      completedAt: undefined,
      errorMessage: undefined,
      lastAttemptAt: Date.now(),
      attemptCount: (run.attemptCount ?? 1) + 1,
    });
    await ctx.scheduler.runAfter(0, internal.reporting.generateReport, {
      runId: run._id,
      reportId: report._id,
    });
    return null;
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
      scheduledReportId: v.optional(v.id("scheduledReports")),
      outputState: outputStateValidator,
      deliveryState: deliveryStateValidator,
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
    await Promise.all([
      requireFeatureAccess(ctx, args.organizationId, "reporting"),
      requirePermission(
        ctx,
        args.organizationId,
        "organization.view_analytics",
      ),
    ]);

    if (
      args.limit !== undefined &&
      (!Number.isInteger(args.limit) || args.limit < 1 || args.limit > 100)
    )
      throw new Error("Run limit must be between 1 and 100");
    if (args.scheduledReportId) {
      const report = await ctx.db.get(args.scheduledReportId);
      if (!report || report.organizationId !== args.organizationId)
        throw new Error("Report not found");
    }
    const runs = args.scheduledReportId
      ? await ctx.db
          .query("reportRuns")
          .withIndex("by_scheduled_report", (q) =>
            q.eq("scheduledReportId", args.scheduledReportId),
          )
          .order("desc")
          .take(args.limit ?? 50)
      : await ctx.db
          .query("reportRuns")
          .withIndex("by_organization", (q) =>
            q.eq("organizationId", args.organizationId),
          )
          .order("desc")
          .take(args.limit ?? 50);

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
          ...runResultState(run),
          scheduledReportId: run.scheduledReportId,
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

export const getReportRun = query({
  args: { runId: v.id("reportRuns") },
  returns: v.union(
    v.object({
      ...schema.tables.reportRuns.validator.fields,
      _id: v.id("reportRuns"),
      _creationTime: v.number(),
      outputState: outputStateValidator,
      deliveryState: deliveryStateValidator,
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.runId);
    if (!run) return null;
    await requireFeatureAccess(ctx, run.organizationId, "reporting");
    await requirePermission(
      ctx,
      run.organizationId,
      "organization.view_analytics",
    );
    return { ...run, ...runResultState(run) };
  },
});

/**
 * Internal: Process scheduled reports that are due to run
 */
export const processDueReports = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const now = Date.now();

    const dueReports = await ctx.db
      .query("scheduledReports")
      .withIndex("by_next_run", (q) =>
        q.eq("isActive", true).gt("nextRunAt", 0).lte("nextRunAt", now),
      )
      .take(25);

    for (const report of dueReports) {
      if (report.nextRunAt === undefined || report.schedule === "on_demand")
        continue;
      let nextRunAt: number | undefined;
      try {
        nextRunAt = calculateNextRun(
          report.schedule,
          report.scheduledDay,
          report.scheduledTime,
          report.timezone,
        );
      } catch (error) {
        await ctx.db.patch(report._id, {
          isActive: false,
          lastRunStatus: "failed",
          lastRunError:
            error instanceof Error ? error.message : "Invalid schedule",
          nextRunAt: undefined,
        });
        continue;
      }
      const scheduleRevision = report.scheduleRevision ?? 0;
      const existing = await ctx.db
        .query("reportRuns")
        .withIndex(
          "by_scheduledReportId_and_scheduleRevision_and_scheduledFor",
          (q) =>
            q
              .eq("scheduledReportId", report._id)
              .eq("scheduleRevision", scheduleRevision)
              .eq("scheduledFor", report.nextRunAt),
        )
        .first();
      await ctx.db.patch(report._id, { nextRunAt });
      if (existing) continue;
      const runId = await ctx.db.insert("reportRuns", {
        organizationId: report.organizationId,
        scheduledReportId: report._id,
        reportType: report.reportType,
        reportName: report.name,
        scheduledFor: report.nextRunAt,
        scheduleRevision,
        startedAt: now,
        lastAttemptAt: now,
        attemptCount: 1,
        status: "running",
        triggeredBy: "schedule",
      });
      await ctx.scheduler.runAfter(0, internal.reporting.generateReport, {
        runId,
        reportId: report._id,
      });
    }

    return null;
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
    const run = await ctx.db.get(args.runId);
    if (
      !run ||
      run.status !== "running" ||
      run.scheduledReportId !== args.reportId
    )
      return null;
    const report = await ctx.db.get(args.reportId);
    if (!report) {
      await ctx.db.patch(args.runId, {
        status: "failed",
        errorMessage: "Report configuration not found",
        completedAt: Date.now(),
      });
      return null;
    }

    if (
      report.organizationId !== run.organizationId ||
      report.reportType !== run.reportType
    ) {
      await ctx.db.patch(run._id, {
        status: "failed",
        errorMessage: "Report identity mismatch",
        completedAt: Date.now(),
      });
      return null;
    }
    try {
      await requireFeatureAccess(ctx, report.organizationId, "reporting");
      validateKpiConfig(report.reportConfig);
      const generatedAt = Date.now();
      let reportData: Record<string, unknown>;

      if (report.reportType === "operational_kpis") {
        const kpis = await loadOperationalKpis(
          ctx,
          report.organizationId,
          generatedAt,
        );
        if (kpis.availability === "unavailable") {
          throw new Error(
            `Organization metrics are unavailable (${kpis.reason}); rebuild projections in settings and retry`,
          );
        }
        reportData = {
          generatedAt: kpis.generatedAt,
          asOf: kpis.asOf,
          definitionId: kpis.definitionId,
          scope: kpis.scope,
          reportType: report.reportType,
          organizationId: report.organizationId,
          generatorVersion: "v1",
          inventory: kpis.inventory,
          loans: kpis.loans,
          exhibitions: kpis.exhibitions,
          kpiGeneratedAt: kpis.generatedAt,
        };
      } else {
        throw new Error("Report generator unavailable");
      }

      // Update run record with success
      await ctx.db.patch(args.runId, {
        status: "success",
        completedAt: Date.now(),
        reportData,
        artifact: {
          schemaVersion: 1,
          format: "json",
          content: JSON.stringify(reportData, null, 2),
          generatedAt,
          storedAt: Date.now(),
        },
      });

      await ctx.db.patch(args.reportId, {
        lastRunAt: Date.now(),
        lastRunStatus: "success",
        lastRunError: undefined,
      });

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
  returns: v.union(
    projectionUnavailableResult,
    v.object({
      availability: v.literal("ready"),
      current: v.array(
        v.object({
          date: v.string(),
          timestamp: v.number(),
          totalObjects: v.union(v.number(), v.null()),
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
            totalObjects: v.union(v.number(), v.null()),
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
      historicalTotalAvailability: v.literal("unavailable"),
      historicalTotalUnavailableReason: v.literal(
        "historical_inventory_evidence_not_recorded",
      ),
    }),
  ),
  handler: async (ctx, args) => {
    await Promise.all([
      requireFeatureAccess(ctx, args.organizationId, "reporting"),
      requirePermission(
        ctx,
        args.organizationId,
        "organization.view_analytics",
      ),
    ]);
    assertTrendRange(args.startDate, args.endDate, args.period);
    const opened = await openProjection(ctx, args.organizationId);
    if (!opened.ok) return opened.unavailable;
    const currentData = await buildCollectionTrendSeries(
      opened.reader,
      generateDateBuckets(args.startDate, args.endDate, args.period),
    );
    const periodLength = args.endDate - args.startDate;
    const comparisonData = args.includeComparison
      ? await buildCollectionTrendSeries(
          opened.reader,
          generateDateBuckets(
            args.startDate - periodLength,
            args.startDate,
            args.period,
          ),
        )
      : undefined;

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
      availability: "ready" as const,
      current: currentData,
      comparison: comparisonData,
      summary: {
        currentPeriodNet,
        comparisonPeriodNet,
        percentChange,
      },
      historicalTotalAvailability: "unavailable" as const,
      historicalTotalUnavailableReason:
        "historical_inventory_evidence_not_recorded" as const,
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
  returns: v.union(
    projectionUnavailableResult,
    v.object({
      availability: v.literal("ready"),
      buckets: v.array(
        v.object({
          date: v.string(),
          timestamp: v.number(),
          newLoans: v.number(),
          returnedLoans: v.number(),
          activeLoans: v.number(),
          overdueLoans: v.number(),
        }),
      ),
    }),
  ),
  handler: async (ctx, args) => {
    await Promise.all([
      requireFeatureAccess(ctx, args.organizationId, "reporting"),
      requirePermission(
        ctx,
        args.organizationId,
        "organization.view_analytics",
      ),
    ]);
    assertTrendRange(args.startDate, args.endDate, args.period);
    const opened = await openProjection(ctx, args.organizationId);
    if (!opened.ok) return opened.unavailable;
    return {
      availability: "ready" as const,
      buckets: await buildLoanTrendSeries(
        opened.reader,
        generateDateBuckets(args.startDate, args.endDate, args.period),
      ),
    };
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
  returns: v.union(
    projectionUnavailableResult,
    v.object({
      availability: v.literal("ready"),
      buckets: v.array(
        v.object({
          date: v.string(),
          timestamp: v.number(),
          newTreatments: v.number(),
          completedTreatments: v.number(),
          totalCost: v.number(),
          averageDuration: v.optional(v.number()),
        }),
      ),
    }),
  ),
  handler: async (ctx, args) => {
    await Promise.all([
      requireFeatureAccess(ctx, args.organizationId, "reporting"),
      requirePermission(
        ctx,
        args.organizationId,
        "organization.view_analytics",
      ),
    ]);
    assertTrendRange(args.startDate, args.endDate, args.period);
    const opened = await openProjection(ctx, args.organizationId);
    if (!opened.ok) return opened.unavailable;
    return {
      availability: "ready" as const,
      buckets: await buildConservationTrendSeries(
        opened.reader,
        generateDateBuckets(args.startDate, args.endDate, args.period),
      ),
    };
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
    now: v.number(),
  },
  returns: v.union(
    projectionUnavailableResult,
    v.object({
      availability: v.literal("ready"),
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
  ),
  handler: async (ctx, args) => {
    await Promise.all([
      requireFeatureAccess(ctx, args.organizationId, "reporting"),
      requirePermission(
        ctx,
        args.organizationId,
        "organization.view_analytics",
      ),
    ]);
    return await buildCollectionHealth(ctx, args.organizationId, args.now);
  },
});

// ============================================
// HELPER FUNCTIONS
// ============================================

function calculateNextRun(
  schedule: Infer<typeof scheduleValidator>,
  scheduledDay?: number,
  scheduledTime?: string,
  _timezone?: string,
): number | undefined {
  return nextReportRun({
    schedule,
    scheduledDay,
    scheduledTime,
    timezone: _timezone,
  });
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
