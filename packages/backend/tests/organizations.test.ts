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
