import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api } from "../convex/_generated/api";
import schema from "../convex/schema";
import {
  authedForUser,
  createOrgUserCollectionWithPermissions,
} from "./testHarness";

import { modules } from "./testSetup";

test("approval counts include every actionable kind before the card limit", async () => {
  const t = convexTest(schema, modules);
  const { organizationId, userId, roleId, collectionId } =
    await createOrgUserCollectionWithPermissions(t, []);
  await t.run(async (ctx) => {
    for (const workflowType of [
      "accession",
      "deaccession",
      "exhibition",
      "conservation",
    ] as const) {
      await ctx.db.insert("workflowConfigs", {
        organizationId,
        workflowType,
        canInitiateRoles: [roleId],
        steps: [{ stepNumber: 1, roleId, name: "Review" }],
      });
    }
    for (let index = 0; index < 3; index++) {
      await ctx.db.insert("accessions", {
        organizationId,
        accessionNumber: `ACC-${index}`,
        dateReceived: 100,
        source: "Donor",
        method: "gift",
        status: "pending",
      });
    }
    for (let index = 0; index < 2; index++) {
      await ctx.db.insert("deaccessions", {
        organizationId,
        collectionId,
        deaccessionNumber: `DEA-${index}`,
        dateDeaccessioned: 200,
        reason: "Duplicate",
        method: "transfer",
        status: "pending",
      });
    }
    await ctx.db.insert("exhibitions", {
      organizationId,
      title: "Proposed exhibition",
      startDate: 300,
      isCurrent: false,
      status: "proposed",
    });
    await ctx.db.insert("conservationTreatments", {
      organizationId,
      collectionId,
      title: "Repair",
      description: "Repair frame",
      treatmentType: "repair",
      performedBy: userId,
      performedAt: 400,
      status: "proposed",
    });
    await ctx.db.insert("loans", {
      organizationId,
      loanNumber: "LOAN-NO-PERMISSION",
      type: "outgoing",
      lenderBorrowerName: "Other museum",
      startDate: 500,
      status: "pending",
    });
  });

  const result = await authedForUser(t, userId).query(
    api.assignments.listMyAssignments,
    { organizationId, limit: 1 },
  );

  expect(result.pendingApprovals.map((approval) => approval.type)).toEqual([
    "accession",
  ]);
  expect(result.stats).toMatchObject({
    totalPendingApprovals: 7,
    pendingApprovalsByType: {
      accession: 3,
      deaccession: 2,
      exhibition: 1,
      conservation: 1,
      loan: 0,
    },
  });
});

test("should require authentication for listMyAssignments", async () => {
  const t = convexTest(schema, modules);

  const orgId = await t.run(async (ctx) => {
    return await ctx.db.insert("organizations", {
      name: "Test Org",
      slug: "test-org",
      type: "museum",
      settings: { enabledModules: [] },
    });
  });

  await expect(
    t.query(api.assignments.listMyAssignments, {
      organizationId: orgId,
    }),
  ).rejects.toThrow("Not authenticated");
});

test("should return empty assignments when no data exists", async () => {
  const t = convexTest(schema, modules);

  const [userId, orgId] = await Promise.all([
    t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        name: "Test User",
        email: "test@example.com",
      });
    }),
    t.run(async (ctx) => {
      return await ctx.db.insert("organizations", {
        name: "Test Org",
        slug: "test-org",
        type: "museum",
        settings: { enabledModules: [] },
      });
    }),
  ]);
  const authed = t.withIdentity({
    subject: `${userId}|session-empty-assignments`,
    issuer: "https://example.test",
  });

  const result = await authed.query(api.assignments.listMyAssignments, {
    organizationId: orgId,
  });

  expect(result).toEqual({
    myAssignedAccessions: [],
    myCatalogedItems: [],
    pendingApprovals: [],
    recentlyModified: [],
    stats: {
      itemsModifiedThisWeek: 0,
      totalAssignedAccessions: 0,
      totalCatalogedItems: 0,
      totalPendingApprovals: 0,
      pendingApprovalsByType: {
        accession: 0,
        deaccession: 0,
        loan: 0,
        exhibition: 0,
        conservation: 0,
      },
    },
  });
});

test("should return valid assignment data structure", async () => {
  const t = convexTest(schema, modules);

  const [userId, orgId] = await Promise.all([
    t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        name: "Test User",
        email: "test@example.com",
      });
    }),
    t.run(async (ctx) => {
      return await ctx.db.insert("organizations", {
        name: "Test Org",
        slug: "test-org",
        type: "museum",
        settings: { enabledModules: [] },
      });
    }),
  ]);
  const authed = t.withIdentity({
    subject: `${userId}|session-data-structure`,
    issuer: "https://example.test",
  });

  const result = await authed.query(api.assignments.listMyAssignments, {
    organizationId: orgId,
  });

  expect(result).toHaveProperty("myAssignedAccessions");
  expect(result).toHaveProperty("myCatalogedItems");
  expect(result).toHaveProperty("pendingApprovals");
  expect(result).toHaveProperty("recentlyModified");
  expect(result).toHaveProperty("stats");
});

test("should return zero counts when no assignments exist", async () => {
  const t = convexTest(schema, modules);

  const [userId, orgId] = await Promise.all([
    t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        name: "Test User",
        email: "test@example.com",
      });
    }),
    t.run(async (ctx) => {
      return await ctx.db.insert("organizations", {
        name: "Test Org",
        slug: "test-org",
        type: "museum",
        settings: { enabledModules: [] },
      });
    }),
  ]);
  const authed = t.withIdentity({
    subject: `${userId}|session-counts`,
    issuer: "https://example.test",
  });

  const counts = await authed.query(api.assignments.getAssignmentCounts, {
    organizationId: orgId,
  });

  expect(counts).toEqual({
    pendingApprovals: 0,
    assignedAccessions: 0,
    urgentItems: 0,
  });
});
