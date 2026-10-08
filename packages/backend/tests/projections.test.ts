import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "../convex/_generated/api";
import schema from "../convex/schema";
import {
  authedForUser,
  createConvexTest,
  createOrgUserWithPermissions,
  rebuildProjection,
} from "./testHarness";
import { modules } from "./testSetup";

async function fixture(
  permissions: string[] = [
    "organization.manage_settings",
    "organization.view_analytics",
  ],
) {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const organizationId = await ctx.db.insert("organizations", {
      name: "Projection Museum",
      slug: "projection-museum",
      type: "museum",
      subscriptionTier: "enterprise",
    });
    const userId = await ctx.db.insert("users", { name: "Registrar" });
    const roleId = await ctx.db.insert("roles", {
      organizationId,
      name: "Administrator",
      isSystemRole: false,
    });
    for (const name of permissions) {
      const permissionId = await ctx.db.insert("permissions", {
        name,
        category: "organization",
      });
      await ctx.db.insert("rolePermissions", { roleId, permissionId });
    }
    await ctx.db.insert("userOrganizations", {
      organizationId,
      userId,
      roleId,
      joinedAt: 1,
    });
    return { organizationId, userId };
  });
  const staff = t.withIdentity({
    subject: `${ids.userId}|session`,
    issuer: "https://example.test",
  });
  const settle = () => t.finishAllScheduledFunctions(vi.runAllTimers);
  return { t, staff, settle, ...ids };
}

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("projection health and rebuild", () => {
  test("an organization without a built projection reports it unavailable until an authorized rebuild completes", async () => {
    const { staff, settle, organizationId } = await fixture();

    expect(
      await staff.query(api.projections.getHealth, { organizationId }),
    ).toMatchObject({
      availability: "unavailable",
      reason: "not_built",
      active: null,
    });

    await staff.mutation(api.projections.startRebuild, { organizationId });
    expect(
      await staff.query(api.projections.getHealth, { organizationId }),
    ).toMatchObject({
      availability: "unavailable",
      reason: "building",
      building: { status: "building", mode: "rebuild" },
    });

    await settle();
    expect(
      await staff.query(api.projections.getHealth, { organizationId }),
    ).toMatchObject({
      availability: "ready",
      active: { status: "completed", processedRows: 1 },
      building: null,
    });
  });
});

describe("maintained inventory projection", () => {
  test("dashboard analytics are unavailable before the first build instead of reporting zeros", async () => {
    const { staff, organizationId } = await fixture();

    expect(
      await staff.query(api.dashboard.getAnalytics, { organizationId }),
    ).toEqual({
      availability: "unavailable",
      reason: "not_built",
      definitionVersion: 1,
    });
  });

  test("public catalog and loan writers keep owned inventory current without another rebuild", async () => {
    const t = createConvexTest();
    const setup = await createOrgUserWithPermissions(
      t,
      [
        "organization.view_analytics",
        "collections.create",
        "collections.read",
        "collections.update",
        "loans.create",
        "loans.read",
        "loans.update",
      ],
      { subscriptionTier: "enterprise" },
    );
    const { organizationId } = setup;
    await rebuildProjection(t, organizationId);
    const staff = authedForUser(t, setup.userId);

    const ownedId = await staff.mutation(api.collections.create, {
      organizationId,
      accessionNumber: "OWN-1",
      title: "Owned vase",
    });
    const borrowedId = await staff.mutation(api.collections.create, {
      organizationId,
      accessionNumber: "IN-1",
      title: "Borrowed bowl",
    });
    const loanId = await staff.mutation(api.loans.create, {
      organizationId,
      loanNumber: "L-IN-1",
      type: "incoming",
      lenderBorrowerName: "Lender",
      startDate: 1_000,
      collectionIds: [borrowedId],
    });

    expect(
      await staff.query(api.dashboard.getAnalytics, { organizationId }),
    ).toMatchObject({
      availability: "ready",
      objects: { total: 1, active: 1, incomingLoanExcluded: 1 },
      loans: { total: 1, pending: 1, incoming: 1, outgoing: 0 },
    });

    const [item] = await t.run((ctx) =>
      ctx.db
        .query("loanItems")
        .withIndex("by_loan", (q) => q.eq("loanId", loanId))
        .collect(),
    );
    if (!item) throw new Error("loan item missing");
    await staff.mutation(api.loans.removeItems, {
      loanId,
      loanItemIds: [item._id],
    });

    expect(
      await staff.query(api.dashboard.getAnalytics, { organizationId }),
    ).toMatchObject({
      objects: { total: 2, incomingLoanExcluded: 0 },
    });
    expect(ownedId).not.toEqual(borrowedId);
  });
});
