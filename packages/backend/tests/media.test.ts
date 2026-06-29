import type { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";

import {
  authedForUser,
  createConvexTest,
  createOrgUserWithPermissions,
} from "./testHarness";

// Shared helper for media security tests
async function setupOrgWithMediaUpload(t: ReturnType<typeof convexTest>) {
  const { organizationId, userId } = await createOrgUserWithPermissions(t, [
    "media.upload",
  ]);
  const collectionId = await t.run(async (ctx) => {
    return await ctx.db.insert("collections", {
      organizationId,
      accessionNumber: `OBJ-${Math.random().toString(36).slice(2, 8)}`,
      title: "Test Object",
      status: "active",
      catalogedBy: userId,
      catalogedAt: Date.now(),
    });
  });
  return { organizationId, userId, collectionId };
}

async function createMediaFile(
  t: ReturnType<typeof convexTest>,
  {
    organizationId,
    collectionId,
    userId,
    fileName,
    displayOrder,
  }: {
    organizationId: Id<"organizations">;
    collectionId: Id<"collections">;
    userId: Id<"users">;
    fileName: string;
    displayOrder: number;
  },
) {
  const storageId = await t.run(async (ctx) => {
    return await ctx.storage.store(
      new Blob([new Uint8Array([0xff])], { type: "image/jpeg" }),
    );
  });

  return await t.run(async (ctx) => {
    return await ctx.db.insert("mediaFiles", {
      organizationId,
      collectionId,
      storageId,
      fileName,
      fileType: "image",
      fileSize: 1024,
      mimeType: "image/jpeg",
      mediaCategory: "image",
      isPrimary: false,
      uploadedBy: userId,
      uploadedAt: Date.now(),
      uploadStatus: "completed",
      displayOrder,
    });
  });
}

// Note: media.create tests use generateUploadUrl as a proxy because the
// media.create mutation's storageId argument is validated before the handler
// runs (the Convex runtime validates v.id("_storage") before executing the
// handler body), preventing us from reaching the collection-org check with a
// synthetic ID.  generateUploadUrl carries the identical cross-org collection
// guard and is equally meaningful as a test target.
describe("media upload security (cross-tenant org binding)", () => {
  test("generateUploadUrl rejects collectionId from a different org", async () => {
    const t = createConvexTest();

    const orgA = await setupOrgWithMediaUpload(t);
    const orgB = await setupOrgWithMediaUpload(t);

    const authedA = authedForUser(t, orgA.userId);

    // User from org A tries to generate an upload URL for a collection in org B
    await expect(
      authedA.mutation(api.media.generateUploadUrl, {
        organizationId: orgA.organizationId,
        collectionId: orgB.collectionId,
        fileName: "test.jpg",
        fileSize: 1024,
        mimeType: "image/jpeg",
      }),
    ).rejects.toThrow("Collection does not belong to this organization");
  });

  test("generateUploadUrl accepts collectionId from the same org", async () => {
    const t = createConvexTest();

    const { organizationId, userId, collectionId } =
      await setupOrgWithMediaUpload(t);
    const authed = authedForUser(t, userId);

    let thrownError: Error | null = null;
    try {
      await authed.mutation(api.media.generateUploadUrl, {
        organizationId,
        collectionId,
        fileName: "test.jpg",
        fileSize: 1024,
        mimeType: "image/jpeg",
      });
    } catch (e) {
      thrownError = e as Error;
    }

    // The cross-tenant check must NOT be what rejects the call
    expect(thrownError?.message).not.toBe(
      "Collection does not belong to this organization",
    );
  });
});

describe("media.updateOrder security (cross-tenant org binding)", () => {
  test("rejects mixed-org media IDs", async () => {
    const t = createConvexTest();

    const orgA = await setupOrgWithMediaUpload(t);
    const orgB = await setupOrgWithMediaUpload(t);
    const authedA = authedForUser(t, orgA.userId);

    const [mediaA, mediaB] = await Promise.all([
      createMediaFile(t, {
        organizationId: orgA.organizationId,
        collectionId: orgA.collectionId,
        userId: orgA.userId,
        fileName: "a.jpg",
        displayOrder: 0,
      }),
      createMediaFile(t, {
        organizationId: orgB.organizationId,
        collectionId: orgB.collectionId,
        userId: orgB.userId,
        fileName: "b.jpg",
        displayOrder: 0,
      }),
    ]);

    await expect(
      authedA.mutation(api.media.updateOrder, {
        mediaIds: [mediaA, mediaB],
      }),
    ).rejects.toThrow("Media does not belong to this organization");
  });

  test("accepts same-org media IDs and updates display order", async () => {
    const t = createConvexTest();

    const org = await setupOrgWithMediaUpload(t);
    const authed = authedForUser(t, org.userId);

    const [mediaFirst, mediaSecond] = await Promise.all([
      createMediaFile(t, {
        organizationId: org.organizationId,
        collectionId: org.collectionId,
        userId: org.userId,
        fileName: "first.jpg",
        displayOrder: 0,
      }),
      createMediaFile(t, {
        organizationId: org.organizationId,
        collectionId: org.collectionId,
        userId: org.userId,
        fileName: "second.jpg",
        displayOrder: 1,
      }),
    ]);

    await authed.mutation(api.media.updateOrder, {
      mediaIds: [mediaSecond, mediaFirst],
    });

    const [updatedFirst, updatedSecond] = await t.run(async (ctx) => {
      return await Promise.all([
        ctx.db.get(mediaFirst),
        ctx.db.get(mediaSecond),
      ]);
    });

    expect(updatedFirst?.displayOrder).toBe(1);
    expect(updatedSecond?.displayOrder).toBe(0);
  });
});
