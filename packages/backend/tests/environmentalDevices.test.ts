import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "../convex/_generated/api";
import schema from "../convex/schema";
import { modules } from "./testSetup";

async function setup(t: ReturnType<typeof convexTest>) {
  const ids = await t.run(async (ctx) => {
    const organizationId = await ctx.db.insert("organizations", {
      name: "Environmental Test Museum",
      slug: `environmental-test-${Math.random().toString(36).slice(2, 8)}`,
      type: "museum",
    });
    const userId = await ctx.db.insert("users", {
      name: "Environmental Admin",
      email: `environmental-${Math.random().toString(36).slice(2, 8)}@example.com`,
    });
    const permissionId = await ctx.db.insert("permissions", {
      name: "organization.manage_settings",
      category: "organization",
    });
    const roleId = await ctx.db.insert("roles", {
      organizationId,
      name: "Admin",
      isSystemRole: true,
    });
    await ctx.db.insert("rolePermissions", { roleId, permissionId });
    await ctx.db.insert("userOrganizations", {
      userId,
      organizationId,
      roleId,
      joinedAt: Date.now(),
    });
    const locationId = await ctx.db.insert("locations", {
      organizationId,
      name: "Gallery A",
      type: "gallery",
      sortOrder: 0,
      isActive: true,
    });
    return { organizationId, userId, locationId };
  });
  return {
    ...ids,
    admin: t.withIdentity({
      subject: `${ids.userId}|session`,
      issuer: "https://example.test",
    }),
  };
}

describe("environmental device management", () => {
  test("registers a scoped device and shows its credential only once", async () => {
    const t = convexTest(schema, modules);
    const { organizationId, admin } = await setup(t);

    const created = await admin.mutation(api.environmentalDevices.register, {
      organizationId,
      name: "East gallery logger",
    });
    const devices = await admin.query(api.environmentalDevices.list, {
      organizationId,
    });

    expect(created.token).toMatch(/^env_[A-Za-z0-9]{43}$/);
    expect(devices).toHaveLength(1);
    expect(devices[0]?.name).toBe("East gallery logger");
    expect(devices[0]?.token).toBeUndefined();
    expect(JSON.stringify(devices)).not.toContain(created.token);
  });

  test("binds a probe only to a location in the same organization", async () => {
    const t = convexTest(schema, modules);
    const { organizationId, locationId, admin } = await setup(t);
    const created = await admin.mutation(api.environmentalDevices.register, {
      organizationId,
      name: "Logger",
    });

    await admin.mutation(api.environmentalDevices.bindProbe, {
      organizationId,
      deviceId: created.deviceId,
      probeId: "probe-1",
      locationId,
    });

    const devices = await admin.query(api.environmentalDevices.list, {
      organizationId,
    });
    expect(devices[0]?.probes).toEqual([
      expect.objectContaining({ probeId: "probe-1", locationId }),
    ]);
  });

  test("rejects binding a probe to another organization's location", async () => {
    const t = convexTest(schema, modules);
    const { organizationId, admin } = await setup(t);
    const created = await admin.mutation(api.environmentalDevices.register, {
      organizationId,
      name: "Logger",
    });
    const foreignLocationId = await t.run(async (ctx) => {
      const foreignOrganizationId = await ctx.db.insert("organizations", {
        name: "Foreign Museum",
        slug: `foreign-${Math.random().toString(36).slice(2, 8)}`,
        type: "museum",
      });
      return await ctx.db.insert("locations", {
        organizationId: foreignOrganizationId,
        name: "Foreign Store",
        type: "storage",
        sortOrder: 0,
        isActive: true,
      });
    });

    await expect(
      admin.mutation(api.environmentalDevices.bindProbe, {
        organizationId,
        deviceId: created.deviceId,
        probeId: "probe-1",
        locationId: foreignLocationId,
      }),
    ).rejects.toThrow("Device, probe, or location is invalid");
    const devices = await admin.query(api.environmentalDevices.list, {
      organizationId,
    });
    expect(devices[0]?.probes).toHaveLength(0);
  });

  test("rejects binding probes to inactive locations", async () => {
    const t = convexTest(schema, modules);
    const { organizationId, locationId, admin } = await setup(t);
    const created = await admin.mutation(api.environmentalDevices.register, {
      organizationId,
      name: "Logger",
    });
    await t.run((ctx) => ctx.db.patch(locationId, { isActive: false }));

    await expect(
      admin.mutation(api.environmentalDevices.bindProbe, {
        organizationId,
        deviceId: created.deviceId,
        probeId: "probe-1",
        locationId,
      }),
    ).rejects.toThrow("Device, probe, or location is invalid");
    expect(
      (await admin.query(api.environmentalDevices.list, { organizationId }))[0]
        ?.probes,
    ).toHaveLength(0);
  });

  test("rotation replaces the credential and revoke disables it", async () => {
    const t = convexTest(schema, modules);
    const { organizationId, admin } = await setup(t);
    const created = await admin.mutation(api.environmentalDevices.register, {
      organizationId,
      name: "Logger",
    });

    const rotated = await admin.mutation(api.environmentalDevices.rotate, {
      organizationId,
      deviceId: created.deviceId,
    });
    await admin.mutation(api.environmentalDevices.revoke, {
      organizationId,
      deviceId: created.deviceId,
    });

    expect(rotated.token).not.toBe(created.token);
    expect(rotated.token).toMatch(/^env_[A-Za-z0-9]{43}$/);
    const devices = await admin.query(api.environmentalDevices.list, {
      organizationId,
    });
    expect(devices[0]?.status).toBe("revoked");
    expect(devices[0]?.token).toBeUndefined();
  });

  test("rejects management without organization settings permission", async () => {
    const t = convexTest(schema, modules);
    const { organizationId } = await setup(t);
    const limitedUserId = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        name: "Read Only User",
        email: `limited-${Math.random().toString(36).slice(2, 8)}@example.com`,
      });
      const roleId = await ctx.db.insert("roles", {
        organizationId,
        name: "Read Only",
        isSystemRole: false,
      });
      await ctx.db.insert("userOrganizations", {
        userId,
        organizationId,
        roleId,
        joinedAt: Date.now(),
      });
      return userId;
    });
    const limitedUser = t.withIdentity({
      subject: `${limitedUserId}|limited-session`,
      issuer: "https://example.test",
    });

    await expect(
      limitedUser.mutation(api.environmentalDevices.register, {
        organizationId,
        name: "Logger",
      }),
    ).rejects.toThrow();
    await expect(
      limitedUser.query(api.environmentalDevices.list, { organizationId }),
    ).rejects.toThrow();
  });
});
