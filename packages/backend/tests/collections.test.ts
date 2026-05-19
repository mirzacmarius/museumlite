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
      const [organizationId, userId] = await Promise.all([
        ctx.db.insert("organizations", {
          name: "Free Org",
          slug: "free-org",
          type: "museum",
          subscriptionTier: "free",
          settings: {
            portalSettings: { isEnabled: true, portalSlug: "gallery" },
          },
        }),
        ctx.db.insert("users", { email: "u@example.com" }),
      ]);
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
    expect(result.portalStatus).toBe("upgrade_required");
  });

  test("listPublic returns empty when portal is disabled", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      const [organizationId, userId] = await Promise.all([
        ctx.db.insert("organizations", {
          name: "Pro Org",
          slug: "pro-org",
          type: "museum",
          subscriptionTier: "pro",
          settings: {
            portalSettings: { isEnabled: false, portalSlug: "gallery" },
          },
        }),
        ctx.db.insert("users", { email: "u2@example.com" }),
      ]);
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
      const [organizationId, userId] = await Promise.all([
        ctx.db.insert("organizations", {
          name: "Pro Org 2",
          slug: "pro-org-2",
          type: "museum",
          subscriptionTier: "pro",
          settings: {
            portalSettings: { isEnabled: true, portalSlug: "gallery" },
          },
        }),
        ctx.db.insert("users", { email: "u3@example.com" }),
      ]);
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
      const [organizationId, userId] = await Promise.all([
        ctx.db.insert("organizations", {
          name: "Pro Org 3",
          slug: "pro-org-3",
          type: "museum",
          subscriptionTier: "pro",
          settings: {
            portalSettings: { isEnabled: true, portalSlug: "gallery" },
          },
        }),
        ctx.db.insert("users", { email: "u4@example.com" }),
      ]);
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

  test("public portal includes visible loaned objects", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      const [organizationId, userId] = await Promise.all([
        ctx.db.insert("organizations", {
          name: "Pro Org 4",
          slug: "pro-org-4",
          type: "museum",
          subscriptionTier: "pro",
          settings: {
            portalSettings: { isEnabled: true, portalSlug: "gallery" },
          },
        }),
        ctx.db.insert("users", { email: "u5@example.com" }),
      ]);
      await ctx.db.insert("collections", {
        organizationId,
        accessionNumber: "A-5",
        title: "Loaned Public Item",
        status: "loaned",
        isPubliclyVisible: true,
        catalogedBy: userId,
        catalogedAt: Date.now(),
      });
    });

    const listResult = await t.query(api.collections.listPublic, {
      organizationSlug: "pro-org-4",
    });
    expect(listResult.items.map((item) => item.title)).toEqual([
      "Loaned Public Item",
    ]);

    const detailResult = await t.query(api.collections.getPublic, {
      organizationSlug: "pro-org-4",
      accessionNumber: "A-5",
    });
    expect(detailResult?.title).toBe("Loaned Public Item");
  });

  test("public portal includes published library items", async () => {
    const t = convexTest(schema, modules);

    const [{ itemId }, listResult] = await Promise.all([
      t.run(async (ctx) => {
        const [organizationId, userId] = await Promise.all([
          ctx.db.insert("organizations", {
            name: "Library Org",
            slug: "library-org",
            type: "library",
            subscriptionTier: "pro",
            settings: {
              enabledModules: ["library"],
              portalSettings: { isEnabled: true, portalSlug: "catalog" },
            },
          }),
          ctx.db.insert("users", {
            email: "u6@example.com",
          }),
        ]);
        const itemId = await ctx.db.insert("libraryItems", {
          organizationId,
          itemType: "book",
          title: "Published Library Item",
          authors: ["Test Author"],
          language: "en",
          totalCopies: 1,
          availableCopies: 1,
          catalogStatus: "published",
          isCirculating: true,
          createdBy: userId,
          createdAt: Date.now(),
        });

        await ctx.db.insert("libraryItems", {
          organizationId,
          itemType: "book",
          title: "Draft Library Item",
          authors: ["Hidden Author"],
          language: "en",
          totalCopies: 1,
          availableCopies: 1,
          catalogStatus: "draft",
          isCirculating: true,
          createdBy: userId,
          createdAt: Date.now(),
        });

        return { itemId };
      }),
      t.query(api.collections.listPublic, {
        organizationSlug: "library-org",
      }),
    ]);
    expect(listResult.items.map((item) => item.title)).toEqual([
      "Published Library Item",
    ]);
    expect(listResult.items[0]?.urlSlug).toBe(`library-${itemId}`);

    const detailResult = await t.query(api.collections.getPublic, {
      organizationSlug: "library-org",
      accessionNumber: `library-${itemId}`,
    });
    expect(detailResult?.title).toBe("Published Library Item");
    expect(detailResult?.creator).toBe("Test Author");
  });
});
