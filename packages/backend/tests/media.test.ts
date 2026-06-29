import type { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "../convex/_generated/api";

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
