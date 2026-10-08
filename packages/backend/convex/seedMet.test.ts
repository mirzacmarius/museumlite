import type { TestConvex } from "convex-test";
import { convexTest } from "convex-test";
import { expect, test } from "vitest";

import { modules } from "../tests/testSetup";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";

function buildLocationCode(locationCode: string) {
  return {
    locationCode,
    locationCodeNormalized: locationCode.toLowerCase(),
  };
}

async function createOrganizationMembership(
  t: TestConvex<typeof schema>,
  userId: Id<"users">,
  name: string,
) {
  return await t.run(async (ctx) => {
    const organizationId = await ctx.db.insert("organizations", {
      name,
      slug: `${name.toLowerCase().replace(/\s+/g, "-")}-${Date.now()}`,
      type: "museum",
    });
    const roleId = await ctx.db.insert("roles", {
      organizationId,
      name: `${name} Admin`,
      isSystemRole: false,
    });

    await ctx.db.insert("userOrganizations", {
      userId,
      organizationId,
      roleId,
      joinedAt: Date.now(),
    });

    return organizationId;
  });
}

test("seedMet.getUserOrganizationsByEmail resolves the user's organizations", async () => {
  const t = convexTest(schema, modules);

  const userId = await t.run(async (ctx) => {
    return await ctx.db.insert("users", {
      email: "mirzacmarius@gmail.com",
      name: "Mirza",
    });
  });

  const [organizationA, organizationB, result] = await Promise.all([
    createOrganizationMembership(t, userId, "Org A"),
    createOrganizationMembership(t, userId, "Org B"),
    t.run(async (ctx) => {
      return await ctx.runQuery(internal.seedMet.getUserOrganizationsByEmail, {
        email: "mirzacmarius@gmail.com",
      });
    }),
  ]);
  expect(result).toEqual({
    userId,
    organizationIds: [organizationA, organizationB],
  });
});

test("seedMet.getEligibleDeepLocations prefers shelf and vitrine leaves", async () => {
  const t = convexTest(schema, modules);

  const { organizationId } = await t.run(async (ctx) => {
    const [userId, organizationId] = await Promise.all([
      ctx.db.insert("users", {
        email: "locations@example.com",
        name: "Location Tester",
      }),
      ctx.db.insert("organizations", {
        name: "Deep Locations Org",
        slug: "deep-locations-org",
        type: "museum",
      }),
    ]);
    const roleId = await ctx.db.insert("roles", {
      organizationId,
      name: "Admin",
      isSystemRole: false,
    });

    await ctx.db.insert("userOrganizations", {
      userId,
      organizationId,
      roleId,
      joinedAt: Date.now(),
    });

    const roomId = await ctx.db.insert("locations", {
      organizationId,
      name: "Gallery Room",
      ...buildLocationCode("R-001"),
      type: "room",
      sortOrder: 0,
      isActive: true,
    });
    await ctx.db.insert("locations", {
      organizationId,
      name: "Shelf A",
      ...buildLocationCode("SH-001"),
      type: "shelf",
      parentLocationId: roomId,
      sortOrder: 0,
      isActive: true,
      capacity: 2,
    });
    await ctx.db.insert("locations", {
      organizationId,
      name: "Vitrine 1",
      ...buildLocationCode("V-001"),
      type: "vitrine",
      parentLocationId: roomId,
      sortOrder: 1,
      isActive: true,
      capacity: 2,
    });
    await ctx.db.insert("locations", {
      organizationId,
      name: "Cabinet Fallback",
      ...buildLocationCode("C-001"),
      type: "cabinet",
      parentLocationId: roomId,
      sortOrder: 2,
      isActive: true,
      capacity: 5,
    });
    const parentShelfId = await ctx.db.insert("locations", {
      organizationId,
      name: "Parent Shelf",
      ...buildLocationCode("SH-002"),
      type: "shelf",
      parentLocationId: roomId,
      sortOrder: 3,
      isActive: true,
      capacity: 2,
    });
    await ctx.db.insert("locations", {
      organizationId,
      name: "Inner Box",
      ...buildLocationCode("B-001"),
      type: "box",
      parentLocationId: parentShelfId,
      sortOrder: 0,
      isActive: true,
      capacity: 1,
    });
    await ctx.db.insert("locations", {
      organizationId,
      name: "Restricted Shelf",
      ...buildLocationCode("SH-003"),
      type: "shelf",
      parentLocationId: roomId,
      sortOrder: 4,
      isActive: true,
      status: "restricted",
      capacity: 1,
    });

    return { organizationId };
  });

  const result = await t.run(async (ctx) => {
    return await ctx.runQuery(internal.seedMet.getEligibleDeepLocations, {
      organizationId,
    });
  });

  expect(
    result.map((location) => ({
      name: location.name,
      type: location.type,
      path: location.path,
    })),
  ).toEqual([
    {
      name: "Shelf A",
      type: "shelf",
      path: ["Gallery Room", "Shelf A"],
    },
    {
      name: "Vitrine 1",
      type: "vitrine",
      path: ["Gallery Room", "Vitrine 1"],
    },
  ]);
});

test("seedMet.getMovableCollectionsForOrganization excludes loaned and deaccessioned objects", async () => {
  const t = convexTest(schema, modules);

  const { organizationId, userId } = await t.run(async (ctx) => {
    const [userId, organizationId] = await Promise.all([
      ctx.db.insert("users", {
        email: "collections@example.com",
        name: "Collection Tester",
      }),
      ctx.db.insert("organizations", {
        name: "Movable Collections Org",
        slug: "movable-collections-org",
        type: "museum",
      }),
    ]);
    await ctx.db.insert("collections", {
      organizationId,
      accessionNumber: "A-002",
      title: "Bravo",
      status: "active",
      catalogedBy: userId,
      catalogedAt: Date.now(),
    });
    await ctx.db.insert("collections", {
      organizationId,
      accessionNumber: "A-001",
      title: "Alpha",
      status: "archived",
      catalogedBy: userId,
      catalogedAt: Date.now(),
    });
    await ctx.db.insert("collections", {
      organizationId,
      accessionNumber: "A-003",
      title: "Loaned",
      status: "loaned",
      catalogedBy: userId,
      catalogedAt: Date.now(),
    });
    await ctx.db.insert("collections", {
      organizationId,
      accessionNumber: "A-004",
      title: "Deaccessioned",
      status: "deaccessioned",
      catalogedBy: userId,
      catalogedAt: Date.now(),
    });

    return { organizationId, userId };
  });

  const result = await t.run(async (ctx) => {
    return await ctx.runQuery(
      internal.seedMet.getMovableCollectionsForOrganization,
      {
        organizationId,
      },
    );
  });

  expect(result.map((collection) => collection.accessionNumber)).toEqual([
    "A-001",
    "A-002",
  ]);
  expect(result.map((collection) => collection.status)).toEqual([
    "archived",
    "active",
  ]);

  expect(userId).toBeDefined();
});

test("seedMet.reassignObjectsToDeepLocationsForUser reassigns deterministically and respects capacity", async () => {
  const t = convexTest(schema, modules);

  const setup = await t.run(async (ctx) => {
    const [userId, preferredOrganizationId] = await Promise.all([
      ctx.db.insert("users", {
        email: "mirzacmarius@gmail.com",
        name: "Mirza",
      }),
      ctx.db.insert("organizations", {
        name: "Preferred Leaves Org",
        slug: "preferred-leaves-org",
        type: "museum",
      }),
    ]);
    const preferredRoleId = await ctx.db.insert("roles", {
      organizationId: preferredOrganizationId,
      name: "Admin",
      isSystemRole: false,
    });
    await ctx.db.insert("userOrganizations", {
      userId,
      organizationId: preferredOrganizationId,
      roleId: preferredRoleId,
      joinedAt: Date.now(),
    });

    const roomId = await ctx.db.insert("locations", {
      organizationId: preferredOrganizationId,
      name: "Main Room",
      ...buildLocationCode("R-010"),
      type: "room",
      sortOrder: 0,
      isActive: true,
    });
    const [shelfId, vitrineId, cabinetId] = await Promise.all([
      ctx.db.insert("locations", {
        organizationId: preferredOrganizationId,
        name: "Shelf A",
        ...buildLocationCode("SH-010"),
        type: "shelf",
        parentLocationId: roomId,
        sortOrder: 0,
        isActive: true,
        capacity: 1,
      }),
      ctx.db.insert("locations", {
        organizationId: preferredOrganizationId,
        name: "Vitrine 1",
        ...buildLocationCode("V-010"),
        type: "vitrine",
        parentLocationId: roomId,
        sortOrder: 1,
        isActive: true,
        capacity: 1,
      }),
      ctx.db.insert("locations", {
        organizationId: preferredOrganizationId,
        name: "Cabinet Fallback",
        ...buildLocationCode("C-010"),
        type: "cabinet",
        parentLocationId: roomId,
        sortOrder: 2,
        isActive: true,
        capacity: 5,
      }),
    ]);
    const [
      unchangedCollectionId,
      movedCollectionId,
      skippedCollectionId,
      loanedCollectionId,
      noLocationOrganizationId,
    ] = await Promise.all([
      ctx.db.insert("collections", {
        organizationId: preferredOrganizationId,
        accessionNumber: "A-001",
        title: "Already on Shelf",
        currentLocationId: shelfId,
        status: "active",
        catalogedBy: userId,
        catalogedAt: Date.now(),
      }),
      ctx.db.insert("collections", {
        organizationId: preferredOrganizationId,
        accessionNumber: "A-002",
        title: "Move to Vitrine",
        currentLocationId: roomId,
        status: "active",
        catalogedBy: userId,
        catalogedAt: Date.now(),
      }),
      ctx.db.insert("collections", {
        organizationId: preferredOrganizationId,
        accessionNumber: "A-003",
        title: "Skip for Capacity",
        currentLocationId: cabinetId,
        status: "active",
        catalogedBy: userId,
        catalogedAt: Date.now(),
      }),
      ctx.db.insert("collections", {
        organizationId: preferredOrganizationId,
        accessionNumber: "A-004",
        title: "Loaned Object",
        currentLocationId: roomId,
        status: "loaned",
        catalogedBy: userId,
        catalogedAt: Date.now(),
      }),
      ctx.db.insert("organizations", {
        name: "No Deep Locations Org",
        slug: "no-deep-locations-org",
        type: "museum",
      }),
    ]);
    const noLocationRoleId = await ctx.db.insert("roles", {
      organizationId: noLocationOrganizationId,
      name: "Admin",
      isSystemRole: false,
    });
    await ctx.db.insert("userOrganizations", {
      userId,
      organizationId: noLocationOrganizationId,
      roleId: noLocationRoleId,
      joinedAt: Date.now(),
    });

    const skippedNoLocationCollectionId = await ctx.db.insert("collections", {
      organizationId: noLocationOrganizationId,
      accessionNumber: "B-001",
      title: "No Deep Leaf Available",
      status: "active",
      catalogedBy: userId,
      catalogedAt: Date.now(),
    });

    return {
      userId,
      preferredOrganizationId,
      noLocationOrganizationId,
      unchangedCollectionId,
      movedCollectionId,
      skippedCollectionId,
      loanedCollectionId,
      skippedNoLocationCollectionId,
      shelfId,
      vitrineId,
      cabinetId,
      roomId,
    };
  });

  const result = await t.run(async (ctx) => {
    return await ctx.runMutation(
      internal.seedMet.reassignObjectsToDeepLocationsForUser,
      {
        userId: setup.userId,
        organizationIds: [
          setup.preferredOrganizationId,
          setup.noLocationOrganizationId,
        ],
      },
    );
  });

  expect(result).toMatchObject({
    userId: setup.userId,
    organizationCount: 2,
    organizationsProcessed: 2,
    objectsConsidered: 4,
    objectsReassigned: 1,
    objectsUnchanged: 1,
    objectsSkippedNoEligibleLocation: 1,
    objectsSkippedNoCapacity: 1,
    organizationsSkippedNoLocations: 1,
  });

  expect(result.organizations).toEqual([
    {
      organizationId: setup.preferredOrganizationId,
      organizationName: "Preferred Leaves Org",
      targetLocationCount: 2,
      objectCount: 3,
      reassigned: 1,
      unchanged: 1,
      skippedNoCapacity: 1,
      skippedNoEligibleLocation: 0,
    },
    {
      organizationId: setup.noLocationOrganizationId,
      organizationName: "No Deep Locations Org",
      targetLocationCount: 0,
      objectCount: 1,
      reassigned: 0,
      unchanged: 0,
      skippedNoCapacity: 0,
      skippedNoEligibleLocation: 1,
    },
  ]);

  const verification = await t.run(async (ctx) => {
    const [
      unchangedCollection,
      movedCollection,
      skippedCollection,
      loanedCollection,
      skippedNoLocationCollection,
      historyEntries,
    ] = await Promise.all([
      ctx.db.get(setup.unchangedCollectionId),
      ctx.db.get(setup.movedCollectionId),
      ctx.db.get(setup.skippedCollectionId),
      ctx.db.get(setup.loanedCollectionId),
      ctx.db.get(setup.skippedNoLocationCollectionId),
      ctx.db
        .query("locationHistory")
        .withIndex("by_collection", (q) =>
          q.eq("collectionId", setup.movedCollectionId),
        )
        .collect(),
    ]);
    return {
      unchangedCollection,
      movedCollection,
      skippedCollection,
      loanedCollection,
      skippedNoLocationCollection,
      historyEntries,
    };
  });

  expect(verification.unchangedCollection?.currentLocationId).toBe(
    setup.shelfId,
  );
  expect(verification.movedCollection?.currentLocationId).toBe(setup.vitrineId);
  expect(verification.skippedCollection?.currentLocationId).toBe(
    setup.cabinetId,
  );
  expect(verification.loanedCollection?.currentLocationId).toBe(setup.roomId);
  expect(
    verification.skippedNoLocationCollection?.currentLocationId,
  ).toBeUndefined();
  expect(verification.historyEntries).toHaveLength(1);
  expect(verification.historyEntries[0]).toMatchObject({
    fromLocationId: setup.roomId,
    toLocationId: setup.vitrineId,
    movedBy: setup.userId,
    reason: "Deep location reassignment (maintenance)",
    notes:
      "Assigned to deepest eligible leaf location for seeded maintenance user",
  });
});
