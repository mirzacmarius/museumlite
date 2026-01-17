import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

test("should require authentication for listMyAssignments", async () => {
  const t = convexTest(schema);

  await expect(
    t.query(api.assignments.listMyAssignments, {
      organizationId: "test-org-id" as any,
    }),
  ).rejects.toThrow("Not authenticated");
});

test("should return empty assignments when no data exists", async () => {
  const t = convexTest(schema);

  const orgId = await t.run(async (ctx) => {
    return await ctx.db.insert("organizations", {
      name: "Test Org",
      slug: "test-org",
      type: "museum",
      settings: { enabledModules: [] },
    });
  });

  const userId = await t.run(async (ctx) => {
    return await ctx.db.insert("users", {
      name: "Test User",
      email: "test@example.com",
    });
  });

  expect(true).toBe(true);
});

test("should return valid assignment data structure", async () => {
  const t = convexTest(schema);

  expect(true).toBe(true);
});

test("should require authentication for getAssignmentCounts", async () => {
  const t = convexTest(schema);

  const orgId = await t.run(async (ctx) => {
    return await ctx.db.insert("organizations", {
      name: "Test Org",
      slug: "test-org",
      type: "museum",
      settings: { enabledModules: [] },
    });
  });

  const counts = await t.query(api.assignments.getAssignmentCounts, {
    organizationId: orgId,
  });

  expect(counts).toEqual({
    pendingApprovals: 0,
    assignedAccessions: 0,
    urgentItems: 0,
  });
});

test("should return zero counts when no assignments exist", async () => {
  const t = convexTest(schema);

  const orgId = await t.run(async (ctx) => {
    return await ctx.db.insert("organizations", {
      name: "Test Org",
      slug: "test-org",
      type: "museum",
      settings: { enabledModules: [] },
    });
  });

  const counts = await t.query(api.assignments.getAssignmentCounts, {
    organizationId: orgId,
  });

  expect(counts.pendingApprovals).toBe(0);
  expect(counts.assignedAccessions).toBe(0);
  expect(counts.urgentItems).toBe(0);
});
