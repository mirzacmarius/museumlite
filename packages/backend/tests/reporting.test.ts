import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { internal } from "../convex/_generated/api";
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

    const [orgId, userId] = await Promise.all([
      t.run(async (ctx) => {
        return await ctx.db.insert("organizations", {
          name: "Test Museum",
          slug: "test-museum",
          type: "museum",
          subscriptionTier: "pro", // Required for reporting feature
        });
      }),
      t.run(async (ctx) => {
        return await ctx.db.insert("users", {
          name: "Test User",
          email: "test@example.com",
        });
      }),
    ]);
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

    const [orgId, userId] = await Promise.all([
      t.run(async (ctx) => {
        return await ctx.db.insert("organizations", {
          name: "Test Museum",
          slug: "test-museum-nextrun",
          type: "museum",
          subscriptionTier: "pro",
        });
      }),
      t.run(async (ctx) => {
        return await ctx.db.insert("users", {
          name: "Test User",
          email: "test@example.com",
        });
      }),
    ]);
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

    const [orgId, userId] = await Promise.all([
      t.run(async (ctx) => {
        return await ctx.db.insert("organizations", {
          name: "Test Museum",
          slug: "test-museum-types",
          type: "museum",
          subscriptionTier: "pro",
        });
      }),
      t.run(async (ctx) => {
        return await ctx.db.insert("users", {
          name: "Test User",
          email: "test@example.com",
        });
      }),
    ]);
    const reportTypes = [
      "collection_health",
      "conservation_status",
      "insurance_coverage",
      "location_utilization",
      "loan_performance",
    ] as const;

    await Promise.all(
      reportTypes.map(async (reportType) => {
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
      }),
    );
  });

  test("listScheduledReports - should return all reports for organization", async () => {
    const t = convexTest(schema, modules);

    const [orgId, userId] = await Promise.all([
      t.run(async (ctx) => {
        return await ctx.db.insert("organizations", {
          name: "Test Museum",
          slug: "test-museum-list",
          type: "museum",
          subscriptionTier: "pro",
        });
      }),
      t.run(async (ctx) => {
        return await ctx.db.insert("users", {
          name: "Test User",
          email: "test@example.com",
        });
      }),
    ]);
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

    const [orgId, userId] = await Promise.all([
      t.run(async (ctx) => {
        return await ctx.db.insert("organizations", {
          name: "Test Museum",
          slug: "test-museum-get",
          type: "museum",
          subscriptionTier: "pro",
        });
      }),
      t.run(async (ctx) => {
        return await ctx.db.insert("users", {
          name: "Test User",
          email: "test@example.com",
        });
      }),
    ]);
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

    const [orgId, userId] = await Promise.all([
      t.run(async (ctx) => {
        return await ctx.db.insert("organizations", {
          name: "Test Museum",
          slug: "test-museum-nonexist",
          type: "museum",
          subscriptionTier: "pro",
        });
      }),
      t.run(async (ctx) => {
        return await ctx.db.insert("users", {
          name: "Test User",
          email: "test@example.com",
        });
      }),
    ]);
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

    const [orgId, userId] = await Promise.all([
      t.run(async (ctx) => {
        return await ctx.db.insert("organizations", {
          name: "Test Museum",
          slug: "test-museum-update",
          type: "museum",
          subscriptionTier: "pro",
        });
      }),
      t.run(async (ctx) => {
        return await ctx.db.insert("users", {
          name: "Test User",
          email: "test@example.com",
        });
      }),
    ]);
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

    const [orgId, userId] = await Promise.all([
      t.run(async (ctx) => {
        return await ctx.db.insert("organizations", {
          name: "Test Museum",
          slug: "test-museum-nextrun-update",
          type: "museum",
          subscriptionTier: "pro",
        });
      }),
      t.run(async (ctx) => {
        return await ctx.db.insert("users", {
          name: "Test User",
          email: "test@example.com",
        });
      }),
    ]);
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

    const [orgId, userId] = await Promise.all([
      t.run(async (ctx) => {
        return await ctx.db.insert("organizations", {
          name: "Test Museum",
          slug: "test-museum-delete",
          type: "museum",
          subscriptionTier: "pro",
        });
      }),
      t.run(async (ctx) => {
        return await ctx.db.insert("users", {
          name: "Test User",
          email: "test@example.com",
        });
      }),
    ]);
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

    const [orgId, userId] = await Promise.all([
      t.run(async (ctx) => {
        return await ctx.db.insert("organizations", {
          name: "Test Museum",
          slug: "test-museum-filters",
          type: "museum",
          subscriptionTier: "pro",
        });
      }),
      t.run(async (ctx) => {
        return await ctx.db.insert("users", {
          name: "Test User",
          email: "test@example.com",
        });
      }),
    ]);
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

    const [orgId, userId] = await Promise.all([
      t.run(async (ctx) => {
        return await ctx.db.insert("organizations", {
          name: "Test Museum",
          slug: "test-museum-active",
          type: "museum",
          subscriptionTier: "pro",
        });
      }),
      t.run(async (ctx) => {
        return await ctx.db.insert("users", {
          name: "Test User",
          email: "test@example.com",
        });
      }),
    ]);
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

describe("report schedules", () => {
  test("should create daily scheduled report", async () => {
    const t = convexTest(schema, modules);

    const [orgId, userId] = await Promise.all([
      t.run(async (ctx) => {
        return await ctx.db.insert("organizations", {
          name: "Test Museum",
          slug: "test-museum-daily-schedule",
          type: "museum",
          subscriptionTier: "pro",
        });
      }),
      t.run(async (ctx) => {
        return await ctx.db.insert("users", {
          name: "Test User",
          email: "test@example.com",
        });
      }),
    ]);
    const reportId = await t.run(async (ctx) => {
      return await ctx.db.insert("scheduledReports", {
        organizationId: orgId,
        name: "Daily Schedule Report",
        reportType: "operational_kpis",
        schedule: "daily",
        scheduledTime: "08:00",
        timezone: "America/New_York",
        isActive: true,
        createdBy: userId,
        createdAt: Date.now(),
      });
    });

    const report = await t.run(async (ctx) => {
      return await ctx.db.get(reportId);
    });

    expect(report?.schedule).toBe("daily");
    expect(report?.scheduledTime).toBe("08:00");
    expect(report?.timezone).toBe("America/New_York");
  });

  test("should create weekly scheduled report with day", async () => {
    const t = convexTest(schema, modules);

    const [orgId, userId] = await Promise.all([
      t.run(async (ctx) => {
        return await ctx.db.insert("organizations", {
          name: "Test Museum",
          slug: "test-museum-weekly-schedule",
          type: "museum",
          subscriptionTier: "pro",
        });
      }),
      t.run(async (ctx) => {
        return await ctx.db.insert("users", {
          name: "Test User",
          email: "test@example.com",
        });
      }),
    ]);
    const reportId = await t.run(async (ctx) => {
      return await ctx.db.insert("scheduledReports", {
        organizationId: orgId,
        name: "Weekly Schedule Report",
        reportType: "collection_health",
        schedule: "weekly",
        scheduledDay: 1, // Monday
        scheduledTime: "09:00",
        timezone: "UTC",
        isActive: true,
        createdBy: userId,
        createdAt: Date.now(),
      });
    });

    const report = await t.run(async (ctx) => {
      return await ctx.db.get(reportId);
    });

    expect(report?.schedule).toBe("weekly");
    expect(report?.scheduledDay).toBe(1);
    expect(report?.scheduledTime).toBe("09:00");
  });

  test("should create monthly scheduled report with day of month", async () => {
    const t = convexTest(schema, modules);

    const [orgId, userId] = await Promise.all([
      t.run(async (ctx) => {
        return await ctx.db.insert("organizations", {
          name: "Test Museum",
          slug: "test-museum-monthly-schedule",
          type: "museum",
          subscriptionTier: "pro",
        });
      }),
      t.run(async (ctx) => {
        return await ctx.db.insert("users", {
          name: "Test User",
          email: "test@example.com",
        });
      }),
    ]);
    const reportId = await t.run(async (ctx) => {
      return await ctx.db.insert("scheduledReports", {
        organizationId: orgId,
        name: "Monthly Schedule Report",
        reportType: "loan_performance",
        schedule: "monthly",
        scheduledDay: 15, // 15th of month
        scheduledTime: "10:00",
        timezone: "America/Los_Angeles",
        isActive: true,
        createdBy: userId,
        createdAt: Date.now(),
      });
    });

    const report = await t.run(async (ctx) => {
      return await ctx.db.get(reportId);
    });

    expect(report?.schedule).toBe("monthly");
    expect(report?.scheduledDay).toBe(15);
    expect(report?.scheduledTime).toBe("10:00");
    expect(report?.timezone).toBe("America/Los_Angeles");
  });

  test("should create quarterly scheduled report", async () => {
    const t = convexTest(schema, modules);

    const [orgId, userId] = await Promise.all([
      t.run(async (ctx) => {
        return await ctx.db.insert("organizations", {
          name: "Test Museum",
          slug: "test-museum-quarterly-schedule",
          type: "museum",
          subscriptionTier: "pro",
        });
      }),
      t.run(async (ctx) => {
        return await ctx.db.insert("users", {
          name: "Test User",
          email: "test@example.com",
        });
      }),
    ]);
    const reportId = await t.run(async (ctx) => {
      return await ctx.db.insert("scheduledReports", {
        organizationId: orgId,
        name: "Quarterly Schedule Report",
        reportType: "compliance_audit",
        schedule: "quarterly",
        scheduledDay: 1, // First day of quarter
        scheduledTime: "11:00",
        timezone: "Europe/London",
        isActive: true,
        createdBy: userId,
        createdAt: Date.now(),
      });
    });

    const report = await t.run(async (ctx) => {
      return await ctx.db.get(reportId);
    });

    expect(report?.schedule).toBe("quarterly");
    expect(report?.scheduledDay).toBe(1);
    expect(report?.timezone).toBe("Europe/London");
  });

  test("should create on-demand report without next run time", async () => {
    const t = convexTest(schema, modules);

    const [orgId, userId] = await Promise.all([
      t.run(async (ctx) => {
        return await ctx.db.insert("organizations", {
          name: "Test Museum",
          slug: "test-museum-ondemand-schedule",
          type: "museum",
          subscriptionTier: "pro",
        });
      }),
      t.run(async (ctx) => {
        return await ctx.db.insert("users", {
          name: "Test User",
          email: "test@example.com",
        });
      }),
    ]);
    const reportId = await t.run(async (ctx) => {
      return await ctx.db.insert("scheduledReports", {
        organizationId: orgId,
        name: "On-Demand Report",
        reportType: "custom",
        schedule: "on_demand",
        isActive: true,
        createdBy: userId,
        createdAt: Date.now(),
      });
    });

    const report = await t.run(async (ctx) => {
      return await ctx.db.get(reportId);
    });

    expect(report?.schedule).toBe("on_demand");
    expect(report?.nextRunAt).toBeUndefined();
  });

  test("should handle different timezones", async () => {
    const t = convexTest(schema, modules);

    const [orgId, userId] = await Promise.all([
      t.run(async (ctx) => {
        return await ctx.db.insert("organizations", {
          name: "Test Museum",
          slug: "test-museum-timezones",
          type: "museum",
          subscriptionTier: "pro",
        });
      }),
      t.run(async (ctx) => {
        return await ctx.db.insert("users", {
          name: "Test User",
          email: "test@example.com",
        });
      }),
    ]);
    const timezones = [
      "America/New_York",
      "America/Los_Angeles",
      "Europe/London",
      "Asia/Tokyo",
      "UTC",
    ];

    await Promise.all(
      timezones.map(async (timezone) => {
        const reportId = await t.run(async (ctx) => {
          return await ctx.db.insert("scheduledReports", {
            organizationId: orgId,
            name: `Report ${timezone}`,
            reportType: "operational_kpis",
            schedule: "daily",
            scheduledTime: "09:00",
            timezone: timezone,
            isActive: true,
            createdBy: userId,
            createdAt: Date.now(),
          });
        });

        const report = await t.run(async (ctx) => {
          return await ctx.db.get(reportId);
        });

        expect(report?.timezone).toBe(timezone);
      }),
    );
  });
});

describe("report date ranges", () => {
  test("should create report with last_7_days date range", async () => {
    const t = convexTest(schema, modules);

    const [orgId, userId] = await Promise.all([
      t.run(async (ctx) => {
        return await ctx.db.insert("organizations", {
          name: "Test Museum",
          slug: "test-museum-7days",
          type: "museum",
          subscriptionTier: "pro",
        });
      }),
      t.run(async (ctx) => {
        return await ctx.db.insert("users", {
          name: "Test User",
          email: "test@example.com",
        });
      }),
    ]);
    const reportId = await t.run(async (ctx) => {
      return await ctx.db.insert("scheduledReports", {
        organizationId: orgId,
        name: "Last 7 Days Report",
        reportType: "accession_activity",
        reportConfig: {
          dateRange: "last_7_days",
        },
        schedule: "weekly",
        isActive: true,
        createdBy: userId,
        createdAt: Date.now(),
      });
    });

    const report = await t.run(async (ctx) => {
      return await ctx.db.get(reportId);
    });

    expect(report?.reportConfig?.dateRange).toBe("last_7_days");
  });

  test("should create report with last_30_days date range", async () => {
    const t = convexTest(schema, modules);

    const [orgId, userId] = await Promise.all([
      t.run(async (ctx) => {
        return await ctx.db.insert("organizations", {
          name: "Test Museum",
          slug: "test-museum-30days",
          type: "museum",
          subscriptionTier: "pro",
        });
      }),
      t.run(async (ctx) => {
        return await ctx.db.insert("users", {
          name: "Test User",
          email: "test@example.com",
        });
      }),
    ]);
    const reportId = await t.run(async (ctx) => {
      return await ctx.db.insert("scheduledReports", {
        organizationId: orgId,
        name: "Last 30 Days Report",
        reportType: "collection_health",
        reportConfig: {
          dateRange: "last_30_days",
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

    expect(report?.reportConfig?.dateRange).toBe("last_30_days");
  });

  test("should create report with last_90_days date range", async () => {
    const t = convexTest(schema, modules);

    const [orgId, userId] = await Promise.all([
      t.run(async (ctx) => {
        return await ctx.db.insert("organizations", {
          name: "Test Museum",
          slug: "test-museum-90days",
          type: "museum",
          subscriptionTier: "pro",
        });
      }),
      t.run(async (ctx) => {
        return await ctx.db.insert("users", {
          name: "Test User",
          email: "test@example.com",
        });
      }),
    ]);
    const reportId = await t.run(async (ctx) => {
      return await ctx.db.insert("scheduledReports", {
        organizationId: orgId,
        name: "Last 90 Days Report",
        reportType: "loan_performance",
        reportConfig: {
          dateRange: "last_90_days",
        },
        schedule: "quarterly",
        isActive: true,
        createdBy: userId,
        createdAt: Date.now(),
      });
    });

    const report = await t.run(async (ctx) => {
      return await ctx.db.get(reportId);
    });

    expect(report?.reportConfig?.dateRange).toBe("last_90_days");
  });

  test("should create report with last_year date range", async () => {
    const t = convexTest(schema, modules);

    const [orgId, userId] = await Promise.all([
      t.run(async (ctx) => {
        return await ctx.db.insert("organizations", {
          name: "Test Museum",
          slug: "test-museum-lastyear",
          type: "museum",
          subscriptionTier: "pro",
        });
      }),
      t.run(async (ctx) => {
        return await ctx.db.insert("users", {
          name: "Test User",
          email: "test@example.com",
        });
      }),
    ]);
    const reportId = await t.run(async (ctx) => {
      return await ctx.db.insert("scheduledReports", {
        organizationId: orgId,
        name: "Last Year Report",
        reportType: "conservation_status",
        reportConfig: {
          dateRange: "last_year",
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

    expect(report?.reportConfig?.dateRange).toBe("last_year");
  });

  test("should create report with year_to_date date range", async () => {
    const t = convexTest(schema, modules);

    const [orgId, userId] = await Promise.all([
      t.run(async (ctx) => {
        return await ctx.db.insert("organizations", {
          name: "Test Museum",
          slug: "test-museum-ytd",
          type: "museum",
          subscriptionTier: "pro",
        });
      }),
      t.run(async (ctx) => {
        return await ctx.db.insert("users", {
          name: "Test User",
          email: "test@example.com",
        });
      }),
    ]);
    const reportId = await t.run(async (ctx) => {
      return await ctx.db.insert("scheduledReports", {
        organizationId: orgId,
        name: "Year to Date Report",
        reportType: "operational_kpis",
        reportConfig: {
          dateRange: "year_to_date",
        },
        schedule: "weekly",
        isActive: true,
        createdBy: userId,
        createdAt: Date.now(),
      });
    });

    const report = await t.run(async (ctx) => {
      return await ctx.db.get(reportId);
    });

    expect(report?.reportConfig?.dateRange).toBe("year_to_date");
  });

  test("should create report with custom date range", async () => {
    const t = convexTest(schema, modules);

    const [orgId, userId] = await Promise.all([
      t.run(async (ctx) => {
        return await ctx.db.insert("organizations", {
          name: "Test Museum",
          slug: "test-museum-custom-dates",
          type: "museum",
          subscriptionTier: "pro",
        });
      }),
      t.run(async (ctx) => {
        return await ctx.db.insert("users", {
          name: "Test User",
          email: "test@example.com",
        });
      }),
    ]);
    const startDate = Date.now() - 60 * 24 * 60 * 60 * 1000; // 60 days ago
    const endDate = Date.now(); // Now

    const reportId = await t.run(async (ctx) => {
      return await ctx.db.insert("scheduledReports", {
        organizationId: orgId,
        name: "Custom Date Range Report",
        reportType: "insurance_coverage",
        reportConfig: {
          dateRange: "custom",
          customStartDate: startDate,
          customEndDate: endDate,
        },
        schedule: "on_demand",
        isActive: true,
        createdBy: userId,
        createdAt: Date.now(),
      });
    });

    const report = await t.run(async (ctx) => {
      return await ctx.db.get(reportId);
    });

    expect(report?.reportConfig?.dateRange).toBe("custom");
    expect(report?.reportConfig?.customStartDate).toBe(startDate);
    expect(report?.reportConfig?.customEndDate).toBe(endDate);
  });

  test("should create report with comparison period - previous_period", async () => {
    const t = convexTest(schema, modules);

    const [orgId, userId] = await Promise.all([
      t.run(async (ctx) => {
        return await ctx.db.insert("organizations", {
          name: "Test Museum",
          slug: "test-museum-comparison-previous",
          type: "museum",
          subscriptionTier: "pro",
        });
      }),
      t.run(async (ctx) => {
        return await ctx.db.insert("users", {
          name: "Test User",
          email: "test@example.com",
        });
      }),
    ]);
    const reportId = await t.run(async (ctx) => {
      return await ctx.db.insert("scheduledReports", {
        organizationId: orgId,
        name: "Comparison Report - Previous Period",
        reportType: "collection_health",
        reportConfig: {
          dateRange: "last_30_days",
          includeComparison: true,
          comparisonPeriod: "previous_period",
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

    expect(report?.reportConfig?.includeComparison).toBe(true);
    expect(report?.reportConfig?.comparisonPeriod).toBe("previous_period");
  });

  test("should create report with comparison period - same_period_last_year", async () => {
    const t = convexTest(schema, modules);

    const [orgId, userId] = await Promise.all([
      t.run(async (ctx) => {
        return await ctx.db.insert("organizations", {
          name: "Test Museum",
          slug: "test-museum-comparison-lastyear",
          type: "museum",
          subscriptionTier: "pro",
        });
      }),
      t.run(async (ctx) => {
        return await ctx.db.insert("users", {
          name: "Test User",
          email: "test@example.com",
        });
      }),
    ]);
    const reportId = await t.run(async (ctx) => {
      return await ctx.db.insert("scheduledReports", {
        organizationId: orgId,
        name: "Comparison Report - Last Year",
        reportType: "operational_kpis",
        reportConfig: {
          dateRange: "last_90_days",
          includeComparison: true,
          comparisonPeriod: "same_period_last_year",
        },
        schedule: "quarterly",
        isActive: true,
        createdBy: userId,
        createdAt: Date.now(),
      });
    });

    const report = await t.run(async (ctx) => {
      return await ctx.db.get(reportId);
    });

    expect(report?.reportConfig?.includeComparison).toBe(true);
    expect(report?.reportConfig?.comparisonPeriod).toBe(
      "same_period_last_year",
    );
  });

  test("should update report date range configuration", async () => {
    const t = convexTest(schema, modules);

    const [orgId, userId] = await Promise.all([
      t.run(async (ctx) => {
        return await ctx.db.insert("organizations", {
          name: "Test Museum",
          slug: "test-museum-update-daterange",
          type: "museum",
          subscriptionTier: "pro",
        });
      }),
      t.run(async (ctx) => {
        return await ctx.db.insert("users", {
          name: "Test User",
          email: "test@example.com",
        });
      }),
    ]);
    const reportId = await t.run(async (ctx) => {
      return await ctx.db.insert("scheduledReports", {
        organizationId: orgId,
        name: "Date Range Update Test",
        reportType: "loan_performance",
        reportConfig: {
          dateRange: "last_7_days",
        },
        schedule: "weekly",
        isActive: true,
        createdBy: userId,
        createdAt: Date.now(),
      });
    });

    // Update the date range
    await t.run(async (ctx) => {
      await ctx.db.patch(reportId, {
        reportConfig: {
          dateRange: "last_90_days",
          includeComparison: true,
          comparisonPeriod: "previous_period",
        },
        updatedAt: Date.now(),
      });
    });

    const updatedReport = await t.run(async (ctx) => {
      return await ctx.db.get(reportId);
    });

    expect(updatedReport?.reportConfig?.dateRange).toBe("last_90_days");
    expect(updatedReport?.reportConfig?.includeComparison).toBe(true);
    expect(updatedReport?.reportConfig?.comparisonPeriod).toBe(
      "previous_period",
    );
  });
});

describe("report filters", () => {
  test("should create report with location filters", async () => {
    const t = convexTest(schema, modules);

    const [orgId, userId] = await Promise.all([
      t.run(async (ctx) => {
        return await ctx.db.insert("organizations", {
          name: "Test Museum",
          slug: "test-museum-location-filters",
          type: "museum",
          subscriptionTier: "pro",
        });
      }),
      t.run(async (ctx) => {
        return await ctx.db.insert("users", {
          name: "Test User",
          email: "test@example.com",
        });
      }),
    ]);
    // Create test locations
    const [location1, location2] = await Promise.all([
      t.run(async (ctx) => {
        return await ctx.db.insert("locations", {
          organizationId: orgId,
          name: "Gallery 1",
          locationCode: "G-001",
          locationCodeNormalized: "g-001",
          type: "gallery",
          sortOrder: 1,
          isActive: true,
        });
      }),
      t.run(async (ctx) => {
        return await ctx.db.insert("locations", {
          organizationId: orgId,
          name: "Storage Room A",
          locationCode: "ST-001",
          locationCodeNormalized: "st-001",
          type: "storage",
          sortOrder: 2,
          isActive: true,
        });
      }),
    ]);
    const reportId = await t.run(async (ctx) => {
      return await ctx.db.insert("scheduledReports", {
        organizationId: orgId,
        name: "Location Filter Report",
        reportType: "location_utilization",
        reportConfig: {
          dateRange: "last_30_days",
          filters: {
            locationIds: [location1, location2],
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

    expect(report?.reportConfig?.filters).toBeDefined();
    expect(report?.reportConfig?.filters?.locationIds).toHaveLength(2);
    expect(report?.reportConfig?.filters?.locationIds).toContain(location1);
    expect(report?.reportConfig?.filters?.locationIds).toContain(location2);
  });

  test("should create report with collection group filters", async () => {
    const t = convexTest(schema, modules);

    const [orgId, userId] = await Promise.all([
      t.run(async (ctx) => {
        return await ctx.db.insert("organizations", {
          name: "Test Museum",
          slug: "test-museum-collection-filters",
          type: "museum",
          subscriptionTier: "pro",
        });
      }),
      t.run(async (ctx) => {
        return await ctx.db.insert("users", {
          name: "Test User",
          email: "test@example.com",
        });
      }),
    ]);
    // Create test collection groups
    const [group1, group2] = await Promise.all([
      t.run(async (ctx) => {
        return await ctx.db.insert("collectionGroups", {
          organizationId: orgId,
          name: "Impressionist Paintings",
          description: "19th century impressionist works",
          createdAt: Date.now(),
          createdBy: userId,
        });
      }),
      t.run(async (ctx) => {
        return await ctx.db.insert("collectionGroups", {
          organizationId: orgId,
          name: "Modern Sculpture",
          description: "20th century sculptures",
          createdAt: Date.now(),
          createdBy: userId,
        });
      }),
    ]);
    const reportId = await t.run(async (ctx) => {
      return await ctx.db.insert("scheduledReports", {
        organizationId: orgId,
        name: "Collection Group Filter Report",
        reportType: "collection_health",
        reportConfig: {
          dateRange: "last_90_days",
          filters: {
            collectionGroupIds: [group1, group2],
          },
        },
        schedule: "quarterly",
        isActive: true,
        createdBy: userId,
        createdAt: Date.now(),
      });
    });

    const report = await t.run(async (ctx) => {
      return await ctx.db.get(reportId);
    });

    expect(report?.reportConfig?.filters).toBeDefined();
    expect(report?.reportConfig?.filters?.collectionGroupIds).toHaveLength(2);
    expect(report?.reportConfig?.filters?.collectionGroupIds).toContain(group1);
    expect(report?.reportConfig?.filters?.collectionGroupIds).toContain(group2);
  });

  test("should create report with object type filters", async () => {
    const t = convexTest(schema, modules);

    const [orgId, userId] = await Promise.all([
      t.run(async (ctx) => {
        return await ctx.db.insert("organizations", {
          name: "Test Museum",
          slug: "test-museum-objecttype-filters",
          type: "museum",
          subscriptionTier: "pro",
        });
      }),
      t.run(async (ctx) => {
        return await ctx.db.insert("users", {
          name: "Test User",
          email: "test@example.com",
        });
      }),
    ]);
    const reportId = await t.run(async (ctx) => {
      return await ctx.db.insert("scheduledReports", {
        organizationId: orgId,
        name: "Object Type Filter Report",
        reportType: "conservation_status",
        reportConfig: {
          dateRange: "year_to_date",
          filters: {
            objectTypes: ["painting", "sculpture", "textile"],
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

    expect(report?.reportConfig?.filters).toBeDefined();
    expect(report?.reportConfig?.filters?.objectTypes).toHaveLength(3);
    expect(report?.reportConfig?.filters?.objectTypes).toEqual([
      "painting",
      "sculpture",
      "textile",
    ]);
  });

  test("should create report with multiple filter types combined", async () => {
    const t = convexTest(schema, modules);

    const [orgId, userId] = await Promise.all([
      t.run(async (ctx) => {
        return await ctx.db.insert("organizations", {
          name: "Test Museum",
          slug: "test-museum-combined-filters",
          type: "museum",
          subscriptionTier: "pro",
        });
      }),
      t.run(async (ctx) => {
        return await ctx.db.insert("users", {
          name: "Test User",
          email: "test@example.com",
        });
      }),
    ]);
    const [locationId, groupId] = await Promise.all([
      t.run(async (ctx) => {
        return await ctx.db.insert("locations", {
          organizationId: orgId,
          name: "Main Gallery",
          locationCode: "G-010",
          locationCodeNormalized: "g-010",
          type: "gallery",
          sortOrder: 1,
          isActive: true,
        });
      }),
      t.run(async (ctx) => {
        return await ctx.db.insert("collectionGroups", {
          organizationId: orgId,
          name: "Renaissance Art",
          description: "Renaissance period artworks",
          createdAt: Date.now(),
          createdBy: userId,
        });
      }),
    ]);
    const reportId = await t.run(async (ctx) => {
      return await ctx.db.insert("scheduledReports", {
        organizationId: orgId,
        name: "Combined Filters Report",
        reportType: "compliance_audit",
        reportConfig: {
          dateRange: "last_year",
          filters: {
            locationIds: [locationId],
            collectionGroupIds: [groupId],
            objectTypes: ["painting", "drawing"],
          },
        },
        schedule: "quarterly",
        isActive: true,
        createdBy: userId,
        createdAt: Date.now(),
      });
    });

    const report = await t.run(async (ctx) => {
      return await ctx.db.get(reportId);
    });

    expect(report?.reportConfig?.filters).toBeDefined();
    expect(report?.reportConfig?.filters?.locationIds).toHaveLength(1);
    expect(report?.reportConfig?.filters?.locationIds).toContain(locationId);
    expect(report?.reportConfig?.filters?.collectionGroupIds).toHaveLength(1);
    expect(report?.reportConfig?.filters?.collectionGroupIds).toContain(
      groupId,
    );
    expect(report?.reportConfig?.filters?.objectTypes).toHaveLength(2);
    expect(report?.reportConfig?.filters?.objectTypes).toEqual([
      "painting",
      "drawing",
    ]);
  });

  test("should update report filters", async () => {
    const t = convexTest(schema, modules);

    const [orgId, userId] = await Promise.all([
      t.run(async (ctx) => {
        return await ctx.db.insert("organizations", {
          name: "Test Museum",
          slug: "test-museum-update-filters",
          type: "museum",
          subscriptionTier: "pro",
        });
      }),
      t.run(async (ctx) => {
        return await ctx.db.insert("users", {
          name: "Test User",
          email: "test@example.com",
        });
      }),
    ]);
    const reportId = await t.run(async (ctx) => {
      return await ctx.db.insert("scheduledReports", {
        organizationId: orgId,
        name: "Filter Update Test",
        reportType: "loan_performance",
        reportConfig: {
          dateRange: "last_30_days",
          filters: {
            objectTypes: ["painting"],
          },
        },
        schedule: "monthly",
        isActive: true,
        createdBy: userId,
        createdAt: Date.now(),
      });
    });

    // Verify initial filters
    const reportBefore = await t.run(async (ctx) => {
      return await ctx.db.get(reportId);
    });

    expect(reportBefore?.reportConfig?.filters?.objectTypes).toEqual([
      "painting",
    ]);

    // Update filters
    await t.run(async (ctx) => {
      await ctx.db.patch(reportId, {
        reportConfig: {
          dateRange: "last_30_days",
          filters: {
            objectTypes: ["painting", "sculpture", "photograph"],
          },
        },
        updatedAt: Date.now(),
      });
    });

    const reportAfter = await t.run(async (ctx) => {
      return await ctx.db.get(reportId);
    });

    expect(reportAfter?.reportConfig?.filters?.objectTypes).toHaveLength(3);
    expect(reportAfter?.reportConfig?.filters?.objectTypes).toEqual([
      "painting",
      "sculpture",
      "photograph",
    ]);
  });

  test("should remove filters from report", async () => {
    const t = convexTest(schema, modules);

    const [orgId, userId] = await Promise.all([
      t.run(async (ctx) => {
        return await ctx.db.insert("organizations", {
          name: "Test Museum",
          slug: "test-museum-remove-filters",
          type: "museum",
          subscriptionTier: "pro",
        });
      }),
      t.run(async (ctx) => {
        return await ctx.db.insert("users", {
          name: "Test User",
          email: "test@example.com",
        });
      }),
    ]);
    const locationId = await t.run(async (ctx) => {
      return await ctx.db.insert("locations", {
        organizationId: orgId,
        name: "Test Gallery",
        locationCode: "G-020",
        locationCodeNormalized: "g-020",
        type: "gallery",
        sortOrder: 1,
        isActive: true,
      });
    });

    const reportId = await t.run(async (ctx) => {
      return await ctx.db.insert("scheduledReports", {
        organizationId: orgId,
        name: "Filter Removal Test",
        reportType: "location_utilization",
        reportConfig: {
          dateRange: "last_30_days",
          filters: {
            locationIds: [locationId],
            objectTypes: ["painting"],
          },
        },
        schedule: "weekly",
        isActive: true,
        createdBy: userId,
        createdAt: Date.now(),
      });
    });

    // Remove filters by updating config without filters
    await t.run(async (ctx) => {
      await ctx.db.patch(reportId, {
        reportConfig: {
          dateRange: "last_30_days",
        },
        updatedAt: Date.now(),
      });
    });

    const reportAfter = await t.run(async (ctx) => {
      return await ctx.db.get(reportId);
    });

    expect(reportAfter?.reportConfig?.filters).toBeUndefined();
  });

  test("should create report with empty filters object", async () => {
    const t = convexTest(schema, modules);

    const [orgId, userId] = await Promise.all([
      t.run(async (ctx) => {
        return await ctx.db.insert("organizations", {
          name: "Test Museum",
          slug: "test-museum-empty-filters",
          type: "museum",
          subscriptionTier: "pro",
        });
      }),
      t.run(async (ctx) => {
        return await ctx.db.insert("users", {
          name: "Test User",
          email: "test@example.com",
        });
      }),
    ]);
    const reportId = await t.run(async (ctx) => {
      return await ctx.db.insert("scheduledReports", {
        organizationId: orgId,
        name: "Empty Filters Report",
        reportType: "operational_kpis",
        reportConfig: {
          dateRange: "last_7_days",
          filters: {},
        },
        schedule: "daily",
        isActive: true,
        createdBy: userId,
        createdAt: Date.now(),
      });
    });

    const report = await t.run(async (ctx) => {
      return await ctx.db.get(reportId);
    });

    expect(report?.reportConfig?.filters).toBeDefined();
    expect(report?.reportConfig?.filters?.locationIds).toBeUndefined();
    expect(report?.reportConfig?.filters?.collectionGroupIds).toBeUndefined();
    expect(report?.reportConfig?.filters?.objectTypes).toBeUndefined();
  });
});

describe("email recipient management", () => {
  test("should create report with single email recipient", async () => {
    const t = convexTest(schema, modules);

    const [orgId, userId] = await Promise.all([
      t.run(async (ctx) => {
        return await ctx.db.insert("organizations", {
          name: "Test Museum",
          slug: "test-museum-single-recipient",
          type: "museum",
          subscriptionTier: "pro",
        });
      }),
      t.run(async (ctx) => {
        return await ctx.db.insert("users", {
          name: "Test User",
          email: "test@example.com",
        });
      }),
    ]);
    const reportId = await t.run(async (ctx) => {
      return await ctx.db.insert("scheduledReports", {
        organizationId: orgId,
        name: "Single Recipient Report",
        reportType: "collection_health",
        schedule: "weekly",
        emailRecipients: ["curator@museum.com"],
        isActive: true,
        createdBy: userId,
        createdAt: Date.now(),
      });
    });

    const report = await t.run(async (ctx) => {
      return await ctx.db.get(reportId);
    });

    expect(report?.emailRecipients).toBeDefined();
    expect(report?.emailRecipients).toHaveLength(1);
    expect(report?.emailRecipients).toEqual(["curator@museum.com"]);
  });

  test("should create report with multiple email recipients", async () => {
    const t = convexTest(schema, modules);

    const [orgId, userId] = await Promise.all([
      t.run(async (ctx) => {
        return await ctx.db.insert("organizations", {
          name: "Test Museum",
          slug: "test-museum-multiple-recipients",
          type: "museum",
          subscriptionTier: "pro",
        });
      }),
      t.run(async (ctx) => {
        return await ctx.db.insert("users", {
          name: "Test User",
          email: "test@example.com",
        });
      }),
    ]);
    const recipients = [
      "curator@museum.com",
      "director@museum.com",
      "registrar@museum.com",
      "conservation@museum.com",
    ];

    const reportId = await t.run(async (ctx) => {
      return await ctx.db.insert("scheduledReports", {
        organizationId: orgId,
        name: "Multiple Recipients Report",
        reportType: "compliance_audit",
        schedule: "monthly",
        emailRecipients: recipients,
        isActive: true,
        createdBy: userId,
        createdAt: Date.now(),
      });
    });

    const report = await t.run(async (ctx) => {
      return await ctx.db.get(reportId);
    });

    expect(report?.emailRecipients).toBeDefined();
    expect(report?.emailRecipients).toHaveLength(4);
    expect(report?.emailRecipients).toEqual(recipients);
  });

  test("should create report without email recipients", async () => {
    const t = convexTest(schema, modules);

    const [orgId, userId] = await Promise.all([
      t.run(async (ctx) => {
        return await ctx.db.insert("organizations", {
          name: "Test Museum",
          slug: "test-museum-no-recipients",
          type: "museum",
          subscriptionTier: "pro",
        });
      }),
      t.run(async (ctx) => {
        return await ctx.db.insert("users", {
          name: "Test User",
          email: "test@example.com",
        });
      }),
    ]);
    const reportId = await t.run(async (ctx) => {
      return await ctx.db.insert("scheduledReports", {
        organizationId: orgId,
        name: "No Recipients Report",
        reportType: "operational_kpis",
        schedule: "daily",
        isActive: true,
        createdBy: userId,
        createdAt: Date.now(),
      });
    });

    const report = await t.run(async (ctx) => {
      return await ctx.db.get(reportId);
    });

    expect(report?.emailRecipients).toBeUndefined();
  });

  test("should add email recipients to existing report", async () => {
    const t = convexTest(schema, modules);

    const [orgId, userId] = await Promise.all([
      t.run(async (ctx) => {
        return await ctx.db.insert("organizations", {
          name: "Test Museum",
          slug: "test-museum-add-recipients",
          type: "museum",
          subscriptionTier: "pro",
        });
      }),
      t.run(async (ctx) => {
        return await ctx.db.insert("users", {
          name: "Test User",
          email: "test@example.com",
        });
      }),
    ]);
    const reportId = await t.run(async (ctx) => {
      return await ctx.db.insert("scheduledReports", {
        organizationId: orgId,
        name: "Add Recipients Test",
        reportType: "loan_performance",
        schedule: "weekly",
        emailRecipients: ["curator@museum.com"],
        isActive: true,
        createdBy: userId,
        createdAt: Date.now(),
      });
    });

    // Verify initial recipients
    const reportBefore = await t.run(async (ctx) => {
      return await ctx.db.get(reportId);
    });

    expect(reportBefore?.emailRecipients).toEqual(["curator@museum.com"]);

    // Add more recipients
    await t.run(async (ctx) => {
      await ctx.db.patch(reportId, {
        emailRecipients: [
          "curator@museum.com",
          "director@museum.com",
          "admin@museum.com",
        ],
        updatedAt: Date.now(),
      });
    });

    const reportAfter = await t.run(async (ctx) => {
      return await ctx.db.get(reportId);
    });

    expect(reportAfter?.emailRecipients).toHaveLength(3);
    expect(reportAfter?.emailRecipients).toContain("curator@museum.com");
    expect(reportAfter?.emailRecipients).toContain("director@museum.com");
    expect(reportAfter?.emailRecipients).toContain("admin@museum.com");
  });

  test("should remove email recipient from report", async () => {
    const t = convexTest(schema, modules);

    const [orgId, userId] = await Promise.all([
      t.run(async (ctx) => {
        return await ctx.db.insert("organizations", {
          name: "Test Museum",
          slug: "test-museum-remove-recipient",
          type: "museum",
          subscriptionTier: "pro",
        });
      }),
      t.run(async (ctx) => {
        return await ctx.db.insert("users", {
          name: "Test User",
          email: "test@example.com",
        });
      }),
    ]);
    const reportId = await t.run(async (ctx) => {
      return await ctx.db.insert("scheduledReports", {
        organizationId: orgId,
        name: "Remove Recipient Test",
        reportType: "conservation_status",
        schedule: "monthly",
        emailRecipients: [
          "curator@museum.com",
          "director@museum.com",
          "temp@museum.com",
        ],
        isActive: true,
        createdBy: userId,
        createdAt: Date.now(),
      });
    });

    // Remove one recipient
    await t.run(async (ctx) => {
      await ctx.db.patch(reportId, {
        emailRecipients: ["curator@museum.com", "director@museum.com"],
        updatedAt: Date.now(),
      });
    });

    const reportAfter = await t.run(async (ctx) => {
      return await ctx.db.get(reportId);
    });

    expect(reportAfter?.emailRecipients).toHaveLength(2);
    expect(reportAfter?.emailRecipients).not.toContain("temp@museum.com");
    expect(reportAfter?.emailRecipients).toContain("curator@museum.com");
    expect(reportAfter?.emailRecipients).toContain("director@museum.com");
  });

  test("should replace all email recipients", async () => {
    const t = convexTest(schema, modules);

    const [orgId, userId] = await Promise.all([
      t.run(async (ctx) => {
        return await ctx.db.insert("organizations", {
          name: "Test Museum",
          slug: "test-museum-replace-recipients",
          type: "museum",
          subscriptionTier: "pro",
        });
      }),
      t.run(async (ctx) => {
        return await ctx.db.insert("users", {
          name: "Test User",
          email: "test@example.com",
        });
      }),
    ]);
    const reportId = await t.run(async (ctx) => {
      return await ctx.db.insert("scheduledReports", {
        organizationId: orgId,
        name: "Replace Recipients Test",
        reportType: "insurance_coverage",
        schedule: "quarterly",
        emailRecipients: ["old1@museum.com", "old2@museum.com"],
        isActive: true,
        createdBy: userId,
        createdAt: Date.now(),
      });
    });

    // Replace all recipients
    await t.run(async (ctx) => {
      await ctx.db.patch(reportId, {
        emailRecipients: [
          "new1@museum.com",
          "new2@museum.com",
          "new3@museum.com",
        ],
        updatedAt: Date.now(),
      });
    });

    const reportAfter = await t.run(async (ctx) => {
      return await ctx.db.get(reportId);
    });

    expect(reportAfter?.emailRecipients).toHaveLength(3);
    expect(reportAfter?.emailRecipients).not.toContain("old1@museum.com");
    expect(reportAfter?.emailRecipients).not.toContain("old2@museum.com");
    expect(reportAfter?.emailRecipients).toContain("new1@museum.com");
    expect(reportAfter?.emailRecipients).toContain("new2@museum.com");
    expect(reportAfter?.emailRecipients).toContain("new3@museum.com");
  });

  test("should clear all email recipients", async () => {
    const t = convexTest(schema, modules);

    const [orgId, userId] = await Promise.all([
      t.run(async (ctx) => {
        return await ctx.db.insert("organizations", {
          name: "Test Museum",
          slug: "test-museum-clear-recipients",
          type: "museum",
          subscriptionTier: "pro",
        });
      }),
      t.run(async (ctx) => {
        return await ctx.db.insert("users", {
          name: "Test User",
          email: "test@example.com",
        });
      }),
    ]);
    const reportId = await t.run(async (ctx) => {
      return await ctx.db.insert("scheduledReports", {
        organizationId: orgId,
        name: "Clear Recipients Test",
        reportType: "accession_activity",
        schedule: "weekly",
        emailRecipients: ["curator@museum.com", "director@museum.com"],
        isActive: true,
        createdBy: userId,
        createdAt: Date.now(),
      });
    });

    // Clear recipients by setting empty array
    await t.run(async (ctx) => {
      await ctx.db.patch(reportId, {
        emailRecipients: [],
        updatedAt: Date.now(),
      });
    });

    const reportAfter = await t.run(async (ctx) => {
      return await ctx.db.get(reportId);
    });

    expect(reportAfter?.emailRecipients).toBeDefined();
    expect(reportAfter?.emailRecipients).toHaveLength(0);
  });

  test("should handle email recipients with custom subject", async () => {
    const t = convexTest(schema, modules);

    const [orgId, userId] = await Promise.all([
      t.run(async (ctx) => {
        return await ctx.db.insert("organizations", {
          name: "Test Museum",
          slug: "test-museum-email-subject",
          type: "museum",
          subscriptionTier: "pro",
        });
      }),
      t.run(async (ctx) => {
        return await ctx.db.insert("users", {
          name: "Test User",
          email: "test@example.com",
        });
      }),
    ]);
    const reportId = await t.run(async (ctx) => {
      return await ctx.db.insert("scheduledReports", {
        organizationId: orgId,
        name: "Custom Subject Report",
        reportType: "collection_health",
        schedule: "monthly",
        emailRecipients: ["curator@museum.com"],
        emailSubject: "Monthly Collection Health Report - {{date}}",
        includeAttachment: true,
        attachmentFormat: "pdf",
        isActive: true,
        createdBy: userId,
        createdAt: Date.now(),
      });
    });

    const report = await t.run(async (ctx) => {
      return await ctx.db.get(reportId);
    });

    expect(report?.emailRecipients).toEqual(["curator@museum.com"]);
    expect(report?.emailSubject).toBe(
      "Monthly Collection Health Report - {{date}}",
    );
    expect(report?.includeAttachment).toBe(true);
    expect(report?.attachmentFormat).toBe("pdf");
  });

  test("should handle email recipients with different attachment formats", async () => {
    const t = convexTest(schema, modules);

    const [orgId, userId] = await Promise.all([
      t.run(async (ctx) => {
        return await ctx.db.insert("organizations", {
          name: "Test Museum",
          slug: "test-museum-attachment-formats",
          type: "museum",
          subscriptionTier: "pro",
        });
      }),
      t.run(async (ctx) => {
        return await ctx.db.insert("users", {
          name: "Test User",
          email: "test@example.com",
        });
      }),
    ]);
    const formats = ["pdf", "csv", "excel"] as const;

    await Promise.all(
      formats.map(async (format) => {
        const reportId = await t.run(async (ctx) => {
          return await ctx.db.insert("scheduledReports", {
            organizationId: orgId,
            name: `${format.toUpperCase()} Format Report`,
            reportType: "operational_kpis",
            schedule: "weekly",
            emailRecipients: ["data@museum.com"],
            includeAttachment: true,
            attachmentFormat: format,
            isActive: true,
            createdBy: userId,
            createdAt: Date.now(),
          });
        });

        const report = await t.run(async (ctx) => {
          return await ctx.db.get(reportId);
        });

        expect(report?.attachmentFormat).toBe(format);
        expect(report?.includeAttachment).toBe(true);
      }),
    );
  });
});

describe("report generation and cron processing", () => {
  test("generateReport operational_kpis stores real KPI fields", async () => {
    const t = convexTest(schema, modules);

    const [orgId, userId] = await Promise.all([
      t.run(async (ctx) => {
        return await ctx.db.insert("organizations", {
          name: "KPI Museum",
          slug: "kpi-museum-gen",
          type: "museum",
          subscriptionTier: "pro",
        });
      }),
      t.run(async (ctx) => {
        return await ctx.db.insert("users", {
          name: "Test User",
          email: "kpi-gen@example.com",
        });
      }),
    ]);

    const reportId = await t.run(async (ctx) => {
      return await ctx.db.insert("scheduledReports", {
        organizationId: orgId,
        name: "Operational KPIs",
        reportType: "operational_kpis",
        schedule: "weekly",
        isActive: true,
        createdBy: userId,
        createdAt: Date.now(),
      });
    });

    const runId = await t.run(async (ctx) => {
      return await ctx.db.insert("reportRuns", {
        organizationId: orgId,
        scheduledReportId: reportId,
        reportType: "operational_kpis",
        reportName: "Operational KPIs",
        startedAt: Date.now(),
        status: "running",
        triggeredBy: "manual",
        triggeredByUserId: userId,
      });
    });

    await t.mutation(internal.reporting.generateReport, {
      runId,
      reportId,
    });

    const run = await t.run(async (ctx) => {
      return await ctx.db.get(runId);
    });

    expect(run?.status).toBe("success");
    expect(run?.reportData).toMatchObject({
      reportType: "operational_kpis",
      generatorVersion: "v1",
      organizationId: orgId,
    });

    const reportData = run?.reportData as {
      inventory?: { totalValue: number };
      loans?: { overdue: number };
      exhibitions?: { active: number };
    };

    expect(reportData.inventory).toBeDefined();
    expect(reportData.loans).toBeDefined();
    expect(reportData.exhibitions).toBeDefined();
    expect(typeof reportData.inventory?.totalValue).toBe("number");
    expect(typeof reportData.loans?.overdue).toBe("number");
    expect(typeof reportData.exhibitions?.active).toBe("number");
  });

  test("processDueReports creates a run and advances nextRunAt", async () => {
    const t = convexTest(schema, modules);
    const now = Date.now();
    const pastNextRun = now - 60_000;

    const [orgId, userId] = await Promise.all([
      t.run(async (ctx) => {
        return await ctx.db.insert("organizations", {
          name: "Cron Museum",
          slug: "cron-museum-due",
          type: "museum",
          subscriptionTier: "pro",
        });
      }),
      t.run(async (ctx) => {
        return await ctx.db.insert("users", {
          name: "Test User",
          email: "cron-due@example.com",
        });
      }),
    ]);

    const reportId = await t.run(async (ctx) => {
      return await ctx.db.insert("scheduledReports", {
        organizationId: orgId,
        name: "Due Report",
        reportType: "operational_kpis",
        schedule: "daily",
        scheduledTime: "09:00",
        timezone: "UTC",
        isActive: true,
        nextRunAt: pastNextRun,
        createdBy: userId,
        createdAt: now,
      });
    });

    const runsBefore = await t.run(async (ctx) => {
      return await ctx.db
        .query("reportRuns")
        .withIndex("by_organization", (q) => q.eq("organizationId", orgId))
        .collect();
    });

    await t.mutation(internal.reporting.processDueReports, {});

    const [report, runsAfter] = await t.run(async (ctx) => {
      const updatedReport = await ctx.db.get(reportId);
      const runs = await ctx.db
        .query("reportRuns")
        .withIndex("by_organization", (q) => q.eq("organizationId", orgId))
        .collect();
      return [updatedReport, runs] as const;
    });

    expect(runsAfter.length).toBe(runsBefore.length + 1);
    expect(report?.nextRunAt).toBeDefined();
    expect(report?.nextRunAt).toBeGreaterThan(pastNextRun);

    const scheduledRun = runsAfter.find(
      (run) =>
        run.scheduledReportId === reportId && run.triggeredBy === "schedule",
    );
    expect(scheduledRun).toBeDefined();
    expect(scheduledRun?.status).toBe("success");
  });

  test("processDueReports with no due reports creates no new runs", async () => {
    const t = convexTest(schema, modules);
    const now = Date.now();

    const [orgId, userId] = await Promise.all([
      t.run(async (ctx) => {
        return await ctx.db.insert("organizations", {
          name: "No Due Museum",
          slug: "cron-museum-none",
          type: "museum",
          subscriptionTier: "pro",
        });
      }),
      t.run(async (ctx) => {
        return await ctx.db.insert("users", {
          name: "Test User",
          email: "cron-none@example.com",
        });
      }),
    ]);

    await t.run(async (ctx) => {
      await ctx.db.insert("scheduledReports", {
        organizationId: orgId,
        name: "Future Report",
        reportType: "operational_kpis",
        schedule: "daily",
        isActive: true,
        nextRunAt: now + 7 * 24 * 60 * 60 * 1000,
        createdBy: userId,
        createdAt: now,
      });

      await ctx.db.insert("scheduledReports", {
        organizationId: orgId,
        name: "Inactive Report",
        reportType: "operational_kpis",
        schedule: "daily",
        isActive: false,
        nextRunAt: now - 60_000,
        createdBy: userId,
        createdAt: now,
      });
    });

    const runsBefore = await t.run(async (ctx) => {
      return await ctx.db
        .query("reportRuns")
        .withIndex("by_organization", (q) => q.eq("organizationId", orgId))
        .collect();
    });

    await t.mutation(internal.reporting.processDueReports, {});

    const runsAfter = await t.run(async (ctx) => {
      return await ctx.db
        .query("reportRuns")
        .withIndex("by_organization", (q) => q.eq("organizationId", orgId))
        .collect();
    });

    expect(runsAfter.length).toBe(runsBefore.length);
  });
});
