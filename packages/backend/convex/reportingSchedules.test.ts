/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, expect, test, vi } from "vitest";
import { rebuildProjection } from "../tests/testHarness";
import { modules } from "../tests/testSetup";
import { api, internal } from "./_generated/api";
import schema from "./schema";

async function setup(
  permissions = ["organization.manage_settings", "organization.view_analytics"],
) {
  const t = convexTest(schema, modules);
  const fixture = await t.run(async (ctx) => {
    const organizationId = await ctx.db.insert("organizations", {
      name: "KPI Museum",
      slug: "kpi",
      type: "museum",
      subscriptionTier: "pro",
    });
    const userId = await ctx.db.insert("users", { name: "Curator" });
    const roleId = await ctx.db.insert("roles", {
      organizationId,
      name: "Curator",
      isSystemRole: false,
    });
    await ctx.db.insert("userOrganizations", {
      organizationId,
      userId,
      roleId,
      joinedAt: Date.now(),
    });
    for (const name of permissions) {
      const permissionId = await ctx.db.insert("permissions", {
        name,
        category: "organization",
      });
      await ctx.db.insert("rolePermissions", { roleId, permissionId });
    }
    return { organizationId, userId, roleId };
  });
  await rebuildProjection(t, fixture.organizationId);
  return { t, ...fixture, staff: t.withIdentity({ subject: fixture.userId }) };
}
afterEach(() => vi.useRealTimers());

test("staff cannot create a report whose generator is unavailable", async () => {
  const { staff, organizationId } = await setup();
  await expect(
    staff.mutation(api.reporting.createScheduledReport, {
      organizationId,
      name: "Unsupported",
      reportType: "collection_health",
      schedule: "daily",
    }),
  ).rejects.toThrow("unavailable");
  expect(
    await staff.query(api.reporting.listScheduledReports, { organizationId }),
  ).toEqual([]);
});

test("staff can retrieve a generated and stored KPI snapshot without a delivery claim", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-01-15T12:00:00Z"));
  const { staff, t, organizationId } = await setup();
  const reportId = await staff.mutation(api.reporting.createScheduledReport, {
    organizationId,
    name: "KPI",
    reportType: "operational_kpis",
    schedule: "on_demand",
  });
  const runId = await staff.mutation(api.reporting.runReportManually, {
    reportId,
  });
  await t.finishAllScheduledFunctions(() => vi.advanceTimersByTime(0));
  const run = await staff.query(api.reporting.getReportRun, { runId });
  expect(run).toMatchObject({
    status: "success",
    scheduledReportId: reportId,
    deliveryState: "unavailable",
    artifact: {
      schemaVersion: 1,
      format: "json",
      generatedAt: Date.parse("2026-01-15T12:00:00Z"),
      storedAt: Date.parse("2026-01-15T12:00:00Z"),
    },
  });
  expect(JSON.parse(run?.artifact?.content ?? "null")).toMatchObject({
    reportType: "operational_kpis",
    organizationId,
    generatorVersion: "v1",
    loans: { overdue: 0, dueToday: 0 },
    exhibitions: { active: 0 },
  });
});

test("weekly schedules use the selected local time across DST", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-03-07T15:00:00Z"));
  const { staff, organizationId } = await setup();
  const reportId = await staff.mutation(api.reporting.createScheduledReport, {
    organizationId,
    name: "Weekly",
    reportType: "operational_kpis",
    schedule: "weekly",
    scheduledDay: 0,
    scheduledTime: "09:00",
    timezone: "America/New_York",
  });
  expect(
    await staff.query(api.reporting.getScheduledReport, { reportId }),
  ).toMatchObject({
    nextRunAt: Date.parse("2026-03-08T13:00:00Z"),
    timezone: "America/New_York",
  });
});

test("DST gaps shift forward, folds run once, and month ends clamp without drift", async () => {
  vi.useFakeTimers();
  const { staff, organizationId } = await setup();
  const cases = [
    {
      now: "2026-03-08T05:00:00Z",
      schedule: "daily",
      time: "02:30",
      zone: "America/New_York",
      next: "2026-03-08T07:30:00Z",
    },
    {
      now: "2026-11-01T04:00:00Z",
      schedule: "daily",
      time: "01:30",
      zone: "America/New_York",
      next: "2026-11-01T05:30:00Z",
    },
    {
      now: "2026-11-01T05:45:00Z",
      schedule: "daily",
      time: "01:30",
      zone: "America/New_York",
      next: "2026-11-02T06:30:00Z",
    },
    {
      now: "2026-01-31T10:00:00Z",
      schedule: "monthly",
      day: 31,
      time: "09:00",
      zone: "UTC",
      next: "2026-02-28T09:00:00Z",
    },
    {
      now: "2026-02-28T10:00:00Z",
      schedule: "monthly",
      day: 31,
      time: "09:00",
      zone: "UTC",
      next: "2026-03-31T09:00:00Z",
    },
    {
      now: "2028-01-31T10:00:00Z",
      schedule: "monthly",
      day: 31,
      time: "09:00",
      zone: "UTC",
      next: "2028-02-29T09:00:00Z",
    },
    {
      now: "2026-12-31T23:00:00Z",
      schedule: "quarterly",
      day: 31,
      time: "09:00",
      zone: "Asia/Kathmandu",
      next: "2027-01-31T03:15:00Z",
    },
  ] as const;
  for (const item of cases) {
    vi.setSystemTime(new Date(item.now));
    const reportId = await staff.mutation(api.reporting.createScheduledReport, {
      organizationId,
      name: item.next,
      reportType: "operational_kpis",
      schedule: item.schedule,
      scheduledDay: "day" in item ? item.day : undefined,
      scheduledTime: item.time,
      timezone: item.zone,
    });
    expect(
      (await staff.query(api.reporting.getScheduledReport, { reportId }))
        ?.nextRunAt,
    ).toBe(Date.parse(item.next));
  }
});

test("invalid calendar inputs cannot create a schedule", async () => {
  const { staff, organizationId } = await setup();
  for (const invalid of [
    { timezone: "Mars/Olympus" },
    { scheduledTime: "25:60" },
    { scheduledDay: 7 },
    { scheduledDay: 1.5 },
    { name: "   " },
  ]) {
    await expect(
      staff.mutation(api.reporting.createScheduledReport, {
        organizationId,
        name: "KPI",
        reportType: "operational_kpis",
        schedule: "weekly",
        ...invalid,
      }),
    ).rejects.toThrow();
  }
  expect(
    await staff.query(api.reporting.listScheduledReports, { organizationId }),
  ).toEqual([]);
});

test("history is scoped by schedule identity even when names collide and organizations differ", async () => {
  vi.useFakeTimers();
  const { staff, t, organizationId } = await setup();
  const first = await staff.mutation(api.reporting.createScheduledReport, {
    organizationId,
    name: "Same",
    reportType: "operational_kpis",
    schedule: "on_demand",
  });
  const second = await staff.mutation(api.reporting.createScheduledReport, {
    organizationId,
    name: "Same",
    reportType: "operational_kpis",
    schedule: "on_demand",
  });
  const runId = await staff.mutation(api.reporting.runReportManually, {
    reportId: first,
  });
  await t.finishAllScheduledFunctions(() => vi.advanceTimersByTime(0));
  expect(
    await staff.query(api.reporting.listReportRuns, {
      organizationId,
      scheduledReportId: first,
    }),
  ).toMatchObject([{ _id: runId, scheduledReportId: first }]);
  expect(
    await staff.query(api.reporting.listReportRuns, {
      organizationId,
      scheduledReportId: second,
    }),
  ).toEqual([]);
  const otherUserId = await t.run((ctx) =>
    ctx.db.insert("users", { name: "Outsider" }),
  );
  // A user authorized in another organization must not use its ID to read our history.
  const outsider = t.withIdentity({ subject: otherUserId });
  await expect(
    outsider.query(api.reporting.listReportRuns, {
      organizationId,
      scheduledReportId: first,
    }),
  ).rejects.toThrow("Permission denied");
  const foreign = await t.run(async (ctx) => {
    const foreignOrg = await ctx.db.insert("organizations", {
      name: "Other",
      slug: "other",
      type: "museum",
      subscriptionTier: "pro",
    });
    return await ctx.db.insert("scheduledReports", {
      organizationId: foreignOrg,
      name: "Same",
      reportType: "operational_kpis",
      schedule: "on_demand",
      isActive: true,
      createdBy: otherUserId,
      createdAt: Date.now(),
    });
  });
  await expect(
    staff.query(api.reporting.listReportRuns, {
      organizationId,
      scheduledReportId: foreign,
    }),
  ).rejects.toThrow("Report not found");
});

test("editing Sunday zero, changing to on-demand, and reactivating recompute the calendar", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-01-05T12:00:00Z"));
  const { staff, organizationId } = await setup();
  const reportId = await staff.mutation(api.reporting.createScheduledReport, {
    organizationId,
    name: "KPI",
    reportType: "operational_kpis",
    schedule: "weekly",
    scheduledDay: 1,
  });
  await staff.mutation(api.reporting.updateScheduledReport, {
    reportId,
    scheduledDay: 0,
  });
  expect(
    (await staff.query(api.reporting.getScheduledReport, { reportId }))
      ?.nextRunAt,
  ).toBe(Date.parse("2026-01-11T09:00:00Z"));
  await staff.mutation(api.reporting.updateScheduledReport, {
    reportId,
    schedule: "on_demand",
  });
  expect(
    (await staff.query(api.reporting.getScheduledReport, { reportId }))
      ?.nextRunAt,
  ).toBeUndefined();
  await staff.mutation(api.reporting.updateScheduledReport, {
    reportId,
    schedule: "daily",
    isActive: false,
  });
  vi.setSystemTime(new Date("2026-02-01T12:00:00Z"));
  await staff.mutation(api.reporting.updateScheduledReport, {
    reportId,
    isActive: true,
  });
  expect(
    (await staff.query(api.reporting.getScheduledReport, { reportId }))
      ?.nextRunAt,
  ).toBe(Date.parse("2026-02-02T09:00:00Z"));
});

test("unsupported legacy generators fail visibly and their historical stubs are unavailable", async () => {
  vi.useFakeTimers();
  const { staff, t, organizationId, userId } = await setup();
  const { reportId, oldRunId } = await t.run(async (ctx) => {
    const reportId = await ctx.db.insert("scheduledReports", {
      organizationId,
      name: "Legacy",
      reportType: "collection_health",
      schedule: "daily",
      isActive: true,
      createdBy: userId,
      createdAt: Date.now(),
    });
    const oldRunId = await ctx.db.insert("reportRuns", {
      organizationId,
      scheduledReportId: reportId,
      reportType: "collection_health",
      reportName: "Legacy",
      startedAt: Date.now(),
      status: "success",
      triggeredBy: "schedule",
      reportData: { generatorVersion: "stub" },
    });
    return { reportId, oldRunId };
  });
  const runId = await staff.mutation(api.reporting.runReportManually, {
    reportId,
  });
  await t.finishAllScheduledFunctions(() => vi.advanceTimersByTime(0));
  expect(
    await staff.query(api.reporting.getReportRun, { runId }),
  ).toMatchObject({
    status: "failed",
    errorMessage: "Report generator unavailable",
    outputState: "unavailable",
  });
  expect(
    await staff.query(api.reporting.getReportRun, { runId: oldRunId }),
  ).toMatchObject({ outputState: "unavailable", deliveryState: "unavailable" });
  expect(
    await staff.query(api.reporting.listScheduledReports, { organizationId }),
  ).toMatchObject([{ _id: reportId, generatorAvailable: false }]);
  await staff.mutation(api.reporting.updateScheduledReport, {
    reportId,
    isActive: false,
  });
  await expect(
    staff.mutation(api.reporting.updateScheduledReport, {
      reportId,
      isActive: true,
    }),
  ).rejects.toThrow("unavailable");
});

test("scheduled runs retain occurrence identity, survive repeated ticks, and manual runs do not move the calendar", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-01T04:00:00Z"));
  const { staff, t, organizationId } = await setup();
  const reportId = await staff.mutation(api.reporting.createScheduledReport, {
    organizationId,
    name: "Fold",
    reportType: "operational_kpis",
    schedule: "daily",
    scheduledTime: "01:30",
    timezone: "America/New_York",
  });
  const next = Date.parse("2026-11-01T05:30:00Z");
  await staff.mutation(api.reporting.runReportManually, { reportId });
  await t.finishAllScheduledFunctions(() => vi.advanceTimersByTime(0));
  expect(
    (await staff.query(api.reporting.getScheduledReport, { reportId }))
      ?.nextRunAt,
  ).toBe(next);
  vi.setSystemTime(new Date("2026-11-01T05:30:00Z"));
  // Invoke the cron boundary, then observe only the public reporting API.
  await t.mutation(internal.reporting.processDueReports, {});
  await t.mutation(internal.reporting.processDueReports, {});
  vi.setSystemTime(new Date("2026-11-01T06:30:00Z"));
  await t.mutation(internal.reporting.processDueReports, {});
  await t.finishAllScheduledFunctions(() => vi.advanceTimersByTime(0));
  const runs = await staff.query(api.reporting.listReportRuns, {
    organizationId,
    scheduledReportId: reportId,
  });
  expect(runs.filter((run) => run.triggeredBy === "schedule")).toHaveLength(1);
  const scheduled = runs.find((run) => run.triggeredBy === "schedule");
  expect(
    await staff.query(api.reporting.getReportRun, {
      runId: scheduled?._id ?? runs[0]!._id,
    }),
  ).toMatchObject({
    status: "success",
    scheduledFor: next,
    scheduleRevision: 1,
  });
  expect(
    (await staff.query(api.reporting.getScheduledReport, { reportId }))
      ?.nextRunAt,
  ).toBe(Date.parse("2026-11-02T06:30:00Z"));
});

test("failed KPI configuration can be corrected and retried as the same run without claiming ignored filters", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-05-01T12:00:00Z"));
  const { staff, t, organizationId, userId } = await setup();
  const reportId = await t.run((ctx) =>
    ctx.db.insert("scheduledReports", {
      organizationId,
      name: "Legacy filtered KPI",
      reportType: "operational_kpis",
      reportConfig: { includeComparison: true },
      schedule: "daily",
      scheduledTime: "09:00",
      timezone: "UTC",
      nextRunAt: Date.parse("2026-05-01T09:00:00Z"),
      isActive: true,
      createdBy: userId,
      createdAt: Date.now(),
    }),
  );
  await t.mutation(internal.reporting.processDueReports, {});
  await t.finishAllScheduledFunctions(() => vi.advanceTimersByTime(0));
  const [first] = await staff.query(api.reporting.listReportRuns, {
    organizationId,
    scheduledReportId: reportId,
  });
  expect(first).toMatchObject({ status: "failed", outputState: "unavailable" });
  if (!first) throw new Error("Expected failed run");
  const nextRunAt = (
    await staff.query(api.reporting.getScheduledReport, { reportId })
  )?.nextRunAt;
  await staff.mutation(api.reporting.updateScheduledReport, {
    reportId,
    reportConfig: {},
  });
  vi.setSystemTime(new Date("2026-05-01T13:00:00Z"));
  await staff.mutation(api.reporting.retryReportRun, { runId: first._id });
  await expect(
    staff.mutation(api.reporting.retryReportRun, { runId: first._id }),
  ).rejects.toThrow("already running");
  await t.finishAllScheduledFunctions(() => vi.advanceTimersByTime(0));
  expect(
    await staff.query(api.reporting.getReportRun, { runId: first._id }),
  ).toMatchObject({
    status: "success",
    outputState: "stored",
    scheduledFor: Date.parse("2026-05-01T09:00:00Z"),
    attemptCount: 2,
    artifact: { generatedAt: Date.parse("2026-05-01T13:00:00Z") },
  });
  expect(
    await staff.query(api.reporting.listReportRuns, {
      organizationId,
      scheduledReportId: reportId,
    }),
  ).toHaveLength(1);
  expect(
    (await staff.query(api.reporting.getScheduledReport, { reportId }))
      ?.nextRunAt,
  ).toBe(nextRunAt);
  await expect(
    staff.mutation(api.reporting.retryReportRun, { runId: first._id }),
  ).rejects.toThrow("cannot be retried");
});
