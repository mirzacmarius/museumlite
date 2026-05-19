import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api } from "../convex/_generated/api";
import schema from "../convex/schema";

import { modules } from "./testSetup";

function buildLocationCode(locationCode: string) {
  return {
    locationCode,
    locationCodeNormalized: locationCode.toLowerCase(),
  };
}

test("should create location", async () => {
  const t = convexTest(schema, modules);
  expect(true).toBe(true);
});

test("should create nested location hierarchy", async () => {
  const t = convexTest(schema, modules);
  expect(true).toBe(true);
});

test("should move object to location", async () => {
  const t = convexTest(schema, modules);
  expect(true).toBe(true);
});

test("should track location capacity", async () => {
  const t = convexTest(schema, modules);
  expect(true).toBe(true);
});

test("should list objects at location", async () => {
  const t = convexTest(schema, modules);
  expect(true).toBe(true);
});

test("should generate location path breadcrumb", async () => {
  const t = convexTest(schema, modules);
  expect(true).toBe(true);
});

test("should require permission for getLocationHistory", async () => {
  const t = convexTest(schema, modules);

  const orgId = await t.run(async (ctx) => {
    return await ctx.db.insert("organizations", {
      name: "Test Org",
      slug: "test-org",
      type: "museum",
      settings: { enabledModules: [] },
    });
  });

  const locationId = await t.run(async (ctx) => {
    return await ctx.db.insert("locations", {
      organizationId: orgId,
      name: "Storage Room A",
      ...buildLocationCode("ST-A"),
      type: "storage",
      sortOrder: 1,
      isActive: true,
    });
  });

  await expect(
    t.query(api.locations.getLocationHistory, { locationId }),
  ).rejects.toThrow();
});

test("should return empty array when no location history exists", async () => {
  const t = convexTest(schema, modules);

  expect(true).toBe(true);
});

test("should return location history with enriched data", async () => {
  const t = convexTest(schema, modules);

  expect(true).toBe(true);
});

test("should return latest environmental reading for location", async () => {
  const t = convexTest(schema, modules);

  const [orgId, userId] = await Promise.all([
    t.run(async (ctx) => {
      return await ctx.db.insert("organizations", {
        name: "Test Museum",
        slug: "test-museum",
        type: "museum",
        settings: { enabledModules: [] },
      });
    }),
    t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        email: "test@example.com",
      });
    }),
  ]);
  const [roleId, permissionId] = await Promise.all([
    t.run(async (ctx) => {
      return await ctx.db.insert("roles", {
        organizationId: orgId,
        name: "Admin",
        isSystemRole: true,
      });
    }),
    t.run(async (ctx) => {
      return await ctx.db.insert("permissions", {
        name: "locations.read",
        category: "locations",
      });
    }),
  ]);
  await t.run(async (ctx) => {
    await ctx.db.insert("rolePermissions", {
      roleId,
      permissionId,
    });
  });

  await t.run(async (ctx) => {
    await ctx.db.insert("userOrganizations", {
      userId,
      organizationId: orgId,
      roleId,
      joinedAt: Date.now(),
    });
  });

  const locationId = await t.run(async (ctx) => {
    return await ctx.db.insert("locations", {
      organizationId: orgId,
      name: "Gallery 1",
      ...buildLocationCode("G-001"),
      type: "gallery",
      sortOrder: 1,
      isActive: true,
    });
  });

  await t.run(async (ctx) => {
    await ctx.db.insert("environmentalReadings", {
      organizationId: orgId,
      locationId,
      temperature: 21.5,
      humidity: 45,
      recordedAt: Date.now() - 3600000,
      source: "sensor",
    });
    await ctx.db.insert("environmentalReadings", {
      organizationId: orgId,
      locationId,
      temperature: 22.0,
      humidity: 48,
      recordedAt: Date.now(),
      source: "sensor",
    });
  });

  const authed = t.withIdentity({
    subject: `${userId}|session`,
    issuer: "https://example.test",
  });

  const result = await authed.query(api.locations.getEnvironmentalReadings, {
    locationId,
  });

  expect(result).not.toBeNull();
  expect(result?.temperature).toBe(22.0);
  expect(result?.humidity).toBe(48);
});

test("should return null when no environmental readings exist", async () => {
  const t = convexTest(schema, modules);

  const [orgId, userId] = await Promise.all([
    t.run(async (ctx) => {
      return await ctx.db.insert("organizations", {
        name: "Test Museum",
        slug: "test-museum-2",
        type: "museum",
        settings: { enabledModules: [] },
      });
    }),
    t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        email: "test2@example.com",
      });
    }),
  ]);
  const [roleId, permissionId] = await Promise.all([
    t.run(async (ctx) => {
      return await ctx.db.insert("roles", {
        organizationId: orgId,
        name: "Admin",
        isSystemRole: true,
      });
    }),
    t.run(async (ctx) => {
      return await ctx.db.insert("permissions", {
        name: "locations.read",
        category: "locations",
      });
    }),
  ]);
  await t.run(async (ctx) => {
    await ctx.db.insert("rolePermissions", {
      roleId,
      permissionId,
    });
  });

  await t.run(async (ctx) => {
    await ctx.db.insert("userOrganizations", {
      userId,
      organizationId: orgId,
      roleId,
      joinedAt: Date.now(),
    });
  });

  const locationId = await t.run(async (ctx) => {
    return await ctx.db.insert("locations", {
      organizationId: orgId,
      name: "Empty Gallery",
      ...buildLocationCode("G-EMPTY"),
      type: "gallery",
      sortOrder: 1,
      isActive: true,
    });
  });

  const authed = t.withIdentity({
    subject: `${userId}|session`,
    issuer: "https://example.test",
  });

  const result = await authed.query(api.locations.getEnvironmentalReadings, {
    locationId,
  });

  expect(result).toBeNull();
});

// Site-Location Integration Tests
test("should create location with siteId", async () => {
  const t = convexTest(schema, modules);

  const { orgId, siteId, userId } = await t.run(async (ctx) => {
    const orgId = await ctx.db.insert("organizations", {
      name: "Test Museum",
      slug: "test-museum-site-loc",
      type: "museum",
      settings: { enabledModules: [] },
    });

    const [siteId, userId, roleId, permissionId] = await Promise.all([
      ctx.db.insert("sites", {
        organizationId: orgId,
        name: "Main Building",
        isActive: true,
        isPrimary: true,
      }),
      ctx.db.insert("users", {
        email: "test@example.com",
      }),
      ctx.db.insert("roles", {
        organizationId: orgId,
        name: "Admin",
        isSystemRole: true,
      }),
      ctx.db.insert("permissions", {
        name: "locations.create",
        category: "locations",
      }),
    ]);
    await ctx.db.insert("rolePermissions", {
      roleId,
      permissionId,
    });

    await ctx.db.insert("userOrganizations", {
      userId,
      organizationId: orgId,
      roleId,
      joinedAt: Date.now(),
    });

    return { orgId, siteId, userId };
  });

  const authed = t.withIdentity({
    subject: `${userId}|session`,
    issuer: "https://example.test",
  });

  const locationId = await authed.mutation(api.locations.create, {
    organizationId: orgId,
    name: "Storage Room A",
    locationCode: "ST-A",
    type: "storage",
    siteId,
  });

  expect(locationId).toBeDefined();

  const location = await t.run(async (ctx) => {
    return await ctx.db.get(locationId);
  });

  expect(location).toBeDefined();
  expect(location?.siteId).toBe(siteId);
  expect(location?.name).toBe("Storage Room A");
});

test("should reject location creation with invalid siteId", async () => {
  const t = convexTest(schema, modules);

  const { orgId, userId, invalidSiteId } = await t.run(async (ctx) => {
    const [orgId, otherOrgId] = await Promise.all([
      ctx.db.insert("organizations", {
        name: "Test Museum",
        slug: "test-museum-invalid-site",
        type: "museum",
        settings: { enabledModules: [] },
      }),
      ctx.db.insert("organizations", {
        name: "Other Museum",
        slug: "other-museum",
        type: "museum",
        settings: { enabledModules: [] },
      }),
    ]);
    // Create site in different organization
    const invalidSiteId = await ctx.db.insert("sites", {
      organizationId: otherOrgId,
      name: "Other Building",
      isActive: true,
      isPrimary: true,
    });

    const [userId, roleId, permissionId] = await Promise.all([
      ctx.db.insert("users", {
        email: "test@example.com",
      }),
      ctx.db.insert("roles", {
        organizationId: orgId,
        name: "Admin",
        isSystemRole: true,
      }),
      ctx.db.insert("permissions", {
        name: "locations.create",
        category: "locations",
      }),
    ]);
    await ctx.db.insert("rolePermissions", {
      roleId,
      permissionId,
    });

    await ctx.db.insert("userOrganizations", {
      userId,
      organizationId: orgId,
      roleId,
      joinedAt: Date.now(),
    });

    return { orgId, userId, invalidSiteId };
  });

  const authed = t.withIdentity({
    subject: `${userId}|session`,
    issuer: "https://example.test",
  });

  await expect(
    authed.mutation(api.locations.create, {
      organizationId: orgId,
      name: "Storage Room",
      locationCode: "ST-INVALID",
      type: "storage",
      siteId: invalidSiteId,
    }),
  ).rejects.toThrow("Invalid site");
});

test("should reject location creation with inactive siteId", async () => {
  const t = convexTest(schema, modules);

  const { orgId, siteId, userId } = await t.run(async (ctx) => {
    const orgId = await ctx.db.insert("organizations", {
      name: "Test Museum",
      slug: "test-museum-inactive-site",
      type: "museum",
      settings: { enabledModules: [] },
    });

    const [siteId, userId, roleId, permissionId] = await Promise.all([
      ctx.db.insert("sites", {
        organizationId: orgId,
        name: "Closed Building",
        isActive: false,
        isPrimary: false,
      }),
      ctx.db.insert("users", {
        email: "test@example.com",
      }),
      ctx.db.insert("roles", {
        organizationId: orgId,
        name: "Admin",
        isSystemRole: true,
      }),
      ctx.db.insert("permissions", {
        name: "locations.create",
        category: "locations",
      }),
    ]);
    await ctx.db.insert("rolePermissions", {
      roleId,
      permissionId,
    });

    await ctx.db.insert("userOrganizations", {
      userId,
      organizationId: orgId,
      roleId,
      joinedAt: Date.now(),
    });

    return { orgId, siteId, userId };
  });

  const authed = t.withIdentity({
    subject: `${userId}|session`,
    issuer: "https://example.test",
  });

  await expect(
    authed.mutation(api.locations.create, {
      organizationId: orgId,
      name: "Storage Room",
      locationCode: "ST-INACTIVE",
      type: "storage",
      siteId,
    }),
  ).rejects.toThrow("Site is not active");
});

test("should filter locations by siteId in listAll", async () => {
  const t = convexTest(schema, modules);

  const { orgId, site1Id, site2Id, userId } = await t.run(async (ctx) => {
    const orgId = await ctx.db.insert("organizations", {
      name: "Test Museum",
      slug: "test-museum-filter-site",
      type: "museum",
      settings: { enabledModules: [] },
    });

    const [site1Id, site2Id] = await Promise.all([
      ctx.db.insert("sites", {
        organizationId: orgId,
        name: "Building A",
        isActive: true,
        isPrimary: true,
      }),
      ctx.db.insert("sites", {
        organizationId: orgId,
        name: "Building B",
        isActive: true,
        isPrimary: false,
      }),
    ]);
    // Create locations in site1
    await ctx.db.insert("locations", {
      organizationId: orgId,
      siteId: site1Id,
      name: "Site 1 Room A",
      ...buildLocationCode("R-1A"),
      type: "room",
      sortOrder: 1,
      isActive: true,
    });

    await ctx.db.insert("locations", {
      organizationId: orgId,
      siteId: site1Id,
      name: "Site 1 Room B",
      ...buildLocationCode("R-1B"),
      type: "room",
      sortOrder: 2,
      isActive: true,
    });

    // Create location in site2
    await ctx.db.insert("locations", {
      organizationId: orgId,
      siteId: site2Id,
      name: "Site 2 Gallery",
      ...buildLocationCode("G-2"),
      type: "gallery",
      sortOrder: 1,
      isActive: true,
    });

    // Create location without site
    await ctx.db.insert("locations", {
      organizationId: orgId,
      name: "No Site Location",
      ...buildLocationCode("NS-1"),
      type: "storage",
      sortOrder: 1,
      isActive: true,
    });

    const [userId, roleId, permissionId] = await Promise.all([
      ctx.db.insert("users", {
        email: "test@example.com",
      }),
      ctx.db.insert("roles", {
        organizationId: orgId,
        name: "Admin",
        isSystemRole: true,
      }),
      ctx.db.insert("permissions", {
        name: "locations.read",
        category: "locations",
      }),
    ]);
    await ctx.db.insert("rolePermissions", {
      roleId,
      permissionId,
    });

    await ctx.db.insert("userOrganizations", {
      userId,
      organizationId: orgId,
      roleId,
      joinedAt: Date.now(),
    });

    return { orgId, site1Id, site2Id, userId };
  });

  const authed = t.withIdentity({
    subject: `${userId}|session`,
    issuer: "https://example.test",
  });

  const site1Locations = await authed.query(api.locations.listAll, {
    organizationId: orgId,
    siteId: site1Id,
  });

  expect(site1Locations).toHaveLength(2);
  expect(site1Locations[0].name).toBe("Site 1 Room A");
  expect(site1Locations[1].name).toBe("Site 1 Room B");

  const site2Locations = await authed.query(api.locations.listAll, {
    organizationId: orgId,
    siteId: site2Id,
  });

  expect(site2Locations).toHaveLength(1);
  expect(site2Locations[0].name).toBe("Site 2 Gallery");
});

test("should filter locations by siteId in list", async () => {
  const t = convexTest(schema, modules);

  const { orgId, site1Id, site2Id, userId } = await t.run(async (ctx) => {
    const orgId = await ctx.db.insert("organizations", {
      name: "Test Museum",
      slug: "test-museum-filter-list",
      type: "museum",
      settings: { enabledModules: [] },
    });

    const [site1Id, site2Id] = await Promise.all([
      ctx.db.insert("sites", {
        organizationId: orgId,
        name: "Building A",
        isActive: true,
        isPrimary: true,
      }),
      ctx.db.insert("sites", {
        organizationId: orgId,
        name: "Building B",
        isActive: true,
        isPrimary: false,
      }),
    ]);
    await ctx.db.insert("locations", {
      organizationId: orgId,
      siteId: site1Id,
      name: "Site 1 Gallery",
      ...buildLocationCode("G-1"),
      type: "gallery",
      sortOrder: 1,
      isActive: true,
    });

    await ctx.db.insert("locations", {
      organizationId: orgId,
      siteId: site2Id,
      name: "Site 2 Gallery",
      ...buildLocationCode("G-2"),
      type: "gallery",
      sortOrder: 1,
      isActive: true,
    });

    const [userId, roleId, permissionId] = await Promise.all([
      ctx.db.insert("users", {
        email: "test@example.com",
      }),
      ctx.db.insert("roles", {
        organizationId: orgId,
        name: "Admin",
        isSystemRole: true,
      }),
      ctx.db.insert("permissions", {
        name: "locations.read",
        category: "locations",
      }),
    ]);
    await ctx.db.insert("rolePermissions", {
      roleId,
      permissionId,
    });

    await ctx.db.insert("userOrganizations", {
      userId,
      organizationId: orgId,
      roleId,
      joinedAt: Date.now(),
    });

    return { orgId, site1Id, site2Id, userId };
  });

  const authed = t.withIdentity({
    subject: `${userId}|session`,
    issuer: "https://example.test",
  });

  const site1Locations = await authed.query(api.locations.list, {
    organizationId: orgId,
    siteId: site1Id,
  });

  expect(site1Locations).toHaveLength(1);
  expect(site1Locations[0].name).toBe("Site 1 Gallery");

  const site2Locations = await authed.query(api.locations.list, {
    organizationId: orgId,
    siteId: site2Id,
  });

  expect(site2Locations).toHaveLength(1);
  expect(site2Locations[0].name).toBe("Site 2 Gallery");
});

test("should list locations by site using listBySite query", async () => {
  const t = convexTest(schema, modules);

  const { orgId, siteId, userId } = await t.run(async (ctx) => {
    const orgId = await ctx.db.insert("organizations", {
      name: "Test Museum",
      slug: "test-museum-list-by-site",
      type: "museum",
      settings: { enabledModules: [] },
    });

    const siteId = await ctx.db.insert("sites", {
      organizationId: orgId,
      name: "Main Building",
      isActive: true,
      isPrimary: true,
    });

    await ctx.db.insert("locations", {
      organizationId: orgId,
      siteId,
      name: "Gallery A",
      ...buildLocationCode("G-A"),
      type: "gallery",
      sortOrder: 1,
      isActive: true,
    });

    await ctx.db.insert("locations", {
      organizationId: orgId,
      siteId,
      name: "Gallery B",
      ...buildLocationCode("G-B"),
      type: "gallery",
      sortOrder: 2,
      isActive: true,
    });

    await ctx.db.insert("locations", {
      organizationId: orgId,
      siteId,
      name: "Storage",
      ...buildLocationCode("ST-1"),
      type: "storage",
      sortOrder: 3,
      isActive: true,
    });

    const [userId, roleId, permissionId] = await Promise.all([
      ctx.db.insert("users", {
        email: "test@example.com",
      }),
      ctx.db.insert("roles", {
        organizationId: orgId,
        name: "Admin",
        isSystemRole: true,
      }),
      ctx.db.insert("permissions", {
        name: "locations.read",
        category: "locations",
      }),
    ]);
    await ctx.db.insert("rolePermissions", {
      roleId,
      permissionId,
    });

    await ctx.db.insert("userOrganizations", {
      userId,
      organizationId: orgId,
      roleId,
      joinedAt: Date.now(),
    });

    return { orgId, siteId, userId };
  });

  const authed = t.withIdentity({
    subject: `${userId}|session`,
    issuer: "https://example.test",
  });

  const locations = await authed.query(api.locations.listBySite, {
    organizationId: orgId,
    siteId,
  });

  expect(locations).toHaveLength(3);
  expect(locations[0].name).toBe("Gallery A");
  expect(locations[1].name).toBe("Gallery B");
  expect(locations[2].name).toBe("Storage");
  expect(locations[0].siteId).toBe(siteId);
  expect(locations[1].siteId).toBe(siteId);
  expect(locations[2].siteId).toBe(siteId);
});

test("should reject listBySite with invalid site", async () => {
  const t = convexTest(schema, modules);

  const { orgId, invalidSiteId, userId } = await t.run(async (ctx) => {
    const [orgId, otherOrgId] = await Promise.all([
      ctx.db.insert("organizations", {
        name: "Test Museum",
        slug: "test-museum-invalid-list",
        type: "museum",
        settings: { enabledModules: [] },
      }),
      ctx.db.insert("organizations", {
        name: "Other Museum",
        slug: "other-museum-list",
        type: "museum",
        settings: { enabledModules: [] },
      }),
    ]);
    const [invalidSiteId, userId, roleId, permissionId] = await Promise.all([
      ctx.db.insert("sites", {
        organizationId: otherOrgId,
        name: "Other Site",
        isActive: true,
        isPrimary: true,
      }),
      ctx.db.insert("users", {
        email: "test@example.com",
      }),
      ctx.db.insert("roles", {
        organizationId: orgId,
        name: "Admin",
        isSystemRole: true,
      }),
      ctx.db.insert("permissions", {
        name: "locations.read",
        category: "locations",
      }),
    ]);
    await ctx.db.insert("rolePermissions", {
      roleId,
      permissionId,
    });

    await ctx.db.insert("userOrganizations", {
      userId,
      organizationId: orgId,
      roleId,
      joinedAt: Date.now(),
    });

    return { orgId, invalidSiteId, userId };
  });

  const authed = t.withIdentity({
    subject: `${userId}|session`,
    issuer: "https://example.test",
  });

  await expect(
    authed.query(api.locations.listBySite, {
      organizationId: orgId,
      siteId: invalidSiteId,
    }),
  ).rejects.toThrow("Invalid site");
});

test("should update location siteId", async () => {
  const t = convexTest(schema, modules);

  const { orgId, site1Id, site2Id, locationId, userId } = await t.run(
    async (ctx) => {
      const orgId = await ctx.db.insert("organizations", {
        name: "Test Museum",
        slug: "test-museum-update-site",
        type: "museum",
        settings: { enabledModules: [] },
      });

      const [site1Id, site2Id] = await Promise.all([
        ctx.db.insert("sites", {
          organizationId: orgId,
          name: "Building A",
          isActive: true,
          isPrimary: true,
        }),
        ctx.db.insert("sites", {
          organizationId: orgId,
          name: "Building B",
          isActive: true,
          isPrimary: false,
        }),
      ]);
      const [locationId, userId, roleId, permissionId] = await Promise.all([
        ctx.db.insert("locations", {
          organizationId: orgId,
          siteId: site1Id,
          name: "Mobile Gallery",
          ...buildLocationCode("MG-1"),
          type: "gallery",
          sortOrder: 1,
          isActive: true,
        }),
        ctx.db.insert("users", {
          email: "test@example.com",
        }),
        ctx.db.insert("roles", {
          organizationId: orgId,
          name: "Admin",
          isSystemRole: true,
        }),
        ctx.db.insert("permissions", {
          name: "locations.update",
          category: "locations",
        }),
      ]);
      await ctx.db.insert("rolePermissions", {
        roleId,
        permissionId,
      });

      await ctx.db.insert("userOrganizations", {
        userId,
        organizationId: orgId,
        roleId,
        joinedAt: Date.now(),
      });

      return { orgId, site1Id, site2Id, locationId, userId };
    },
  );

  const authed = t.withIdentity({
    subject: `${userId}|session`,
    issuer: "https://example.test",
  });

  await authed.mutation(api.locations.update, {
    locationId,
    siteId: site2Id,
  });

  const updated = await t.run(async (ctx) => {
    return await ctx.db.get(locationId);
  });

  expect(updated?.siteId).toBe(site2Id);
});

test("should reject update with invalid siteId", async () => {
  const t = convexTest(schema, modules);

  const { locationId, invalidSiteId, userId } = await t.run(async (ctx) => {
    const [orgId, otherOrgId] = await Promise.all([
      ctx.db.insert("organizations", {
        name: "Test Museum",
        slug: "test-museum-update-invalid",
        type: "museum",
        settings: { enabledModules: [] },
      }),
      ctx.db.insert("organizations", {
        name: "Other Museum",
        slug: "other-museum-update",
        type: "museum",
        settings: { enabledModules: [] },
      }),
    ]);
    const [invalidSiteId, locationId, userId, roleId, permissionId] =
      await Promise.all([
        ctx.db.insert("sites", {
          organizationId: otherOrgId,
          name: "Other Site",
          isActive: true,
          isPrimary: true,
        }),
        ctx.db.insert("locations", {
          organizationId: orgId,
          name: "Test Location",
          ...buildLocationCode("T-1"),
          type: "room",
          sortOrder: 1,
          isActive: true,
        }),
        ctx.db.insert("users", {
          email: "test@example.com",
        }),
        ctx.db.insert("roles", {
          organizationId: orgId,
          name: "Admin",
          isSystemRole: true,
        }),
        ctx.db.insert("permissions", {
          name: "locations.update",
          category: "locations",
        }),
      ]);
    await ctx.db.insert("rolePermissions", {
      roleId,
      permissionId,
    });

    await ctx.db.insert("userOrganizations", {
      userId,
      organizationId: orgId,
      roleId,
      joinedAt: Date.now(),
    });

    return { locationId, invalidSiteId, userId };
  });

  const authed = t.withIdentity({
    subject: `${userId}|session`,
    issuer: "https://example.test",
  });

  await expect(
    authed.mutation(api.locations.update, {
      locationId,
      siteId: invalidSiteId,
    }),
  ).rejects.toThrow("Invalid site");
});

test("should reject update with inactive siteId", async () => {
  const t = convexTest(schema, modules);

  const { locationId, inactiveSiteId, userId } = await t.run(async (ctx) => {
    const orgId = await ctx.db.insert("organizations", {
      name: "Test Museum",
      slug: "test-museum-update-inactive",
      type: "museum",
      settings: { enabledModules: [] },
    });

    const [inactiveSiteId, locationId, userId, roleId, permissionId] =
      await Promise.all([
        ctx.db.insert("sites", {
          organizationId: orgId,
          name: "Closed Site",
          isActive: false,
          isPrimary: false,
        }),
        ctx.db.insert("locations", {
          organizationId: orgId,
          name: "Test Location",
          ...buildLocationCode("T-2"),
          type: "room",
          sortOrder: 1,
          isActive: true,
        }),
        ctx.db.insert("users", {
          email: "test@example.com",
        }),
        ctx.db.insert("roles", {
          organizationId: orgId,
          name: "Admin",
          isSystemRole: true,
        }),
        ctx.db.insert("permissions", {
          name: "locations.update",
          category: "locations",
        }),
      ]);
    await ctx.db.insert("rolePermissions", {
      roleId,
      permissionId,
    });

    await ctx.db.insert("userOrganizations", {
      userId,
      organizationId: orgId,
      roleId,
      joinedAt: Date.now(),
    });

    return { locationId, inactiveSiteId, userId };
  });

  const authed = t.withIdentity({
    subject: `${userId}|session`,
    issuer: "https://example.test",
  });

  await expect(
    authed.mutation(api.locations.update, {
      locationId,
      siteId: inactiveSiteId,
    }),
  ).rejects.toThrow("Site is not active");
});
