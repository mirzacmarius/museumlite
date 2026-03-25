import { convexTest } from "convex-test";
import { expect, test } from "vitest";

import { modules } from "../tests/testSetup";
import { api, internal } from "./_generated/api";
import schema from "./schema";

function buildLocation({
  organizationId,
  name,
  locationCode,
  type,
  sortOrder,
  isActive = true,
  parentLocationId,
}: {
  organizationId: Id<"organizations">;
  name: string;
  locationCode: string;
  type: string;
  sortOrder: number;
  isActive?: boolean;
  parentLocationId?: Id<"locations">;
}) {
  return {
    organizationId,
    name,
    locationCode,
    locationCodeNormalized: locationCode.toLowerCase(),
    type,
    parentLocationId,
    sortOrder,
    isActive,
  };
}

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

async function createOrgUserWithLocationPermissions() {
  const t = convexTest(schema, modules);

  const context = await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", { name: "Location Manager" });
    const organizationId = await ctx.db.insert("organizations", {
      name: "Location Admin Org",
      slug: `location-admin-org-${Math.random().toString(36).slice(2, 8)}`,
      type: "museum",
    });

    const readPermissionId = await ctx.db.insert("permissions", {
      name: "locations.read",
      category: "locations",
      description: "Read locations",
    });
    const createPermissionId = await ctx.db.insert("permissions", {
      name: "locations.create",
      category: "locations",
      description: "Create locations",
    });
    const updatePermissionId = await ctx.db.insert("permissions", {
      name: "locations.update",
      category: "locations",
      description: "Update locations",
    });

    const roleId = await ctx.db.insert("roles", {
      organizationId,
      name: "Location Manager",
      description: "Manages locations",
      isSystemRole: false,
    });

    for (const permissionId of [
      readPermissionId,
      createPermissionId,
      updatePermissionId,
    ]) {
      await ctx.db.insert("rolePermissions", {
        roleId,
        permissionId,
      });
    }

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
      ...buildLocation({
        organizationId,
        name: "Main Storage",
        locationCode: "ST-001",
        type: "storage",
        sortOrder: 0,
      }),
    });
    const childLocationId = await ctx.db.insert("locations", {
      ...buildLocation({
        organizationId,
        name: "Shelf A",
        locationCode: "SH-001",
        type: "shelf",
        parentLocationId,
        sortOrder: 0,
      }),
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
      ...buildLocation({
        organizationId,
        name: "Main Storage",
        locationCode: "ST-001",
        type: "storage",
        sortOrder: 0,
      }),
    });
    const childLocationId = await ctx.db.insert("locations", {
      ...buildLocation({
        organizationId,
        name: "Shelf A",
        locationCode: "SH-001",
        type: "shelf",
        parentLocationId,
        sortOrder: 0,
      }),
    });
    const grandchildLocationId = await ctx.db.insert("locations", {
      ...buildLocation({
        organizationId,
        name: "Box 1",
        locationCode: "BX-001",
        type: "archive box",
        parentLocationId: childLocationId,
        sortOrder: 0,
      }),
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
      ...buildLocation({
        organizationId,
        name: "Main Storage",
        locationCode: "ST-001",
        type: "storage",
        sortOrder: 0,
      }),
    });
    const inactiveChildLocationId = await ctx.db.insert("locations", {
      ...buildLocation({
        organizationId,
        name: "Retired Shelf",
        locationCode: "SH-002",
        type: "shelf",
        parentLocationId,
        sortOrder: 0,
        isActive: false,
      }),
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
      ...buildLocation({
        organizationId,
        name: "Looping Shelf",
        locationCode: "SH-LOOP",
        type: "shelf",
        sortOrder: 0,
      }),
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
      ...buildLocation({
        organizationId,
        name: "Restricted Storage",
        locationCode: "RST-001",
        type: "storage",
        sortOrder: 0,
      }),
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
      ...buildLocation({
        organizationId,
        name: "Sorted Storage",
        locationCode: "SRT-001",
        type: "storage",
        sortOrder: 0,
      }),
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

test("locations.create requires a location ID", async () => {
  const { asUser, organizationId } =
    await createOrgUserWithLocationPermissions();

  await expect(
    asUser.mutation(api.locations.create, {
      organizationId,
      name: "Cabinet A",
      locationCode: "   ",
      type: "cabinet",
    }),
  ).rejects.toThrow("Please enter a location ID");
});

test("locations.create enforces sibling-unique location IDs case-insensitively", async () => {
  const { asUser, organizationId } =
    await createOrgUserWithLocationPermissions();

  const parentLocationId = await asUser.mutation(api.locations.create, {
    organizationId,
    name: "Storage",
    locationCode: "ST-001",
    type: "storage",
  });

  await asUser.mutation(api.locations.create, {
    organizationId,
    name: "Cabinet A",
    locationCode: "A",
    type: "cabinet",
    parentLocationId,
  });

  await expect(
    asUser.mutation(api.locations.create, {
      organizationId,
      name: "Shelf A",
      locationCode: "a",
      type: "shelf",
      parentLocationId,
    }),
  ).rejects.toThrow("Location ID already exists in this parent location");
});

test("locations.create allows the same location ID under different parents", async () => {
  const { asUser, organizationId } =
    await createOrgUserWithLocationPermissions();

  const storageOneId = await asUser.mutation(api.locations.create, {
    organizationId,
    name: "Storage One",
    locationCode: "ST-001",
    type: "storage",
  });
  const storageTwoId = await asUser.mutation(api.locations.create, {
    organizationId,
    name: "Storage Two",
    locationCode: "ST-002",
    type: "storage",
  });

  await asUser.mutation(api.locations.create, {
    organizationId,
    name: "Cabinet A",
    locationCode: "A",
    type: "cabinet",
    parentLocationId: storageOneId,
  });

  await expect(
    asUser.mutation(api.locations.create, {
      organizationId,
      name: "Cabinet B",
      locationCode: "A",
      type: "cabinet",
      parentLocationId: storageTwoId,
    }),
  ).resolves.toBeDefined();
});

test("locations.update blocks changing a location ID to a sibling duplicate", async () => {
  const { asUser, organizationId } =
    await createOrgUserWithLocationPermissions();

  const parentLocationId = await asUser.mutation(api.locations.create, {
    organizationId,
    name: "Storage",
    locationCode: "ST-001",
    type: "storage",
  });

  const cabinetId = await asUser.mutation(api.locations.create, {
    organizationId,
    name: "Cabinet A",
    locationCode: "A",
    type: "cabinet",
    parentLocationId,
  });
  const shelfId = await asUser.mutation(api.locations.create, {
    organizationId,
    name: "Shelf A",
    locationCode: "B",
    type: "shelf",
    parentLocationId,
  });

  await expect(
    asUser.mutation(api.locations.update, {
      locationId: shelfId,
      locationCode: "a",
    }),
  ).rejects.toThrow("Location ID already exists in this parent location");

  const updatedCabinet = await asUser.query(api.locations.get, {
    locationId: cabinetId,
  });
  expect(updatedCabinet?.locationCode).toBe("A");
});

test("location queries include locationCode in returned data", async () => {
  const { asUser, organizationId } =
    await createOrgUserWithLocationPermissions();

  const parentLocationId = await asUser.mutation(api.locations.create, {
    organizationId,
    name: "Storage",
    locationCode: "ST-001",
    type: "storage",
  });
  const childLocationId = await asUser.mutation(api.locations.create, {
    organizationId,
    name: "Shelf A",
    locationCode: "SH-001",
    type: "shelf",
    parentLocationId,
  });

  const location = await asUser.query(api.locations.get, {
    locationId: parentLocationId,
  });
  const allLocations = await asUser.query(api.locations.listAll, {
    organizationId,
  });
  const locationTree = await asUser.query(api.locations.list, {
    organizationId,
    parentLocationId: "root",
  });
  const pathLocations = await asUser.query(api.locations.listAllWithPaths, {
    organizationId,
  });
  const locationPath = await asUser.query(api.locations.getLocationPath, {
    locationId: childLocationId,
  });

  expect(location?.locationCode).toBe("ST-001");
  expect(location?.children[0]?.locationCode).toBe("SH-001");
  expect(
    allLocations.find((entry) => entry._id === childLocationId)?.locationCode,
  ).toBe("SH-001");
  expect(locationTree[0]?.locationCode).toBe("ST-001");
  expect(locationTree[0]?.children?.[0]?.locationCode).toBe("SH-001");
  expect(
    pathLocations.find((entry) => entry._id === childLocationId)?.locationCode,
  ).toBe("SH-001");
  expect(locationPath.map((entry) => entry.locationCode)).toEqual([
    "ST-001",
    "SH-001",
  ]);
});

test("backfillLocationCodes assigns sibling-unique placeholder location IDs", async () => {
  const t = convexTest(schema, modules);

  const organizationId = await t.run(async (ctx) =>
    ctx.db.insert("organizations", {
      name: "Migration Org",
      slug: `migration-org-${Math.random().toString(36).slice(2, 8)}`,
      type: "museum",
    }),
  );

  const parentLocationId = await t.run(async (ctx) =>
    ctx.db.insert("locations", {
      organizationId,
      name: "Storage",
      locationCode: "",
      locationCodeNormalized: "",
      type: "storage",
      sortOrder: 0,
      isActive: true,
    }),
  );

  const [cabinetId, shelfId] = await t.run(async (ctx) =>
    Promise.all([
      ctx.db.insert("locations", {
        organizationId,
        name: "Cabinet A",
        locationCode: "",
        locationCodeNormalized: "",
        type: "cabinet",
        parentLocationId,
        sortOrder: 0,
        isActive: true,
      }),
      ctx.db.insert("locations", {
        organizationId,
        name: "Shelf A",
        locationCode: "",
        locationCodeNormalized: "",
        type: "shelf",
        parentLocationId,
        sortOrder: 1,
        isActive: true,
      }),
    ]),
  );

  await t.mutation(internal.migrations.backfillLocationCodes, {});

  const result = await t.run(async (ctx) =>
    Promise.all([
      ctx.db.get(parentLocationId),
      ctx.db.get(cabinetId),
      ctx.db.get(shelfId),
    ]),
  );

  expect(result[0]?.locationCode).toBe("ST-001");
  expect(result[1]?.locationCode).toBe("C-001");
  expect(result[2]?.locationCode).toBe("SH-002");
  expect(result[1]?.locationCodeNormalized).toBe("c-001");
});
