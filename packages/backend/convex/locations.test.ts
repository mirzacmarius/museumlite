import { convexTest } from "convex-test";
import { expect, test } from "vitest";

import { modules } from "../tests/testSetup";
import { api } from "./_generated/api";
import schema from "./schema";

async function createOrgUserWithLocationsReadPermission() {
  const t = convexTest(schema, modules);

  const context = await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", { name: "Location Reader" });
    const organizationId = await ctx.db.insert("organizations", {
      name: "Location Test Org",
      slug: `location-test-org-${Math.random().toString(36).slice(2, 8)}`,
      type: "museum",
    });

    const locationsReadPermissionId = await ctx.db.insert("permissions", {
      name: "locations.read",
      category: "locations",
      description: "Read locations",
    });
    const roleId = await ctx.db.insert("roles", {
      organizationId,
      name: "Location Reader",
      description: "Reads locations",
      isSystemRole: false,
    });

    await ctx.db.insert("rolePermissions", {
      roleId,
      permissionId: locationsReadPermissionId,
    });
    await ctx.db.insert("userOrganizations", {
      userId,
      organizationId,
      roleId,
      joinedAt: Date.now(),
    });

    return { organizationId, userId };
  });

  return {
    t,
    asUser: t.withIdentity({ subject: context.userId }),
    ...context,
  };
}

test("locations.getObjectsAtLocation direct mode returns only direct objects", async () => {
  const { t, asUser, organizationId, userId } =
    await createOrgUserWithLocationsReadPermission();

  const { parentLocationId } = await t.run(async (ctx) => {
    const parentLocationId = await ctx.db.insert("locations", {
      organizationId,
      name: "Main Storage",
      type: "storage",
      sortOrder: 0,
      isActive: true,
    });
    const childLocationId = await ctx.db.insert("locations", {
      organizationId,
      name: "Shelf A",
      type: "shelf",
      parentLocationId,
      sortOrder: 0,
      isActive: true,
    });

    await ctx.db.insert("collections", {
      organizationId,
      accessionNumber: "B-100",
      title: "Parent Object",
      currentLocationId: parentLocationId,
      status: "active",
      catalogedBy: userId,
      catalogedAt: Date.now(),
    });
    await ctx.db.insert("collections", {
      organizationId,
      accessionNumber: "A-001",
      title: "Child Object",
      currentLocationId: childLocationId,
      status: "active",
      catalogedBy: userId,
      catalogedAt: Date.now(),
    });

    return { parentLocationId };
  });

  const result = await asUser.query(api.locations.getObjectsAtLocation, {
    locationId: parentLocationId,
  });

  expect(result.map((object) => object.accessionNumber)).toEqual(["B-100"]);
});

test("locations.getObjectsAtLocation descendant mode includes child and grandchild objects", async () => {
  const { t, asUser, organizationId, userId } =
    await createOrgUserWithLocationsReadPermission();

  const { parentLocationId } = await t.run(async (ctx) => {
    const parentLocationId = await ctx.db.insert("locations", {
      organizationId,
      name: "Main Storage",
      type: "storage",
      sortOrder: 0,
      isActive: true,
    });
    const childLocationId = await ctx.db.insert("locations", {
      organizationId,
      name: "Shelf A",
      type: "shelf",
      parentLocationId,
      sortOrder: 0,
      isActive: true,
    });
    const grandchildLocationId = await ctx.db.insert("locations", {
      organizationId,
      name: "Box 1",
      type: "archive box",
      parentLocationId: childLocationId,
      sortOrder: 0,
      isActive: true,
    });

    await ctx.db.insert("collections", {
      organizationId,
      accessionNumber: "S-010",
      title: "Root Object",
      currentLocationId: parentLocationId,
      status: "active",
      catalogedBy: userId,
      catalogedAt: Date.now(),
    });
    await ctx.db.insert("collections", {
      organizationId,
      accessionNumber: "S-020",
      title: "Child Object",
      currentLocationId: childLocationId,
      status: "active",
      catalogedBy: userId,
      catalogedAt: Date.now(),
    });
    await ctx.db.insert("collections", {
      organizationId,
      accessionNumber: "S-030",
      title: "Grandchild Object",
      currentLocationId: grandchildLocationId,
      status: "active",
      catalogedBy: userId,
      catalogedAt: Date.now(),
    });

    return { parentLocationId };
  });

  const result = await asUser.query(api.locations.getObjectsAtLocation, {
    locationId: parentLocationId,
    includeDescendants: true,
  });

  expect(result.map((object) => object.accessionNumber)).toEqual([
    "S-010",
    "S-020",
    "S-030",
  ]);
});

test("locations.getObjectsAtLocation descendant mode excludes inactive descendants", async () => {
  const { t, asUser, organizationId, userId } =
    await createOrgUserWithLocationsReadPermission();

  const { parentLocationId } = await t.run(async (ctx) => {
    const parentLocationId = await ctx.db.insert("locations", {
      organizationId,
      name: "Main Storage",
      type: "storage",
      sortOrder: 0,
      isActive: true,
    });
    const inactiveChildLocationId = await ctx.db.insert("locations", {
      organizationId,
      name: "Retired Shelf",
      type: "shelf",
      parentLocationId,
      sortOrder: 0,
      isActive: false,
    });

    await ctx.db.insert("collections", {
      organizationId,
      accessionNumber: "S-100",
      title: "Active Object",
      currentLocationId: parentLocationId,
      status: "active",
      catalogedBy: userId,
      catalogedAt: Date.now(),
    });
    await ctx.db.insert("collections", {
      organizationId,
      accessionNumber: "S-200",
      title: "Inactive Child Object",
      currentLocationId: inactiveChildLocationId,
      status: "active",
      catalogedBy: userId,
      catalogedAt: Date.now(),
    });

    return { parentLocationId };
  });

  const result = await asUser.query(api.locations.getObjectsAtLocation, {
    locationId: parentLocationId,
    includeDescendants: true,
  });

  expect(result.map((object) => object.accessionNumber)).toEqual(["S-100"]);
});

test("locations.getObjectsAtLocation descendant mode deduplicates repeated traversal paths", async () => {
  const { t, asUser, organizationId, userId } =
    await createOrgUserWithLocationsReadPermission();

  const selfReferencingLocationId = await t.run(async (ctx) => {
    const locationId = await ctx.db.insert("locations", {
      organizationId,
      name: "Looping Shelf",
      type: "shelf",
      sortOrder: 0,
      isActive: true,
    });

    await ctx.db.patch(locationId, {
      parentLocationId: locationId,
    });

    return locationId;
  });

  await t.run(async (ctx) => {
    await ctx.db.insert("collections", {
      organizationId,
      accessionNumber: "LOOP-1",
      title: "Looped Object",
      currentLocationId: selfReferencingLocationId,
      status: "active",
      catalogedBy: userId,
      catalogedAt: Date.now(),
    });
  });

  const result = await asUser.query(api.locations.getObjectsAtLocation, {
    locationId: selfReferencingLocationId,
    includeDescendants: true,
  });

  expect(result).toHaveLength(1);
  expect(result[0]?.accessionNumber).toBe("LOOP-1");
});

test("locations.getObjectsAtLocation requires locations.read permission in descendant mode", async () => {
  const t = convexTest(schema, modules);

  const { locationId, unauthorizedUserId } = await t.run(async (ctx) => {
    const ownerId = await ctx.db.insert("users", { name: "Owner" });
    const unauthorizedUserId = await ctx.db.insert("users", {
      name: "Unauthorized",
    });
    const organizationId = await ctx.db.insert("organizations", {
      name: "Restricted Org",
      slug: `restricted-org-${Math.random().toString(36).slice(2, 8)}`,
      type: "museum",
    });
    const roleId = await ctx.db.insert("roles", {
      organizationId,
      name: "No Access",
      description: "No permissions",
      isSystemRole: false,
    });

    await ctx.db.insert("userOrganizations", {
      userId: unauthorizedUserId,
      organizationId,
      roleId,
      joinedAt: Date.now(),
    });

    const locationId = await ctx.db.insert("locations", {
      organizationId,
      name: "Restricted Storage",
      type: "storage",
      sortOrder: 0,
      isActive: true,
    });

    await ctx.db.insert("collections", {
      organizationId,
      accessionNumber: "R-001",
      title: "Restricted Object",
      currentLocationId: locationId,
      status: "active",
      catalogedBy: ownerId,
      catalogedAt: Date.now(),
    });

    return { locationId, unauthorizedUserId };
  });

  const asUnauthorizedUser = t.withIdentity({ subject: unauthorizedUserId });

  await expect(
    asUnauthorizedUser.query(api.locations.getObjectsAtLocation, {
      locationId,
      includeDescendants: true,
    }),
  ).rejects.toThrow("Permission denied: locations.read");
});

test("locations.getObjectsAtLocation sorts by accession number and title", async () => {
  const { t, asUser, organizationId, userId } =
    await createOrgUserWithLocationsReadPermission();

  const locationId = await t.run(async (ctx) =>
    ctx.db.insert("locations", {
      organizationId,
      name: "Sorted Storage",
      type: "storage",
      sortOrder: 0,
      isActive: true,
    }),
  );

  await t.run(async (ctx) => {
    await ctx.db.insert("collections", {
      organizationId,
      accessionNumber: "A-010",
      title: "Zulu",
      currentLocationId: locationId,
      status: "active",
      catalogedBy: userId,
      catalogedAt: Date.now(),
    });
    await ctx.db.insert("collections", {
      organizationId,
      accessionNumber: "A-002",
      title: "Bravo",
      currentLocationId: locationId,
      status: "active",
      catalogedBy: userId,
      catalogedAt: Date.now(),
    });
    await ctx.db.insert("collections", {
      organizationId,
      accessionNumber: "A-010",
      title: "Alpha",
      currentLocationId: locationId,
      status: "active",
      catalogedBy: userId,
      catalogedAt: Date.now(),
    });
  });

  const result = await asUser.query(api.locations.getObjectsAtLocation, {
    locationId,
    includeDescendants: true,
  });

  expect(
    result.map((object) => `${object.accessionNumber}:${object.title}`),
  ).toEqual(["A-002:Bravo", "A-010:Alpha", "A-010:Zulu"]);
});
