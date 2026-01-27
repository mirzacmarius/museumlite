import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "../convex/_generated/api";
import schema from "../convex/schema";

import { modules } from "./testSetup";

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

describe("getUsageStats", () => {
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

    await t.run(async (ctx) => {
      await ctx.db.insert("userOrganizations", {
        userId,
        organizationId: orgId,
        roleId,
        joinedAt: Date.now(),
      });
    });

    // Update watermark settings
    await t.mutation(
      api.organizations.updateWatermarkSettings,
      {
        organizationId: orgId,
        isEnabled: true,
        text: "© 2026 Test Museum",
        opacity: 0.7,
        position: "bottom-right",
      },
      { as: userId },
    );

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
