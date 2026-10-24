import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api } from "../convex/_generated/api";
import schema from "../convex/schema";
import { createOrgUserWithPermissions } from "./testHarness";
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

  const { organizationId: orgId, userId } = await createOrgUserWithPermissions(
    t,
    ["collections.read"],
  );
  const authed = t.withIdentity({
    subject: `${userId}|session-empty-assignments`,
    issuer: "https://example.test",
  });

  const result = await authed.query(api.assignments.listMyAssignments, {
    organizationId: orgId,
  });

  expect(result).toEqual({
    myCatalogedItems: [],
    recentlyModified: [],
    stats: {
      itemsModifiedThisWeek: 0,
      totalCatalogedItems: 0,
    },
  });
});
