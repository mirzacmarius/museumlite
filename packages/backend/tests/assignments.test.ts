import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import schema from "../convex/schema";

import { modules } from "./testSetup";

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

  const userId = await t.run(async (ctx) => {
    return await ctx.db.insert("users", {
      name: "Test User",
      email: "test@example.com",
    });
  });

  const orgId = await t.run(async (ctx) => {
    return await ctx.db.insert("organizations", {
      name: "Test Org",
      slug: "test-org",
      type: "museum",
      settings: { enabledModules: [] },
    });
  });

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
    },
  });
});

test("should return valid assignment data structure", async () => {
  const t = convexTest(schema, modules);

  const userId = await t.run(async (ctx) => {
    return await ctx.db.insert("users", {
      name: "Test User",
      email: "test@example.com",
    });
  });

  const orgId = await t.run(async (ctx) => {
    return await ctx.db.insert("organizations", {
      name: "Test Org",
      slug: "test-org",
      type: "museum",
      settings: { enabledModules: [] },
    });
  });

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

  const userId = await t.run(async (ctx) => {
    return await ctx.db.insert("users", {
      name: "Test User",
      email: "test@example.com",
    });
  });

  const orgId = await t.run(async (ctx) => {
    return await ctx.db.insert("organizations", {
      name: "Test Org",
      slug: "test-org",
      type: "museum",
      settings: { enabledModules: [] },
    });
  });

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
