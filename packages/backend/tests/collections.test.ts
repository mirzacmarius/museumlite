/**
 * Test file for Collections Publishing Features
 *
 * Tests the public visibility, valuation redaction, and custom slug features.
 *
 * Run with: `bun test` (from packages/backend)
 */

import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "../convex/_generated/api";
import schema from "../convex/schema";

import { modules } from "./testSetup";

describe("collections publishing", () => {
  test("listPublic returns empty when org not found", async () => {
    const t = convexTest(schema, modules);

    const result = await t.query(api.collections.listPublic, {
      organizationSlug: "missing-org",
    });

    expect(result.items).toEqual([]);
    expect(result.hasMore).toBe(false);
  });

  test("listPublic returns empty without public_portal access", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      const organizationId = await ctx.db.insert("organizations", {
        name: "Free Org",
        slug: "free-org",
        type: "museum",
        subscriptionTier: "free",
        settings: { portalSettings: { isEnabled: true, portalSlug: "gallery" } },
      });

      const userId = await ctx.db.insert("users", { email: "u@example.com" });

      await ctx.db.insert("collections", {
        organizationId,
        accessionNumber: "A-1",
        title: "Public Item",
        status: "active",
        isPubliclyVisible: true,
        catalogedBy: userId,
        catalogedAt: Date.now(),
      });
    });

    const result = await t.query(api.collections.listPublic, {
      organizationSlug: "free-org",
    });

    expect(result.items).toEqual([]);
    expect(result.hasMore).toBe(false);
  });

  test("listPublic returns empty when portal is disabled", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      const organizationId = await ctx.db.insert("organizations", {
        name: "Pro Org",
        slug: "pro-org",
        type: "museum",
        subscriptionTier: "pro",
        settings: { portalSettings: { isEnabled: false, portalSlug: "gallery" } },
      });

      const userId = await ctx.db.insert("users", { email: "u2@example.com" });

      await ctx.db.insert("collections", {
        organizationId,
        accessionNumber: "A-2",
        title: "Public Item",
        status: "active",
        isPubliclyVisible: true,
        catalogedBy: userId,
        catalogedAt: Date.now(),
      });
    });

    const result = await t.query(api.collections.listPublic, {
      organizationSlug: "pro-org",
    });

    expect(result.items).toEqual([]);
    expect(result.hasMore).toBe(false);
  });

  test("getPublic returns null when item not publicly visible", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      const organizationId = await ctx.db.insert("organizations", {
        name: "Pro Org 2",
        slug: "pro-org-2",
        type: "museum",
        subscriptionTier: "pro",
        settings: { portalSettings: { isEnabled: true, portalSlug: "gallery" } },
      });

      const userId = await ctx.db.insert("users", { email: "u3@example.com" });

      await ctx.db.insert("collections", {
        organizationId,
        accessionNumber: "A-3",
        title: "Private Item",
        status: "active",
        isPubliclyVisible: false,
        catalogedBy: userId,
        catalogedAt: Date.now(),
      });
    });

    const result = await t.query(api.collections.getPublic, {
      organizationSlug: "pro-org-2",
      accessionNumber: "A-3",
    });

    expect(result).toBeNull();
  });

  test("listPublic urlSlug uses publicSlug when present", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      const organizationId = await ctx.db.insert("organizations", {
        name: "Pro Org 3",
        slug: "pro-org-3",
        type: "museum",
        subscriptionTier: "pro",
        settings: { portalSettings: { isEnabled: true, portalSlug: "gallery" } },
      });

      const userId = await ctx.db.insert("users", { email: "u4@example.com" });

      await ctx.db.insert("collections", {
        organizationId,
        accessionNumber: "A-4",
        publicSlug: "my-public-slug",
        title: "Public Item",
        status: "active",
        isPubliclyVisible: true,
        catalogedBy: userId,
        catalogedAt: Date.now(),
      });
    });

    const result = await t.query(api.collections.listPublic, {
      organizationSlug: "pro-org-3",
    });

    expect(result.items[0]?.urlSlug).toBe("my-public-slug");
  });
});
