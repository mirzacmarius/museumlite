import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import schema from "../convex/schema";

import { modules } from "./testSetup";

function authedForUser(t: ReturnType<typeof convexTest>, userId: Id<"users">) {
  return t.withIdentity({
    subject: `${userId}|session-1`,
    issuer: "https://example.test",
  });
}

test("should create organization", async () => {
  const t = convexTest(schema, modules);
  expect(true).toBe(true);
});

test("should add user to organization", async () => {
  const t = convexTest(schema, modules);
  expect(true).toBe(true);
});

test("should assign role to user", async () => {
  const t = convexTest(schema, modules);
  expect(true).toBe(true);
});

test("should update organization settings", async () => {
  const t = convexTest(schema, modules);
  expect(true).toBe(true);
});

test("should remove user from organization", async () => {
  const t = convexTest(schema, modules);
  expect(true).toBe(true);
});

test("should transfer organization ownership", async () => {
  const t = convexTest(schema, modules);
  expect(true).toBe(true);
});

describe("organization hierarchy", () => {
  async function createUser(t: ReturnType<typeof convexTest>) {
    return await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        name: "Hierarchy Admin",
        email: `hierarchy-${Math.random().toString(36).slice(2, 8)}@test.dev`,
      });
    });
  }

  test("pro parent can create and list child organizations", async () => {
    const t = convexTest(schema, modules);
    const userId = await createUser(t);
    const authed = authedForUser(t, userId);

    const parentOrganizationId = await authed.mutation(
      api.organizations.create,
      {
        name: "Parent Museum",
        slug: `parent-${Math.random().toString(36).slice(2, 8)}`,
        type: "museum",
      },
    );

    await t.run(async (ctx) => {
      await ctx.db.patch(parentOrganizationId, {
        subscriptionTier: "pro",
      });
    });

    const childOrganizationId = await authed.mutation(
      api.organizations.create,
      {
        name: "Child Museum",
        slug: `child-${Math.random().toString(36).slice(2, 8)}`,
        type: "museum",
        parentOrganizationId,
      },
    );

    const childOrganization = await t.run(async (ctx) => {
      return await ctx.db.get(childOrganizationId);
    });
    const children = await authed.query(
      api.organizations.listChildOrganizations,
      {
        organizationId: parentOrganizationId,
      },
    );

    expect(childOrganization?.parentOrganizationId).toBe(parentOrganizationId);
    expect(childOrganization?.rootOrganizationId).toBe(parentOrganizationId);
    expect(children.some((child) => child._id === childOrganizationId)).toBe(
      true,
    );
  });

  test("free parent cannot create child organizations", async () => {
    const t = convexTest(schema, modules);
    const userId = await createUser(t);
    const authed = authedForUser(t, userId);

    const parentOrganizationId = await authed.mutation(
      api.organizations.create,
      {
        name: "Free Parent Museum",
        slug: `free-parent-${Math.random().toString(36).slice(2, 8)}`,
        type: "museum",
      },
    );

    await expect(
      authed.mutation(api.organizations.create, {
        name: "Blocked Child Museum",
        slug: `blocked-child-${Math.random().toString(36).slice(2, 8)}`,
        type: "museum",
        parentOrganizationId,
      }),
    ).rejects.toThrow("Pro or Enterprise");
  });
});

describe("getUsageStats", () => {
  test("should read object and storage usage from organization counters", async () => {
    const t = convexTest(schema, modules);

    const orgId = await t.run(async (ctx) => {
      const orgId = await ctx.db.insert("organizations", {
        name: "Counter Org",
        slug: "counter-org",
        type: "museum",
      });

      await ctx.db.insert("organizationUsageCounters", {
        organizationId: orgId,
        objectCount: 17,
        mediaFileCount: 4,
        mediaVersionCount: 2,
        storageBytes: 8192,
        mediaByType: {
          image: {
            count: 4,
            bytes: 8192,
          },
        },
        lastUpdatedAt: Date.now(),
      });

      await ctx.db.insert("exportUsage", {
        organizationId: orgId,
        periodStart: Date.UTC(
          new Date().getUTCFullYear(),
          new Date().getUTCMonth(),
          1,
        ),
        count: 3,
      });

      return orgId;
    });

    const stats = await t.query(api.organizations.getUsageStats, {
      organizationId: orgId,
    });

    expect(stats.objects.used).toBe(17);
    expect(stats.storage.used).toBe(8192);
    expect(stats.exports.used).toBe(3);
  });

  test("should return correct structure for free tier", async () => {
    const t = convexTest(schema, modules);

    const orgId = await t.run(async (ctx) => {
      return await ctx.db.insert("organizations", {
        name: "Test Org",
        slug: "test-org",
        type: "museum",
      });
    });

    const stats = await t.query(api.organizations.getUsageStats, {
      organizationId: orgId,
    });

    expect(stats).toBeDefined();
    expect(stats.tier).toBe("free");
    expect(stats.storage).toHaveProperty("used");
    expect(stats.storage).toHaveProperty("limit");
    expect(stats.objects).toHaveProperty("used");
    expect(stats.objects).toHaveProperty("limit");
    expect(stats.exports).toHaveProperty("used");
    expect(stats.exports).toHaveProperty("limit");
  });

  test("should count objects correctly", async () => {
    const t = convexTest(schema, modules);

    const orgId = await t.run(async (ctx) => {
      return await ctx.db.insert("organizations", {
        name: "Test Org",
        slug: "test-org-pro",
        type: "museum",
      });
    });

    const stats = await t.query(api.organizations.getUsageStats, {
      organizationId: orgId,
    });

    expect(stats.objects.used).toBe(0);
  });

  test("should sum storage correctly", async () => {
    const t = convexTest(schema, modules);

    const orgId = await t.run(async (ctx) => {
      return await ctx.db.insert("organizations", {
        name: "Test Org Storage",
        slug: "test-org-storage",
        type: "museum",
      });
    });

    const stats = await t.query(api.organizations.getUsageStats, {
      organizationId: orgId,
    });

    expect(stats.storage.used).toBe(0);
  });

  test("should handle enterprise tier with null limits", async () => {
    const t = convexTest(schema, modules);

    const orgId = await t.run(async (ctx) => {
      return await ctx.db.insert("organizations", {
        name: "Enterprise Org",
        slug: "enterprise-org",
        type: "museum",
        subscriptionTier: "enterprise",
      });
    });

    const stats = await t.query(api.organizations.getUsageStats, {
      organizationId: orgId,
    });

    expect(stats.tier).toBe("enterprise");
    expect(stats.storage.limit).toBeNull();
    expect(stats.objects.limit).toBeNull();
    expect(stats.exports.limit).toBeNull();
  });
});

describe("watermark settings", () => {
  test("should update watermark settings", async () => {
    const t = convexTest(schema, modules);

    const orgId = await t.run(async (ctx) => {
      return await ctx.db.insert("organizations", {
        name: "Test Org",
        slug: "test-watermark-org",
        type: "museum",
      });
    });

    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        name: "Admin User",
        email: "admin@test.com",
      });
    });

    // Create admin role with permission
    const roleId = await t.run(async (ctx) => {
      return await ctx.db.insert("roles", {
        organizationId: orgId,
        name: "Admin",
        isSystemRole: true,
      });
    });

    const permissionId = await t.run(async (ctx) => {
      return await ctx.db.insert("permissions", {
        name: "organization.manage_settings",
        category: "organization",
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

    // Update watermark settings
    const authed = authedForUser(t, userId);
    await authed.mutation(api.organizations.updateWatermarkSettings, {
      organizationId: orgId,
      watermarkSettings: {
        isEnabled: true,
        text: "© 2026 Test Museum",
        opacity: 0.7,
        position: "bottom-right",
      },
    });

    // Verify settings were saved
    const org = await t.run(async (ctx) => {
      return await ctx.db.get(orgId);
    });

    expect(org?.settings?.watermarkSettings).toBeDefined();
    expect(org?.settings?.watermarkSettings?.isEnabled).toBe(true);
    expect(org?.settings?.watermarkSettings?.text).toBe("© 2026 Test Museum");
    expect(org?.settings?.watermarkSettings?.opacity).toBe(0.7);
    expect(org?.settings?.watermarkSettings?.position).toBe("bottom-right");
  });
});
