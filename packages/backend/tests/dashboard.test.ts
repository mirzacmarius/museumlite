import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import schema from "../convex/schema";
import type { ModuleId } from "../convex/utils/moduleCatalog";
import { expectReady, rebuildProjection } from "./testHarness";
import { modules } from "./testSetup";

type TestSetup = {
  organizationId: Id<"organizations">;
  userId: Id<"users">;
  roleId: Id<"roles">;
};

interface CreateTestOrgOptions {
  subscriptionTier?: "free" | "pro" | "enterprise";
  enabledModules?: Array<ModuleId>;
}

async function createTestOrg(
  t: ReturnType<typeof convexTest>,
  options: CreateTestOrgOptions = {},
): Promise<TestSetup> {
  const [organizationId, userId] = await Promise.all([
    t.run(async (ctx) => {
      return await ctx.db.insert("organizations", {
        name: "Dashboard Test Org",
        slug: `dashboard-org-${Math.random().toString(36).slice(2, 8)}`,
        type: "museum",
        ...(options.subscriptionTier
          ? { subscriptionTier: options.subscriptionTier }
          : {}),
        ...(options.enabledModules !== undefined
          ? { settings: { enabledModules: options.enabledModules } }
          : {}),
      });
    }),
    t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        name: "Dashboard User",
        email: `dashboard-${Math.random().toString(36).slice(2, 8)}@test.dev`,
      });
    }),
  ]);
  const [roleId, permissionId] = await Promise.all([
    t.run(async (ctx) => {
      return await ctx.db.insert("roles", {
        organizationId,
        name: "Admin",
        isSystemRole: true,
      });
    }),
    t.run(async (ctx) => {
      return await ctx.db.insert("permissions", {
        name: "organization.view_analytics",
        category: "organization",
      });
    }),
  ]);
  await t.run(async (ctx) => {
    await ctx.db.insert("rolePermissions", {
      roleId,
      permissionId,
    });
  });

  await t.run(async (ctx) => {
    await ctx.db.insert("userOrganizations", {
      userId,
      organizationId,
      roleId,
      joinedAt: Date.now(),
    });
  });

  return { organizationId, userId, roleId };
}

async function grantPermission(
  t: ReturnType<typeof convexTest>,
  roleId: Id<"roles">,
  name: string,
  category = "collections",
) {
  const permissionId = await t.run(async (ctx) => {
    return await ctx.db.insert("permissions", {
      name,
      category,
    });
  });

  await t.run(async (ctx) => {
    await ctx.db.insert("rolePermissions", {
      roleId,
      permissionId,
    });
  });
}

function createCollection(
  organizationId: Id<"organizations">,
  userId: Id<"users">,
  title: string,
  accessionNumber: string,
  status: "active" | "loaned" | "deaccessioned" | "archived" | "deleted",
) {
  return {
    organizationId,
    title,
    accessionNumber,
    status,
    catalogedBy: userId,
    catalogedAt: Date.now(),
  };
}

describe("Dashboard: getAnalytics", () => {
  test("returns zero counts for empty organization", async () => {
    // #given
    const t = convexTest(schema, modules);
    const { organizationId, userId } = await createTestOrg(t);

    // #when
    const authed = t.withIdentity({
      subject: `${userId}|session-empty`,
      issuer: "https://example.test",
    });

    await rebuildProjection(t, organizationId);
    const analytics = expectReady(
      await authed.query(api.dashboard.getAnalytics, {
        organizationId,
      }),
    );

    // #then
    expect(analytics.collections.total).toBe(0);
    expect(analytics.objects.total).toBe(0);
    expect(analytics.loans.total).toBe(0);
    expect(analytics.accessions.pending).toBe(0);
    expect(analytics.deaccessions.pending).toBe(0);
    expect(analytics.transfers.pending).toBe(0);
    expect(analytics.transfers.executed).toBe(0);
    expect(analytics.transfers.rejected).toBe(0);
    expect(analytics.transfers.cancelled).toBe(0);
    expect(analytics.locations.total).toBe(0);
  });

  test("counts objects by status correctly", async () => {
    // #given
    const t = convexTest(schema, modules);
    const { organizationId, userId } = await createTestOrg(t);

    await t.run(async (ctx) => {
      await ctx.db.insert(
        "collections",
        createCollection(
          organizationId,
          userId,
          "Active 1",
          "ACC-001",
          "active",
        ),
      );
      await ctx.db.insert(
        "collections",
        createCollection(
          organizationId,
          userId,
          "Active 2",
          "ACC-002",
          "active",
        ),
      );
      await ctx.db.insert(
        "collections",
        createCollection(organizationId, userId, "Loaned", "ACC-003", "loaned"),
      );
      await ctx.db.insert(
        "collections",
        createCollection(
          organizationId,
          userId,
          "Deacc",
          "ACC-004",
          "deaccessioned",
        ),
      );
      await ctx.db.insert(
        "collections",
        createCollection(
          organizationId,
          userId,
          "Deleted",
          "ACC-005",
          "deleted",
        ),
      );
      const pendingRemovalCollectionId = await ctx.db.insert(
        "collections",
        createCollection(
          organizationId,
          userId,
          "Pending removal",
          "ACC-006",
          "active",
        ),
      );
      await ctx.db.insert("deaccessions", {
        organizationId,
        collectionId: pendingRemovalCollectionId,
        deaccessionNumber: "DA-001",
        dateDeaccessioned: Date.now(),
        reason: "Duplicate object",
        method: "destruction",
        status: "pending",
        targetCollectionStatus: "deleted",
        workflowStep: 1,
        workflowHistory: [],
      });
    });

    // #when
    const authed = t.withIdentity({
      subject: `${userId}|session-objects`,
      issuer: "https://example.test",
    });

    await rebuildProjection(t, organizationId);
    const analytics = expectReady(
      await authed.query(api.dashboard.getAnalytics, {
        organizationId,
      }),
    );

    // #then
    expect(analytics.objects.total).toBe(2);
    expect(analytics.objects.active).toBe(2);
    expect(analytics.objects.loaned).toBe(0);
    expect(analytics.objects.ownershipUnclassified).toBe(1);
    expect(analytics.objects.deaccessioned).toBe(1);
  });

  test("counts loans by status and type correctly", async () => {
    // #given
    const t = convexTest(schema, modules);
    const { organizationId, userId } = await createTestOrg(t);

    await t.run(async (ctx) => {
      await ctx.db.insert("loans", {
        organizationId,
        loanNumber: "L-001",
        lenderBorrowerName: "Museum A",
        status: "pending",
        type: "incoming",
        startDate: Date.now(),
      });
      await ctx.db.insert("loans", {
        organizationId,
        loanNumber: "L-002",
        lenderBorrowerName: "Museum B",
        status: "active",
        type: "outgoing",
        startDate: Date.now(),
      });
      await ctx.db.insert("loans", {
        organizationId,
        loanNumber: "L-003",
        lenderBorrowerName: "Gallery C",
        status: "returned",
        type: "incoming",
        startDate: Date.now(),
      });
    });

    // #when
    const authed = t.withIdentity({
      subject: `${userId}|session-loans`,
      issuer: "https://example.test",
    });

    await rebuildProjection(t, organizationId);
    const analytics = expectReady(
      await authed.query(api.dashboard.getAnalytics, {
        organizationId,
      }),
    );

    // #then
    expect(analytics.loans.total).toBe(3);
    expect(analytics.loans.pending).toBe(1);
    expect(analytics.loans.active).toBe(1);
    expect(analytics.loans.returned).toBe(1);
    expect(analytics.loans.incoming).toBe(2);
    expect(analytics.loans.outgoing).toBe(1);
  });

  test("counts accessions by status", async () => {
    // #given
    const t = convexTest(schema, modules);
    const { organizationId, userId } = await createTestOrg(t);

    await t.run(async (ctx) => {
      await ctx.db.insert("accessions", {
        organizationId,
        accessionNumber: "A-001",
        source: "Donation",
        method: "gift",
        dateReceived: Date.now(),
        status: "pending",
      });
      await ctx.db.insert("accessions", {
        organizationId,
        accessionNumber: "A-002",
        source: "Purchase",
        method: "purchase",
        dateReceived: Date.now(),
        status: "approved",
      });
    });

    // #when
    const authed = t.withIdentity({
      subject: `${userId}|session-acc`,
      issuer: "https://example.test",
    });

    await rebuildProjection(t, organizationId);
    const analytics = expectReady(
      await authed.query(api.dashboard.getAnalytics, {
        organizationId,
      }),
    );

    // #then
    expect(analytics.accessions.pending).toBe(1);
    expect(analytics.accessions.approved).toBe(1);
    expect(analytics.accessions.rejected).toBe(0);
  });

  test("counts transfer requests by status for the source organization only", async () => {
    const t = convexTest(schema, modules);
    const { organizationId, userId, roleId } = await createTestOrg(t);

    await grantPermission(
      t,
      roleId,
      "organization.manage_settings",
      "organization",
    );

    const [targetOrganizationId, otherSourceOrganizationId, collectionId] =
      await Promise.all([
        t.run(async (ctx) => {
          return await ctx.db.insert("organizations", {
            name: "Transfer Target Org",
            slug: `transfer-target-${Math.random().toString(36).slice(2, 8)}`,
            type: "museum",
          });
        }),
        t.run(async (ctx) => {
          return await ctx.db.insert("organizations", {
            name: "Other Source Org",
            slug: `transfer-source-${Math.random().toString(36).slice(2, 8)}`,
            type: "museum",
          });
        }),
        t.run(async (ctx) => {
          return await ctx.db.insert(
            "collections",
            createCollection(
              organizationId,
              userId,
              "Transfer Source Object",
              "TR-001",
              "active",
            ),
          );
        }),
      ]);
    const otherCollectionId = await t.run(async (ctx) => {
      return await ctx.db.insert(
        "collections",
        createCollection(
          otherSourceOrganizationId,
          userId,
          "External Transfer Object",
          "TR-999",
          "active",
        ),
      );
    });

    await t.run(async (ctx) => {
      await ctx.db.insert("organizationMoveRequests", {
        collectionId,
        sourceOrganizationId: organizationId,
        targetOrganizationId,
        sourceAccessionNumber: "TR-001",
        accessionMode: "keep",
        reason: "Canonical source approval",
        status: "pending_source_approval",
        requestedBy: userId,
        requestedAt: 1000,
      });
      await ctx.db.insert("organizationMoveRequests", {
        collectionId,
        sourceOrganizationId: organizationId,
        targetOrganizationId,
        sourceAccessionNumber: "TR-001",
        accessionMode: "keep",
        reason: "Pending transfer",
        status: "pending",
        requestedBy: userId,
        requestedAt: Date.now(),
      });
      await ctx.db.insert("organizationMoveRequests", {
        collectionId,
        sourceOrganizationId: organizationId,
        targetOrganizationId,
        sourceAccessionNumber: "TR-001",
        accessionMode: "keep",
        reason: "Executed transfer",
        status: "executed",
        requestedBy: userId,
        requestedAt: Date.now() + 1,
      });
      await ctx.db.insert("organizationMoveRequests", {
        collectionId,
        sourceOrganizationId: organizationId,
        targetOrganizationId,
        sourceAccessionNumber: "TR-001",
        accessionMode: "keep",
        reason: "Rejected transfer",
        status: "rejected",
        requestedBy: userId,
        requestedAt: Date.now() + 2,
      });
      await ctx.db.insert("organizationMoveRequests", {
        collectionId,
        sourceOrganizationId: organizationId,
        targetOrganizationId,
        sourceAccessionNumber: "TR-001",
        accessionMode: "keep",
        reason: "Cancelled transfer",
        status: "cancelled",
        requestedBy: userId,
        requestedAt: Date.now() + 3,
      });
      await ctx.db.insert("organizationMoveRequests", {
        collectionId: otherCollectionId,
        sourceOrganizationId: otherSourceOrganizationId,
        targetOrganizationId: organizationId,
        sourceAccessionNumber: "TR-999",
        accessionMode: "keep",
        reason: "Incoming transfer should not count",
        status: "pending",
        requestedBy: userId,
        requestedAt: Date.now() + 4,
      });
    });

    const authed = t.withIdentity({
      subject: `${userId}|session-transfers`,
      issuer: "https://example.test",
    });

    await rebuildProjection(t, organizationId);
    const analytics = expectReady(
      await authed.query(api.dashboard.getAnalytics, {
        organizationId,
      }),
    );

    expect(analytics.transfers.pending).toBe(2);
    const board = await authed.query(api.objectMoves.listForOrganization, {
      organizationId,
    });
    expect(
      board
        .filter(
          (request) =>
            request.direction === "outgoing" &&
            request.status === "pending_source_approval",
        )
        .map((request) => request.reason)
        .sort(),
    ).toEqual(["Canonical source approval", "Pending transfer"]);
    expect(analytics.transfers.executed).toBe(1);
    expect(analytics.transfers.rejected).toBe(1);
    expect(analytics.transfers.cancelled).toBe(1);
  });

  test("enforces organization isolation", async () => {
    // #given
    const t = convexTest(schema, modules);
    const [{ organizationId, userId }, otherOrgId] = await Promise.all([
      createTestOrg(t),
      t.run(async (ctx) => {
        return await ctx.db.insert("organizations", {
          name: "Other Org",
          slug: `other-org-${Math.random().toString(36).slice(2, 8)}`,
          type: "museum",
        });
      }),
    ]);
    await t.run(async (ctx) => {
      await ctx.db.insert(
        "collections",
        createCollection(
          organizationId,
          userId,
          "My Object",
          "ACC-MINE",
          "active",
        ),
      );
      await ctx.db.insert(
        "collections",
        createCollection(
          otherOrgId,
          userId,
          "Other Object",
          "ACC-OTHER",
          "active",
        ),
      );
    });

    // #when
    const authed = t.withIdentity({
      subject: `${userId}|session-isolation`,
      issuer: "https://example.test",
    });

    await rebuildProjection(t, organizationId);
    const analytics = expectReady(
      await authed.query(api.dashboard.getAnalytics, {
        organizationId,
      }),
    );

    // #then
    expect(analytics.objects.total).toBe(1);
  });

  test("returns onDisplay count in analytics", async () => {
    // #given
    const t = convexTest(schema, modules);
    const { organizationId, userId } = await createTestOrg(t);

    // #when
    const authed = t.withIdentity({
      subject: `${userId}|session-ondisplay`,
      issuer: "https://example.test",
    });

    await rebuildProjection(t, organizationId);
    const analytics = expectReady(
      await authed.query(api.dashboard.getAnalytics, {
        organizationId,
      }),
    );

    // #then
    expect(analytics.objects).toHaveProperty("onDisplay");
    expect(typeof analytics.objects.onDisplay).toBe("number");
  });

  test("onDisplay count is 0 for empty organization", async () => {
    // #given
    const t = convexTest(schema, modules);
    const { organizationId, userId } = await createTestOrg(t);

    // #when
    const authed = t.withIdentity({
      subject: `${userId}|session-ondisplay-empty`,
      issuer: "https://example.test",
    });

    await rebuildProjection(t, organizationId);
    const analytics = expectReady(
      await authed.query(api.dashboard.getAnalytics, {
        organizationId,
      }),
    );

    // #then
    expect(analytics.objects.onDisplay).toBe(0);
  });

  test("recentCollectionGroups includes storageLocation and valuation", async () => {
    // #given
    const t = convexTest(schema, modules);
    const { organizationId, userId } = await createTestOrg(t);

    await t.run(async (ctx) => {
      const _collectionGroupId = await ctx.db.insert("collectionGroups", {
        organizationId,
        name: "Test Collection Group",
        description: "A test collection group",
        itemsCount: 5,
        storageLocation: "Building A, Room 101",
        valuation: 50000,
        createdAt: Date.now(),
        createdBy: userId,
      });

      // Create a collection to associate with the group
      await ctx.db.insert(
        "collections",
        createCollection(
          organizationId,
          userId,
          "Test Item",
          "ACC-TEST-001",
          "active",
        ),
      );
    });

    // #when
    const authed = t.withIdentity({
      subject: `${userId}|session-recent-groups`,
      issuer: "https://example.test",
    });

    await rebuildProjection(t, organizationId);
    const analytics = expectReady(
      await authed.query(api.dashboard.getAnalytics, {
        organizationId,
      }),
    );

    // #then
    expect(analytics.recentCollectionGroups.length).toBeGreaterThan(0);
    const group = analytics.recentCollectionGroups[0];
    expect(group).toHaveProperty("storageLocation");
    expect(group).toHaveProperty("valuation");
    expect(group.storageLocation).toBe("Building A, Room 101");
    expect(group.valuation).toBe(50000);
  });
});

describe("Dashboard: getOperationalKpis", () => {
  const fixedNow = 1_700_000_000_000;

  test("reports inventory valuation unavailable when its module is disabled", async () => {
    // #given
    const t = convexTest(schema, modules);
    const { organizationId, userId, roleId } = await createTestOrg(t, {
      subscriptionTier: "pro",
    });
    await grantPermission(t, roleId, "collections.read");

    await t.run(async (ctx) => {
      const collectionId = await ctx.db.insert(
        "collections",
        createCollection(
          organizationId,
          userId,
          "Appraised painting",
          "ACC-VAL-001",
          "active",
        ),
      );
      await ctx.db.insert("fineArtDetails", {
        collectionId,
        organizationId,
        appraisedValue: 125_000,
        createdAt: Date.now(),
      });
    });

    // #when
    const authed = t.withIdentity({
      subject: `${userId}|session-operational-kpis-disabled`,
      issuer: "https://example.test",
    });
    await rebuildProjection(t, organizationId);
    const kpis = expectReady(
      await authed.query(api.dashboard.getOperationalKpis, {
        organizationId,
        now: fixedNow,
      }),
    );

    // #then
    expect(kpis.inventory).toMatchObject({
      available: false,
      unavailableReason: "inventory_valuation_module_disabled",
      totalValue: null,
      fineArt: { itemCount: null, valuedCount: null },
    });
  });

  test("does not aggregate valuation amounts without source currency", async () => {
    // #given
    const t = convexTest(schema, modules);
    const { organizationId, userId, roleId } = await createTestOrg(t, {
      subscriptionTier: "pro",
      enabledModules: ["inventory_valuation"],
    });
    await grantPermission(t, roleId, "collections.read");

    await t.run(async (ctx) => {
      const collectionId = await ctx.db.insert(
        "collections",
        createCollection(
          organizationId,
          userId,
          "Appraised sculpture",
          "ACC-VAL-002",
          "active",
        ),
      );
      await ctx.db.insert("fineArtDetails", {
        collectionId,
        organizationId,
        appraisedValue: 0,
        createdAt: Date.now(),
      });
    });

    // #when
    const authed = t.withIdentity({
      subject: `${userId}|session-operational-kpis-enabled`,
      issuer: "https://example.test",
    });
    await rebuildProjection(t, organizationId);
    const kpis = expectReady(
      await authed.query(api.dashboard.getOperationalKpis, {
        organizationId,
        now: fixedNow,
      }),
    );

    // #then
    expect(kpis.inventory).toMatchObject({
      available: false,
      unavailableReason: "valuation_currency_not_recorded",
      totalValue: null,
      fineArt: { totalValue: null },
    });
    expect(kpis.inventory.fineArt.itemCount).toBe(1);
    expect(kpis.inventory.fineArt.valuedCount).toBe(1);
    expect(kpis.inventory.wine).toMatchObject({
      itemCount: 0,
      valuedCount: 0,
      totalValue: null,
    });
  });
});

describe("Dashboard: getComplianceReport", () => {
  test("counts only audit events within the report date range", async () => {
    const t = convexTest(schema, modules);
    const { organizationId, userId, roleId } = await createTestOrg(t, {
      subscriptionTier: "enterprise",
    });
    await grantPermission(t, roleId, "collections.read");

    const rangeStart = 1_720_000_000_000;
    const rangeEnd = 1_720_086_400_000;

    await t.run(async (ctx) => {
      await ctx.db.insert("auditLog", {
        organizationId,
        userId,
        action: "in_range_a",
        entityType: "accession",
        entityId: "acc_in_1",
        timestamp: rangeStart + 1_000,
      });
      await ctx.db.insert("auditLog", {
        organizationId,
        userId,
        action: "in_range_b",
        entityType: "loan",
        entityId: "loan_in_1",
        timestamp: rangeEnd - 1_000,
      });
      await ctx.db.insert("auditLog", {
        organizationId,
        userId,
        action: "before_range",
        entityType: "accession",
        entityId: "acc_out_1",
        timestamp: rangeStart - 86_400_000,
      });
      await ctx.db.insert("auditLog", {
        organizationId,
        userId,
        action: "after_range",
        entityType: "accession",
        entityId: "acc_out_2",
        timestamp: rangeEnd + 86_400_000,
      });
    });

    const authed = t.withIdentity({
      subject: `${userId}|session-compliance-report`,
      issuer: "https://example.test",
    });
    await rebuildProjection(t, organizationId);
    const report = expectReady(
      await authed.query(api.dashboard.getComplianceReport, {
        organizationId,
        now: rangeEnd,
        dateRangeStart: rangeStart,
        dateRangeEnd: rangeEnd,
      }),
    );

    expect(report.auditTrail.totalEvents).toBe(2);
    expect(report.auditTrail.recentEvents).toHaveLength(2);
    expect(
      report.auditTrail.recentEvents.every(
        (event) => event.timestamp >= rangeStart && event.timestamp <= rangeEnd,
      ),
    ).toBe(true);
    expect(report.auditTrail.eventsByType).toEqual(
      expect.arrayContaining([
        { entityType: "accession", count: 1 },
        { entityType: "loan", count: 1 },
      ]),
    );
  });
});

describe("Dashboard metric drilldowns", () => {
  test("owned inventory and display counts match paginated catalog without inventing legacy ownership", async () => {
    const t = convexTest(schema, modules);
    const { organizationId, userId, roleId } = await createTestOrg(t);
    await grantPermission(t, roleId, "collections.read");
    await t.run(async (ctx) => {
      const ownedId = await ctx.db.insert("collections", {
        ...createCollection(
          organizationId,
          userId,
          "Owned on display",
          "OWN-1",
          "active",
        ),
        displayStatus: "on_display",
      });
      await ctx.db.insert(
        "collections",
        createCollection(
          organizationId,
          userId,
          "Archived owned",
          "OWN-2",
          "archived",
        ),
      );
      const outgoingId = await ctx.db.insert(
        "collections",
        createCollection(
          organizationId,
          userId,
          "Outgoing owned",
          "OUT-1",
          "loaned",
        ),
      );
      const incomingId = await ctx.db.insert("collections", {
        ...createCollection(
          organizationId,
          userId,
          "Incoming displayed",
          "IN-1",
          "active",
        ),
        displayStatus: "on_display",
      });
      const ambiguousId = await ctx.db.insert(
        "collections",
        createCollection(
          organizationId,
          userId,
          "Contradictory ownership",
          "UNKNOWN-1",
          "active",
        ),
      );
      await ctx.db.insert(
        "collections",
        createCollection(
          organizationId,
          userId,
          "Unlinked loaned legacy",
          "UNKNOWN-2",
          "loaned",
        ),
      );
      const deaccessionId = await ctx.db.insert(
        "collections",
        createCollection(
          organizationId,
          userId,
          "Open deaccession",
          "DEA-1",
          "active",
        ),
      );
      await ctx.db.insert("deaccessions", {
        organizationId,
        collectionId: deaccessionId,
        deaccessionNumber: "DEA-1",
        dateDeaccessioned: 1000,
        reason: "Review",
        method: "donation",
        targetCollectionStatus: "deaccessioned",
        status: "pending",
      });
      for (const [type, collectionId] of [
        ["incoming", incomingId],
        ["outgoing", outgoingId],
        ["incoming", ambiguousId],
        ["outgoing", ambiguousId],
      ] as const) {
        const loanId = await ctx.db.insert("loans", {
          organizationId,
          loanNumber: `${type}-${collectionId}`,
          type,
          lenderBorrowerName: "Partner",
          startDate: 1000,
          status: "returned",
        });
        await ctx.db.insert("loanItems", {
          loanId,
          collectionId,
          custodyStatus: "returned",
        });
      }
      const otherOrg = await ctx.db.insert("organizations", {
        name: "Other",
        slug: "other-metric-drilldown",
        type: "museum",
      });
      await ctx.db.insert(
        "collections",
        createCollection(otherOrg, userId, "Other tenant", "FOREIGN", "active"),
      );
      const foreignLoan = await ctx.db.insert("loans", {
        organizationId: otherOrg,
        loanNumber: "FOREIGN",
        type: "incoming",
        lenderBorrowerName: "Partner",
        startDate: 1000,
        status: "active",
      });
      await ctx.db.insert("loanItems", {
        loanId: foreignLoan,
        collectionId: ownedId,
      });
    });
    const reader = t.withIdentity({ subject: `${userId}|metrics` });
    await rebuildProjection(t, organizationId);
    const analytics = expectReady(
      await reader.query(api.dashboard.getAnalytics, {
        organizationId,
      }),
    );
    const names: string[] = [];
    let cursor: string | null = null;
    for (;;) {
      const page = await reader.query(api.collections.list, {
        organizationId,
        inventoryMetricScope: "owned",
        paginationOpts: { numItems: 1, cursor },
      });
      names.push(...page.page.map((item) => item.title));
      if (page.isDone) break;
      cursor = page.continueCursor;
    }
    expect(names.sort()).toEqual([
      "Archived owned",
      "Outgoing owned",
      "Owned on display",
    ]);
    expect(analytics.objects).toMatchObject({
      total: 3,
      active: 1,
      loaned: 1,
      onDisplay: 1,
      incomingLoanExcluded: 1,
      ownershipUnclassified: 2,
    });
    const incoming = await reader.query(api.collections.list, {
      organizationId,
      inventoryMetricScope: "incoming",
      paginationOpts: { numItems: 100, cursor: null },
    });
    expect(incoming.page.map((item) => item.title)).toEqual([
      "Incoming displayed",
    ]);
    const unclassified = await reader.query(api.collections.list, {
      organizationId,
      inventoryMetricScope: "unclassified",
      paginationOpts: { numItems: 100, cursor: null },
    });
    expect(unclassified.page.map((item) => item.title).sort()).toEqual([
      "Contradictory ownership",
      "Unlinked loaned legacy",
    ]);
    const display = await reader.query(api.collections.list, {
      organizationId,
      inventoryMetricScope: "owned",
      status: "active",
      displayStatus: "on_display",
      paginationOpts: { numItems: 100, cursor: null },
    });
    expect(display.page.map((item) => item.title)).toEqual([
      "Owned on display",
    ]);
    await expect(
      t.query(api.collections.list, {
        organizationId,
        inventoryMetricScope: "owned",
        paginationOpts: { numItems: 1, cursor: null },
      }),
    ).rejects.toThrow();
    const outsider = await createTestOrg(t);
    await expect(
      t.withIdentity({ subject: outsider.userId }).query(api.collections.list, {
        organizationId,
        inventoryMetricScope: "owned",
        paginationOpts: { numItems: 1, cursor: null },
      }),
    ).rejects.toThrow();
  });
});
