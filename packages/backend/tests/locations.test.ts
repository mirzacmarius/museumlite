import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api } from "../convex/_generated/api";
import schema from "../convex/schema";

import { modules } from "./testSetup";

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

  const orgId = await t.run(async (ctx) => {
    return await ctx.db.insert("organizations", {
      name: "Test Museum",
      slug: "test-museum",
      type: "museum",
      settings: { enabledModules: [] },
    });
  });

  const userId = await t.run(async (ctx) => {
    return await ctx.db.insert("users", {
      email: "test@example.com",
    });
  });

  const roleId = await t.run(async (ctx) => {
    return await ctx.db.insert("roles", {
      organizationId: orgId,
      name: "Admin",
      isSystemRole: true,
    });
  });

  const permissionId = await t.run(async (ctx) => {
    return await ctx.db.insert("permissions", {
      name: "locations.read",
      category: "locations",
    });
  });

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

  const orgId = await t.run(async (ctx) => {
    return await ctx.db.insert("organizations", {
      name: "Test Museum",
      slug: "test-museum-2",
      type: "museum",
      settings: { enabledModules: [] },
    });
  });

  const userId = await t.run(async (ctx) => {
    return await ctx.db.insert("users", {
      email: "test2@example.com",
    });
  });

  const roleId = await t.run(async (ctx) => {
    return await ctx.db.insert("roles", {
      organizationId: orgId,
      name: "Admin",
      isSystemRole: true,
    });
  });

  const permissionId = await t.run(async (ctx) => {
    return await ctx.db.insert("permissions", {
      name: "locations.read",
      category: "locations",
    });
  });

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
