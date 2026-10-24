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
import type { Id } from "../convex/_generated/dataModel";
import schema from "../convex/schema";
import { authedForUser, createOrgUserWithPermissions } from "./testHarness";
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

  test("listPublic returns items when portal is enabled regardless of tier", async () => {
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

    expect(result.items.map((item) => item.title)).toEqual(["Public Item"]);
    expect(result.hasMore).toBe(false);
    expect(result.portalStatus).toBe("ok");
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

type TestContext = Parameters<
  Parameters<ReturnType<typeof convexTest>["run"]>[0]
>[0];

describe("rights statements", () => {
  const inCopyright = "http://rightsstatements.org/vocab/InC/1.0/";
  const cc0 = "https://creativecommons.org/publicdomain/zero/1.0/";
  const ccBy = "https://creativecommons.org/licenses/by/4.0/";
  const publicDomainMark = "https://creativecommons.org/publicdomain/mark/1.0/";

  /** An image of the Object with a ready public rendition. */
  async function insertImage(
    ctx: TestContext,
    fixture: {
      organizationId: Id<"organizations">;
      collectionId: Id<"collections">;
      userId: Id<"users">;
      isPrimary: boolean;
      rightsStatement?: typeof publicDomainMark;
    },
  ) {
    const [storageId, renditionStorageId] = await Promise.all([
      ctx.storage.store(new Blob(["original"], { type: "image/jpeg" })),
      ctx.storage.store(new Blob(["rendition"], { type: "image/jpeg" })),
    ]);
    const { userId, ...media } = fixture;
    return await ctx.db.insert("mediaFiles", {
      ...media,
      storageId,
      fileName: "image.jpg",
      fileType: "image",
      fileSize: 8,
      mimeType: "image/jpeg",
      uploadedBy: userId,
      uploadedAt: 1,
      uploadStatus: "completed",
      rightsStatus: "owned",
      publicRendition: {
        status: "ready",
        sourceStorageId: storageId,
        renditionStorageId,
      },
    });
  }

  test("the portal shows the Object's and each image's statement in effect: its own, otherwise the Organization's default", async () => {
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => {
      const [organizationId, userId] = await Promise.all([
        ctx.db.insert("organizations", {
          name: "Rights Org",
          slug: "rights-org",
          type: "museum",
          settings: {
            portalSettings: { isEnabled: true },
            rightsDefaults: {
              objectRightsStatement: inCopyright,
              mediaRightsStatement: ccBy,
            },
          },
        }),
        ctx.db.insert("users", { email: "rights@example.com" }),
      ]);
      const object = {
        organizationId,
        status: "active" as const,
        isPubliclyVisible: true,
        catalogedBy: userId,
        catalogedAt: 1,
      };
      const collectionId = await ctx.db.insert("collections", {
        ...object,
        accessionNumber: "R-1",
        title: "Harbour at dusk",
        rightsStatement: cc0,
      });
      await ctx.db.insert("collections", {
        ...object,
        accessionNumber: "R-2",
        title: "Pilot boat",
      });
      // A statement never keeps an image off the portal.
      await insertImage(ctx, {
        organizationId,
        collectionId,
        userId,
        isPrimary: true,
        rightsStatement: publicDomainMark,
      });
      await insertImage(ctx, {
        organizationId,
        collectionId,
        userId,
        isPrimary: false,
      });
    });
    const detail = (accessionNumber: string) =>
      t.query(api.collections.getPublic, {
        organizationSlug: "rights-org",
        accessionNumber,
      });

    const harbour = await detail("R-1");
    expect(harbour?.rightsStatement).toBe(cc0);
    expect(harbour?.images.map((image) => image.rightsStatement)).toEqual([
      publicDomainMark,
      ccBy,
    ]);
    expect((await detail("R-2"))?.rightsStatement).toBe(inCopyright);
    const list = await t.query(api.collections.listPublic, {
      organizationSlug: "rights-org",
    });
    const listed = (title: string) =>
      list.items.find((item) => item.title === title);
    expect(listed("Harbour at dusk")).toMatchObject({
      rightsStatement: cc0,
      primaryImageRightsStatement: publicDomainMark,
    });
    expect(listed("Pilot boat")?.rightsStatement).toBe(inCopyright);
    expect(listed("Pilot boat")?.primaryImageRightsStatement).toBeUndefined();

    // Without defaults, a record without its own statement has none.
    await t.run(async (ctx) => {
      const organization = await ctx.db
        .query("organizations")
        .withIndex("by_slug", (q) => q.eq("slug", "rights-org"))
        .unique();
      if (!organization) throw new Error("Expected the Organization");
      await ctx.db.patch(organization._id, {
        settings: { portalSettings: { isEnabled: true } },
      });
    });
    expect((await detail("R-2"))?.rightsStatement).toBeUndefined();
    expect(
      (await detail("R-1"))?.images.map((image) => image.rightsStatement),
    ).toEqual([publicDomainMark, undefined]);
  });

  test("changing only an image's statement keeps its approval and rendition; changing its recorded rights revokes them", async () => {
    const t = convexTest(schema, modules);
    const { organizationId, userId } = await createOrgUserWithPermissions(t, [
      "media.upload",
      "media.read",
      "collections.read",
    ]);
    const mediaId = await t.run(async (ctx) => {
      await ctx.db.patch(organizationId, {
        settings: { rightsDefaults: { mediaRightsStatement: ccBy } },
      });
      const collectionId = await ctx.db.insert("collections", {
        organizationId,
        accessionNumber: "R-3",
        title: "Lighthouse",
        status: "active",
        catalogedBy: userId,
        catalogedAt: 1,
      });
      const mediaId = await insertImage(ctx, {
        organizationId,
        collectionId,
        userId,
        isPrimary: true,
      });
      const media = await ctx.db.get(mediaId);
      if (!media) throw new Error("Expected the image");
      await ctx.db.patch(mediaId, {
        publicApproval: {
          status: "approved",
          requestId: "approval-1",
          sourceStorageId: media.storageId,
          renditionStorageId: await ctx.storage.store(
            new Blob(["approved"], { type: "image/jpeg" }),
          ),
          approvedBy: userId,
          approvedAt: 1,
          allowOriginalDownload: false,
        },
      });
      return mediaId;
    });
    const staff = authedForUser(t, userId);
    const stored = () => t.run((ctx) => ctx.db.get(mediaId));
    const before = await stored();
    expect(
      await staff.query(api.media.getWithMetadata, { mediaId }),
    ).toMatchObject({ rightsStatementInEffect: ccBy });

    await staff.mutation(api.media.updateRights, {
      mediaId,
      rightsStatement: inCopyright,
    });
    const statementOnly = await stored();
    expect(statementOnly?.rightsStatement).toBe(inCopyright);
    expect(statementOnly?.publicApproval).toEqual(before?.publicApproval);
    expect(statementOnly?.publicRendition).toEqual(before?.publicRendition);
    expect(
      await staff.query(api.media.getWithMetadata, { mediaId }),
    ).toMatchObject({
      rightsStatement: inCopyright,
      rightsStatementInEffect: inCopyright,
    });

    await staff.mutation(api.media.updateRights, {
      mediaId,
      rightsStatement: null,
    });
    expect((await stored())?.rightsStatement).toBeUndefined();
    expect((await stored())?.publicApproval).toEqual(before?.publicApproval);

    await staff.mutation(api.media.updateRights, {
      mediaId,
      usageRestrictions: "Ask the photographer first",
    });
    const restricted = await stored();
    expect(restricted?.publicApproval).toBeUndefined();
    expect(restricted?.publicRendition).toBeUndefined();
  });
});
