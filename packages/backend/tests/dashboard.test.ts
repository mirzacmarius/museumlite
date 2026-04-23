import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import schema from "../convex/schema";
import { modules } from "./testSetup";

type TestSetup = {
  organizationId: Id<"organizations">;
  userId: Id<"users">;
  roleId: Id<"roles">;
};

async function createTestOrg(
  t: ReturnType<typeof convexTest>,
): Promise<TestSetup> {
  const organizationId = await t.run(async (ctx) => {
    return await ctx.db.insert("organizations", {
      name: "Dashboard Test Org",
      slug: `dashboard-org-${Math.random().toString(36).slice(2, 8)}`,
      type: "museum",
    });
  });

  const userId = await t.run(async (ctx) => {
    return await ctx.db.insert("users", {
      name: "Dashboard User",
      email: `dashboard-${Math.random().toString(36).slice(2, 8)}@test.dev`,
    });
  });

  const roleId = await t.run(async (ctx) => {
    return await ctx.db.insert("roles", {
      organizationId,
      name: "Admin",
      isSystemRole: true,
    });
  });

  const permissionId = await t.run(async (ctx) => {
    return await ctx.db.insert("permissions", {
      name: "organization.view_analytics",
      category: "organization",
    });
  });

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

    const analytics = await authed.query(api.dashboard.getAnalytics, {
      organizationId,
    });

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

    const analytics = await authed.query(api.dashboard.getAnalytics, {
      organizationId,
    });

    // #then
    expect(analytics.objects.total).toBe(3);
    expect(analytics.objects.active).toBe(2);
    expect(analytics.objects.loaned).toBe(1);
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

    const analytics = await authed.query(api.dashboard.getAnalytics, {
      organizationId,
    });

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

    const analytics = await authed.query(api.dashboard.getAnalytics, {
      organizationId,
    });

    // #then
    expect(analytics.accessions.pending).toBe(1);
    expect(analytics.accessions.approved).toBe(1);
    expect(analytics.accessions.rejected).toBe(0);
  });

  test("counts transfer requests by status for the source organization only", async () => {
    const t = convexTest(schema, modules);
    const { organizationId, userId } = await createTestOrg(t);

    const targetOrganizationId = await t.run(async (ctx) => {
      return await ctx.db.insert("organizations", {
        name: "Transfer Target Org",
        slug: `transfer-target-${Math.random().toString(36).slice(2, 8)}`,
        type: "museum",
      });
    });

    const otherSourceOrganizationId = await t.run(async (ctx) => {
      return await ctx.db.insert("organizations", {
        name: "Other Source Org",
        slug: `transfer-source-${Math.random().toString(36).slice(2, 8)}`,
        type: "museum",
      });
    });

    const collectionId = await t.run(async (ctx) => {
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
    });

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

    const analytics = await authed.query(api.dashboard.getAnalytics, {
      organizationId,
    });

    expect(analytics.transfers.pending).toBe(1);
    expect(analytics.transfers.executed).toBe(1);
    expect(analytics.transfers.rejected).toBe(1);
    expect(analytics.transfers.cancelled).toBe(1);
  });

  test("enforces organization isolation", async () => {
    // #given
    const t = convexTest(schema, modules);
    const { organizationId, userId } = await createTestOrg(t);

    const otherOrgId = await t.run(async (ctx) => {
      return await ctx.db.insert("organizations", {
        name: "Other Org",
        slug: `other-org-${Math.random().toString(36).slice(2, 8)}`,
        type: "museum",
      });
    });

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

    const analytics = await authed.query(api.dashboard.getAnalytics, {
      organizationId,
    });

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

    const analytics = await authed.query(api.dashboard.getAnalytics, {
      organizationId,
    });

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

    const analytics = await authed.query(api.dashboard.getAnalytics, {
      organizationId,
    });

    // #then
    expect(analytics.objects.onDisplay).toBe(0);
  });

  test("recentCollectionGroups includes storageLocation and valuation", async () => {
    // #given
    const t = convexTest(schema, modules);
    const { organizationId, userId } = await createTestOrg(t);

    await t.run(async (ctx) => {
      const collectionGroupId = await ctx.db.insert("collectionGroups", {
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

    const analytics = await authed.query(api.dashboard.getAnalytics, {
      organizationId,
    });

    // #then
    expect(analytics.recentCollectionGroups.length).toBeGreaterThan(0);
    const group = analytics.recentCollectionGroups[0];
    expect(group).toHaveProperty("storageLocation");
    expect(group).toHaveProperty("valuation");
    expect(group.storageLocation).toBe("Building A, Room 101");
    expect(group.valuation).toBe(50000);
  });
});
