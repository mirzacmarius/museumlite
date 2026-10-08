import { convexTest } from "convex-test";
import { expect, test } from "vitest";

import { expectReady, rebuildProjection } from "../tests/testHarness";
import { modules } from "../tests/testSetup";
import { api } from "./_generated/api";
import schema from "./schema";

test("exhibition metric drilldown applies schedule, lifecycle, and loan filters at one asOf", async () => {
  const t = convexTest(schema, modules);
  const fixture = await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", { name: "Registrar" });
    const organizationId = await ctx.db.insert("organizations", {
      name: "Museum",
      slug: "metrics-museum",
      type: "museum",
      subscriptionTier: "pro",
    });
    const permissionIds = await Promise.all(
      ["collections.read", "organization.view_analytics"].map((name) =>
        ctx.db.insert("permissions", {
          name,
          category: "collections",
          description: "Read analytics",
        }),
      ),
    );
    const roleId = await ctx.db.insert("roles", {
      organizationId,
      name: "Reader",
      description: "Read only",
      isSystemRole: false,
    });
    for (const permissionId of permissionIds) {
      await ctx.db.insert("rolePermissions", { roleId, permissionId });
    }
    await ctx.db.insert("userOrganizations", {
      userId,
      organizationId,
      roleId,
      joinedAt: Date.now(),
    });
    const asOf = 1000;
    const rows = [
      {
        title: "Current approved",
        startDate: 900,
        endDate: 1100,
        status: "approved" as const,
        isCurrent: true,
      },
      {
        title: "Future active",
        startDate: 1001,
        endDate: 1200,
        status: "active" as const,
        isCurrent: true,
      },
      {
        title: "Current loan",
        startDate: 900,
        endDate: 1100,
        status: "active" as const,
        isCurrent: true,
        isLoan: true,
      },
      {
        title: "Legacy current",
        startDate: 900,
        endDate: 1100,
        isCurrent: true,
      },
      {
        title: "Starts at instant",
        startDate: 1000,
        endDate: 1100,
        status: "installing" as const,
        isCurrent: true,
      },
      {
        title: "Ends at instant",
        startDate: 900,
        endDate: 1000,
        status: "closed" as const,
        isCurrent: false,
      },
      {
        title: "Past active",
        startDate: 900,
        endDate: 999,
        status: "active" as const,
        isCurrent: false,
      },
      {
        title: "No recorded end",
        startDate: 900,
        status: "approved" as const,
        isCurrent: true,
      },
    ];
    for (const row of rows) {
      await ctx.db.insert("exhibitions", {
        organizationId,
        title: row.title,
        startDate: row.startDate,
        endDate: row.endDate,
        isCurrent: row.isCurrent,
        status: row.status,
        isLoan: row.isLoan,
      });
    }
    await ctx.db.insert("collections", {
      organizationId,
      accessionNumber: "OWNED-1",
      title: "Owned record",
      status: "active",
      catalogedBy: userId,
      catalogedAt: asOf,
    });
    const incomingCollectionId = await ctx.db.insert("collections", {
      organizationId,
      accessionNumber: "INCOMING-1",
      title: "Incoming loan record",
      status: "loaned",
      catalogedBy: userId,
      catalogedAt: asOf,
    });
    const incomingLoanId = await ctx.db.insert("loans", {
      organizationId,
      loanNumber: "IN-1",
      type: "incoming",
      lenderBorrowerName: "Lender",
      startDate: asOf,
      status: "active",
    });
    await ctx.db.insert("loanItems", {
      loanId: incomingLoanId,
      collectionId: incomingCollectionId,
    });
    return { organizationId, userId, asOf };
  });
  await rebuildProjection(t, fixture.organizationId);

  const result = await t
    .withIdentity({ subject: fixture.userId })
    .query(api.exhibitions.listByOrganization, {
      organizationId: fixture.organizationId,
      metricFilters: {
        asOf: fixture.asOf,
        schedule: "current",
        lifecycle: "unclassified",
      },
    });

  expect(result.map((row) => row.title)).toEqual(["Legacy current"]);

  const kpis = expectReady(
    await t
      .withIdentity({ subject: fixture.userId })
      .query(api.dashboard.getOperationalKpis, {
        organizationId: fixture.organizationId,
        asOf: fixture.asOf,
      }),
  );

  expect(kpis.asOf).toBe(fixture.asOf);
  expect(kpis.inventory).toMatchObject({
    available: false,
    unavailableReason: "inventory_valuation_module_disabled",
    totalValue: null,
    fineArt: { itemCount: null, totalValue: null },
  });
  expect(kpis.exhibitions).toMatchObject({
    approved: 2,
    active: 2,
    unclassified: 1,
    excludedLoans: 1,
    legacyContradictions: 2,
    bySchedule: { current: 5, upcoming: 1, past: 1 },
  });

  const reader = t.withIdentity({ subject: fixture.userId });
  for (const [schedule, expected] of [
    [
      "current",
      [
        "Current approved",
        "Ends at instant",
        "Legacy current",
        "No recorded end",
        "Starts at instant",
      ],
    ],
    ["upcoming", ["Future active"]],
    ["past", ["Past active"]],
  ] as const) {
    const rows = await reader.query(api.exhibitions.listByOrganization, {
      organizationId: fixture.organizationId,
      metricFilters: { asOf: fixture.asOf, schedule },
    });
    expect(rows.map((row) => row.title).sort()).toEqual(expected.toSorted());
    expect(rows.length).toBe(kpis.exhibitions.bySchedule[schedule]);
  }
  const active = await reader.query(api.exhibitions.listByOrganization, {
    organizationId: fixture.organizationId,
    metricFilters: { asOf: fixture.asOf, lifecycle: "active" },
  });
  expect(active.map((row) => row.title).sort()).toEqual([
    "Future active",
    "Past active",
  ]);
  expect(active.length).toBe(kpis.exhibitions.active);
  await expect(
    t.query(api.exhibitions.listByOrganization, {
      organizationId: fixture.organizationId,
      metricFilters: { asOf: fixture.asOf, schedule: "current" },
    }),
  ).rejects.toThrow();

  const overview = expectReady(
    await t
      .withIdentity({ subject: fixture.userId })
      .query(api.dashboard.getAnalytics, {
        organizationId: fixture.organizationId,
      }),
  );
  expect(overview.objects.total).toBe(1);
  expect(overview.objects.incomingLoanExcluded).toBe(1);

  const catalogTrends = expectReady(
    await t
      .withIdentity({ subject: fixture.userId })
      .query(api.reporting.getCollectionTrends, {
        organizationId: fixture.organizationId,
        period: "monthly",
        startDate: 0,
        endDate: 60 * 60 * 1000,
      }),
  );
  expect(catalogTrends.historicalTotalAvailability).toBe("unavailable");
  expect(catalogTrends.current[0]?.totalObjects).toBeNull();
});
