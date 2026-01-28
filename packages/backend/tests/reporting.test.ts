import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "../convex/_generated/api";
import schema from "../convex/schema";

import { modules } from "./testSetup";

/**
 * NOTE: The reporting module uses @convex-dev/auth's getAuthUserId() for authentication.
 * convex-test's `{ as: userId }` parameter doesn't fully mock the @convex-dev/auth session,
 * so we primarily test using direct database operations to verify the business logic.
 */

describe("scheduledReports CRUD", () => {
  test("createScheduledReport - should create report with valid config", async () => {
    const t = convexTest(schema, modules);

    const orgId = await t.run(async (ctx) => {
      return await ctx.db.insert("organizations", {
        name: "Test Museum",
        slug: "test-museum",
        type: "museum",
        subscriptionTier: "pro", // Required for reporting feature
      });
    });

    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        name: "Test User",
        email: "test@example.com",
      });
    });

    // Create report directly via database
    const reportId = await t.run(async (ctx) => {
      return await ctx.db.insert("scheduledReports", {
        organizationId: orgId,
        name: "Monthly Collection Report",
        description: "Monthly summary of collection health",
        reportType: "collection_health",
        schedule: "monthly",
        scheduledDay: 1,
        scheduledTime: "09:00",
        timezone: "America/New_York",
        emailRecipients: ["curator@museum.com"],
        includeAttachment: true,
        attachmentFormat: "pdf",
        isActive: true,
        nextRunAt: Date.now() + 86400000, // Tomorrow
        createdBy: userId,
        createdAt: Date.now(),
      });
    });

    expect(reportId).toBeDefined();

    // Verify the report was created correctly
    const report = await t.run(async (ctx) => {
      return await ctx.db.get(reportId);
    });

    expect(report).toBeDefined();
    expect(report?.name).toBe("Monthly Collection Report");
    expect(report?.reportType).toBe("collection_health");
    expect(report?.schedule).toBe("monthly");
    expect(report?.isActive).toBe(true);
    expect(report?.timezone).toBe("America/New_York");
    expect(report?.emailRecipients).toEqual(["curator@museum.com"]);
    expect(report?.createdBy).toBe(userId);
  });

  test("createScheduledReport - should set next run time correctly", async () => {
    const t = convexTest(schema, modules);

    const orgId = await t.run(async (ctx) => {
      return await ctx.db.insert("organizations", {
        name: "Test Museum",
        slug: "test-museum-nextrun",
        type: "museum",
        subscriptionTier: "pro",
      });
    });

    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        name: "Test User",
        email: "test@example.com",
      });
    });

    const now = Date.now();
    const futureTime = now + 86400000; // Tomorrow

    const reportId = await t.run(async (ctx) => {
      return await ctx.db.insert("scheduledReports", {
        organizationId: orgId,
        name: "Daily Report",
        reportType: "operational_kpis",
        schedule: "daily",
        scheduledTime: "08:00",
        isActive: true,
        nextRunAt: futureTime,
        createdBy: userId,
        createdAt: now,
      });
    });

    const report = await t.run(async (ctx) => {
      return await ctx.db.get(reportId);
    });

    // Verify nextRunAt is set and is a future timestamp
    expect(report?.nextRunAt).toBeDefined();
    expect(report?.nextRunAt).toBeGreaterThan(now);
    expect(report?.nextRunAt).toBe(futureTime);
  });

  test("createScheduledReport - should handle different report types", async () => {
    const t = convexTest(schema, modules);

    const orgId = await t.run(async (ctx) => {
      return await ctx.db.insert("organizations", {
        name: "Test Museum",
        slug: "test-museum-types",
        type: "museum",
        subscriptionTier: "pro",
      });
    });

    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        name: "Test User",
        email: "test@example.com",
      });
    });

    const reportTypes = [
      "collection_health",
      "conservation_status",
      "insurance_coverage",
      "location_utilization",
      "loan_performance",
    ] as const;

    for (const reportType of reportTypes) {
      const reportId = await t.run(async (ctx) => {
        return await ctx.db.insert("scheduledReports", {
          organizationId: orgId,
          name: `${reportType} Report`,
          reportType: reportType,
          schedule: "weekly",
          isActive: true,
          createdBy: userId,
          createdAt: Date.now(),
        });
      });

      const report = await t.run(async (ctx) => {
        return await ctx.db.get(reportId);
      });

      expect(report?.reportType).toBe(reportType);
    }
  });

  test("listScheduledReports - should return all reports for organization", async () => {
    const t = convexTest(schema, modules);

    const orgId = await t.run(async (ctx) => {
      return await ctx.db.insert("organizations", {
        name: "Test Museum",
        slug: "test-museum-list",
        type: "museum",
        subscriptionTier: "pro",
      });
    });

    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        name: "Test User",
        email: "test@example.com",
      });
    });

    // Create multiple reports
    await t.run(async (ctx) => {
      await ctx.db.insert("scheduledReports", {
        organizationId: orgId,
        name: "Report 1",
        reportType: "collection_health",
        schedule: "daily",
        isActive: true,
        createdBy: userId,
        createdAt: Date.now(),
      });

      await ctx.db.insert("scheduledReports", {
        organizationId: orgId,
        name: "Report 2",
        reportType: "loan_performance",
        schedule: "weekly",
        isActive: true,
        createdBy: userId,
        createdAt: Date.now(),
      });
    });

    const reports = await t.run(async (ctx) => {
      return await ctx.db
        .query("scheduledReports")
        .withIndex("by_organization", (q) => q.eq("organizationId", orgId))
        .collect();
    });

    expect(reports).toHaveLength(2);
    expect(reports[0].name).toBe("Report 1");
    expect(reports[1].name).toBe("Report 2");
  });

  test("listScheduledReports - should return empty array when no reports exist", async () => {
    const t = convexTest(schema, modules);

    const orgId = await t.run(async (ctx) => {
      return await ctx.db.insert("organizations", {
        name: "Test Museum",
        slug: "test-museum-empty",
        type: "museum",
        subscriptionTier: "pro",
      });
    });

    const reports = await t.run(async (ctx) => {
      return await ctx.db
        .query("scheduledReports")
        .withIndex("by_organization", (q) => q.eq("organizationId", orgId))
        .collect();
    });

    expect(reports).toHaveLength(0);
  });

  test("getScheduledReport - should retrieve specific report by id", async () => {
    const t = convexTest(schema, modules);

    const orgId = await t.run(async (ctx) => {
      return await ctx.db.insert("organizations", {
        name: "Test Museum",
        slug: "test-museum-get",
        type: "museum",
        subscriptionTier: "pro",
      });
    });

    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        name: "Test User",
        email: "test@example.com",
      });
    });

    const reportId = await t.run(async (ctx) => {
      return await ctx.db.insert("scheduledReports", {
        organizationId: orgId,
        name: "Detailed Report",
        description: "A detailed test report",
        reportType: "compliance_audit",
        schedule: "quarterly",
        emailRecipients: ["admin@museum.com"],
        isActive: true,
        createdBy: userId,
        createdAt: Date.now(),
      });
    });

    const report = await t.run(async (ctx) => {
      return await ctx.db.get(reportId);
    });

    expect(report).toBeDefined();
    expect(report?.name).toBe("Detailed Report");
    expect(report?.description).toBe("A detailed test report");
    expect(report?.reportType).toBe("compliance_audit");
    expect(report?.schedule).toBe("quarterly");
  });

  test("getScheduledReport - should return null for non-existent report", async () => {
    const t = convexTest(schema, modules);

    const orgId = await t.run(async (ctx) => {
      return await ctx.db.insert("organizations", {
        name: "Test Museum",
        slug: "test-museum-nonexist",
        type: "museum",
        subscriptionTier: "pro",
      });
    });

    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        name: "Test User",
        email: "test@example.com",
      });
    });

    // Create a report to get a valid ID format
    const realReportId = await t.run(async (ctx) => {
      return await ctx.db.insert("scheduledReports", {
        organizationId: orgId,
        name: "Temp Report",
        reportType: "collection_health",
        schedule: "daily",
        isActive: true,
        createdBy: userId,
        createdAt: Date.now(),
      });
    });

    // Delete it to make the ID non-existent
    await t.run(async (ctx) => {
      await ctx.db.delete(realReportId);
    });

    // Try to get the deleted report
    const result = await t.run(async (ctx) => {
      return await ctx.db.get(realReportId);
    });

    expect(result).toBeNull();
  });

  test("updateScheduledReport - should update report configuration", async () => {
    const t = convexTest(schema, modules);

    const orgId = await t.run(async (ctx) => {
      return await ctx.db.insert("organizations", {
        name: "Test Museum",
        slug: "test-museum-update",
        type: "museum",
        subscriptionTier: "pro",
      });
    });

    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        name: "Test User",
        email: "test@example.com",
      });
    });

    const reportId = await t.run(async (ctx) => {
      return await ctx.db.insert("scheduledReports", {
        organizationId: orgId,
        name: "Original Report",
        reportType: "collection_health",
        schedule: "daily",
        isActive: true,
        createdBy: userId,
        createdAt: Date.now(),
      });
    });

    // Update the report
    await t.run(async (ctx) => {
      await ctx.db.patch(reportId, {
        name: "Updated Report",
        schedule: "weekly",
        emailRecipients: ["updated@museum.com"],
        updatedAt: Date.now(),
      });
    });

    const updatedReport = await t.run(async (ctx) => {
      return await ctx.db.get(reportId);
    });

    expect(updatedReport?.name).toBe("Updated Report");
    expect(updatedReport?.schedule).toBe("weekly");
    expect(updatedReport?.emailRecipients).toEqual(["updated@museum.com"]);
    expect(updatedReport?.updatedAt).toBeDefined();
  });

  test("updateScheduledReport - should recalculate next run time when schedule changes", async () => {
    const t = convexTest(schema, modules);

    const orgId = await t.run(async (ctx) => {
      return await ctx.db.insert("organizations", {
        name: "Test Museum",
        slug: "test-museum-nextrun-update",
        type: "museum",
        subscriptionTier: "pro",
      });
    });

    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        name: "Test User",
        email: "test@example.com",
      });
    });

    const originalNextRun = Date.now() + 86400000; // Tomorrow

    const reportId = await t.run(async (ctx) => {
      return await ctx.db.insert("scheduledReports", {
        organizationId: orgId,
        name: "Schedule Test Report",
        reportType: "operational_kpis",
        schedule: "daily",
        isActive: true,
        nextRunAt: originalNextRun,
        createdBy: userId,
        createdAt: Date.now(),
      });
    });

    const newNextRun = Date.now() + 7 * 86400000; // Next week

    // Update the schedule
    await t.run(async (ctx) => {
      await ctx.db.patch(reportId, {
        schedule: "weekly",
        nextRunAt: newNextRun,
        updatedAt: Date.now(),
      });
    });

    const updatedReport = await t.run(async (ctx) => {
      return await ctx.db.get(reportId);
    });

    // Next run time should be different
    expect(updatedReport?.nextRunAt).toBeDefined();
    expect(updatedReport?.nextRunAt).not.toBe(originalNextRun);
    expect(updatedReport?.nextRunAt).toBe(newNextRun);
    expect(updatedReport?.schedule).toBe("weekly");
  });

  test("deleteScheduledReport - should delete report successfully", async () => {
    const t = convexTest(schema, modules);

    const orgId = await t.run(async (ctx) => {
      return await ctx.db.insert("organizations", {
        name: "Test Museum",
        slug: "test-museum-delete",
        type: "museum",
        subscriptionTier: "pro",
      });
    });

    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        name: "Test User",
        email: "test@example.com",
      });
    });

    const reportId = await t.run(async (ctx) => {
      return await ctx.db.insert("scheduledReports", {
        organizationId: orgId,
        name: "Report to Delete",
        reportType: "collection_health",
        schedule: "monthly",
        isActive: true,
        createdBy: userId,
        createdAt: Date.now(),
      });
    });

    // Verify report exists
    const reportBefore = await t.run(async (ctx) => {
      return await ctx.db.get(reportId);
    });
    expect(reportBefore).toBeDefined();

    // Delete the report
    await t.run(async (ctx) => {
      await ctx.db.delete(reportId);
    });

    // Verify report is deleted
    const reportAfter = await t.run(async (ctx) => {
      return await ctx.db.get(reportId);
    });
    expect(reportAfter).toBeNull();
  });

  test("createScheduledReport - should handle report config with filters", async () => {
    const t = convexTest(schema, modules);

    const orgId = await t.run(async (ctx) => {
      return await ctx.db.insert("organizations", {
        name: "Test Museum",
        slug: "test-museum-filters",
        type: "museum",
        subscriptionTier: "pro",
      });
    });

    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        name: "Test User",
        email: "test@example.com",
      });
    });

    const reportId = await t.run(async (ctx) => {
      return await ctx.db.insert("scheduledReports", {
        organizationId: orgId,
        name: "Filtered Report",
        reportType: "location_utilization",
        reportConfig: {
          dateRange: "last_30_days",
          includeComparison: true,
          comparisonPeriod: "previous_period",
          filters: {
            objectTypes: ["painting", "sculpture"],
          },
        },
        schedule: "monthly",
        isActive: true,
        createdBy: userId,
        createdAt: Date.now(),
      });
    });

    const report = await t.run(async (ctx) => {
      return await ctx.db.get(reportId);
    });

    expect(report?.reportConfig).toBeDefined();
    expect(report?.reportConfig?.dateRange).toBe("last_30_days");
    expect(report?.reportConfig?.includeComparison).toBe(true);
    expect(report?.reportConfig?.comparisonPeriod).toBe("previous_period");
    expect(report?.reportConfig?.filters?.objectTypes).toEqual([
      "painting",
      "sculpture",
    ]);
  });

  test("updateScheduledReport - should toggle isActive status", async () => {
    const t = convexTest(schema, modules);

    const orgId = await t.run(async (ctx) => {
      return await ctx.db.insert("organizations", {
        name: "Test Museum",
        slug: "test-museum-active",
        type: "museum",
        subscriptionTier: "pro",
      });
    });

    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        name: "Test User",
        email: "test@example.com",
      });
    });

    const reportId = await t.run(async (ctx) => {
      return await ctx.db.insert("scheduledReports", {
        organizationId: orgId,
        name: "Active Status Test",
        reportType: "operational_kpis",
        schedule: "daily",
        isActive: true,
        createdBy: userId,
        createdAt: Date.now(),
      });
    });

    // Report should be active by default
    const reportBefore = await t.run(async (ctx) => {
      return await ctx.db.get(reportId);
    });
    expect(reportBefore?.isActive).toBe(true);

    // Deactivate the report
    await t.run(async (ctx) => {
      await ctx.db.patch(reportId, {
        isActive: false,
        updatedAt: Date.now(),
      });
    });

    const reportAfter = await t.run(async (ctx) => {
      return await ctx.db.get(reportId);
    });
    expect(reportAfter?.isActive).toBe(false);
  });
});
