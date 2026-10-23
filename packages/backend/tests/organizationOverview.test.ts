import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api } from "../convex/_generated/api";
import schema from "../convex/schema";
import { rebuildProjection } from "./testHarness";
import { modules } from "./testSetup";

// MUS-834: the All my organizations page lists every membership with the
// Dashboard's headline counts, shown only where the member may see analytics.
test("lists each organization the user belongs to, with counts only where they may view analytics", async () => {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", {
      name: "Curator",
      email: "overview@test.dev",
    });
    const [museumId, galleryId, otherId, analyticsId] = await Promise.all([
      ctx.db.insert("organizations", {
        name: "Sandbekk Museum",
        slug: "sandbekk",
        type: "museum",
        subscriptionTier: "pro",
      }),
      ctx.db.insert("organizations", {
        name: "Alna Gallery",
        slug: "alna",
        type: "gallery",
      }),
      ctx.db.insert("organizations", {
        name: "Not a member",
        slug: "elsewhere",
        type: "museum",
      }),
      ctx.db.insert("permissions", {
        name: "organization.view_analytics",
        category: "organization",
      }),
    ]);
    const [managerRoleId, viewerRoleId] = await Promise.all([
      ctx.db.insert("roles", {
        organizationId: museumId,
        name: "Registrar",
        isSystemRole: false,
      }),
      ctx.db.insert("roles", {
        organizationId: galleryId,
        name: "Volunteer",
        isSystemRole: false,
      }),
    ]);
    await Promise.all([
      ctx.db.insert("rolePermissions", {
        roleId: managerRoleId,
        permissionId: analyticsId,
      }),
      ctx.db.insert("userOrganizations", {
        userId,
        organizationId: museumId,
        roleId: managerRoleId,
        joinedAt: Date.UTC(2026, 0, 5),
      }),
      ctx.db.insert("userOrganizations", {
        userId,
        organizationId: galleryId,
        roleId: viewerRoleId,
        joinedAt: Date.UTC(2026, 3, 1),
      }),
      ctx.db.insert("collections", {
        organizationId: museumId,
        accessionNumber: "SM-1",
        title: "Vase",
        status: "active",
        catalogedBy: userId,
        catalogedAt: 1,
      }),
      ctx.db.insert("collections", {
        organizationId: otherId,
        accessionNumber: "X-1",
        title: "Someone else's",
        status: "active",
        catalogedBy: userId,
        catalogedAt: 1,
      }),
    ]);
    return { userId, museumId, galleryId };
  });
  const asUser = t.withIdentity({ subject: ids.userId });

  expect(
    (await asUser.query(api.organizationOverview.listMine, {})).map(
      (organization) => organization.metrics,
    ),
  ).toEqual([null, { availability: "unavailable" }]);

  await rebuildProjection(t, ids.museumId);

  expect(await asUser.query(api.organizationOverview.listMine, {})).toEqual([
    {
      _id: ids.galleryId,
      name: "Alna Gallery",
      type: "gallery",
      subscriptionTier: "free",
      roleName: "Volunteer",
      joinedAt: Date.UTC(2026, 3, 1),
      metrics: null,
    },
    {
      _id: ids.museumId,
      name: "Sandbekk Museum",
      type: "museum",
      subscriptionTier: "pro",
      roleName: "Registrar",
      joinedAt: Date.UTC(2026, 0, 5),
      metrics: {
        availability: "ready",
        objects: 1,
        activeLoans: 0,
        locations: 0,
      },
    },
  ]);
  expect(await t.query(api.organizationOverview.listMine, {})).toEqual([]);
});
