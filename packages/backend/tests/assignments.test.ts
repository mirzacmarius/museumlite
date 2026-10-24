import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import schema from "../convex/schema";
import {
  authedForUser,
  createConvexTest,
  createOrgUserWithPermissions,
} from "./testHarness";
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
    stats: { totalCatalogedItems: 0 },
  });
});

test("Cataloged by you lists the viewer's newest objects first, skips objects others cataloged, and lists and counts at most 100", async () => {
  const t = createConvexTest();
  const { organizationId, userId } = await createOrgUserWithPermissions(t, [
    "collections.read",
  ]);
  const catalog = (
    catalogedBy: Id<"users">,
    accessionNumber: string,
    catalogedAt: number,
  ) =>
    t.run((ctx) =>
      ctx.db.insert("collections", {
        organizationId,
        accessionNumber,
        title: accessionNumber,
        status: "active",
        catalogedBy,
        catalogedAt,
      }),
    );
  const colleagueId = await t.run((ctx) =>
    ctx.db.insert("users", {
      name: "Colleague",
      email: "colleague@example.com",
    }),
  );
  for (let index = 0; index < 3; index++) {
    await catalog(userId, `MINE-${index}`, 1_000 + index);
  }
  await catalog(colleagueId, "THEIRS-1", 5_000);
  const viewer = authedForUser(t, userId);

  const few = await viewer.query(api.assignments.listMyAssignments, {
    organizationId,
    limit: 2,
  });
  expect(few.myCatalogedItems.map((item) => item.accessionNumber)).toEqual([
    "MINE-2",
    "MINE-1",
  ]);
  expect(few.stats.totalCatalogedItems).toBe(3);

  for (let index = 3; index < 120; index++) {
    await catalog(userId, `MINE-${index}`, 1_000 + index);
  }
  const many = await viewer.query(api.assignments.listMyAssignments, {
    organizationId,
  });
  expect(many.myCatalogedItems).toHaveLength(10);
  expect(many.myCatalogedItems[0]?.accessionNumber).toBe("MINE-119");
  expect(many.stats.totalCatalogedItems).toBe(100);

  const asked = await viewer.query(api.assignments.listMyAssignments, {
    organizationId,
    limit: 500,
  });
  expect(asked.myCatalogedItems).toHaveLength(100);
});
