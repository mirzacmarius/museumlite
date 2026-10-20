import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
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

type TestSetup = {
  organizationId: Id<"organizations">;
  userId: Id<"users">;
  roleId: Id<"roles">;
  collectionId: Id<"collections">;
  mediaFileId: Id<"mediaFiles">;
  storageId: Id<"_storage">;
};

async function createTestSetup(
  t: ReturnType<typeof convexTest>,
): Promise<TestSetup> {
  const [
    organizationId,
    userId,
    mediaUploadPermissionId,
    mediaReadPermissionId,
  ] = await Promise.all([
    t.run(async (ctx) => {
      return await ctx.db.insert("organizations", {
        name: "Test Museum",
        slug: `test-museum-${Math.random().toString(36).slice(2, 8)}`,
        type: "museum",
      });
    }),
    t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        name: "Test User",
        email: `test-${Math.random().toString(36).slice(2, 8)}@example.com`,
      });
    }),
    t.run(async (ctx) => {
      return await ctx.db.insert("permissions", {
        name: "media.upload",
        category: "media",
      });
    }),
    t.run(async (ctx) => {
      return await ctx.db.insert("permissions", {
        name: "media.read",
        category: "media",
      });
    }),
  ]);
  const roleId = await t.run(async (ctx) => {
    const roleId = await ctx.db.insert("roles", {
      organizationId,
      name: "Admin",
      isSystemRole: true,
    });

    await ctx.db.insert("rolePermissions", {
      roleId,
      permissionId: mediaUploadPermissionId,
    });

    await ctx.db.insert("rolePermissions", {
      roleId,
      permissionId: mediaReadPermissionId,
    });

    return roleId;
  });

  await t.run(async (ctx) => {
    await ctx.db.insert("userOrganizations", {
      userId,
      organizationId,
      roleId,
      joinedAt: Date.now(),
    });
  });

  const [collectionId, storageId] = await Promise.all([
    t.run(async (ctx) => {
      return await ctx.db.insert("collections", {
        organizationId,
        accessionNumber: "TEST-001",
        title: "Test Collection",
        status: "active",
        catalogedBy: userId,
        catalogedAt: Date.now(),
      });
    }),
    t.run(async (ctx) => {
      return await ctx.storage.store(
        new Blob([new Uint8Array([0xff])], { type: "image/jpeg" }),
      );
    }),
  ]);
  const mediaFileId = await t.run(async (ctx) => {
    return await ctx.db.insert("mediaFiles", {
      organizationId,
      collectionId,
      storageId,
      fileName: "test-image.jpg",
      fileType: "image",
      fileSize: 1024,
      mimeType: "image/jpeg",
      mediaCategory: "image",
      isPrimary: false,
      uploadedBy: userId,
      uploadedAt: Date.now(),
      uploadStatus: "completed",
    });
  });

  return {
    organizationId,
    userId,
    roleId,
    collectionId,
    mediaFileId,
    storageId,
  };
}

async function uploadVersion(
  t: ReturnType<typeof convexTest>,
  setup: TestSetup,
) {
  const url = await authedForUser(t, setup.userId).mutation(
    api.users.generateUploadUrl,
    { organizationId: setup.organizationId, mimeType: "image/jpeg" },
  );
  const parsed = new URL(url);
  const response = await t.fetch(parsed.pathname + parsed.search, {
    method: "POST",
    body: new Blob(["edited image"], { type: "image/jpeg" }),
  });
  expect(response.status).toBe(200);
  const result: { storageId: Id<"_storage"> } = await response.json();
  return result.storageId;
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("mediaVersions", () => {
  test("should create first version of media file", async () => {
    const t = convexTest(schema, modules);
    const setup = await createTestSetup(t);

    const authed = authedForUser(t, setup.userId);
    const versionId = await authed.mutation(api.mediaVersions.createVersion, {
      mediaId: setup.mediaFileId,
      storageId: await uploadVersion(t, setup),
      editType: "crop",
      editMetadata: { x: 0, y: 0, width: 100, height: 100 },
    });

    expect(versionId).toBeDefined();

    const version = await t.run(async (ctx) => {
      return await ctx.db.get(versionId);
    });

    expect(version).toBeDefined();
    expect(version?.versionNumber).toBe(1);
    expect(version?.editType).toBe("crop");
  });

  test("the object shows its image's saved edit, and the watermark is remembered", async () => {
    const t = convexTest(schema, modules);
    const setup = await createTestSetup(t);
    const authed = authedForUser(t, setup.userId);
    const versionStorageId = await uploadVersion(t, setup);

    const before = await authed.query(api.media.getWithMetadata, {
      mediaId: setup.mediaFileId,
    });
    expect(before?.watermarked).toBe(false);
    expect(before?.originalUrl).toBeNull();

    await authed.mutation(api.mediaVersions.createVersion, {
      mediaId: setup.mediaFileId,
      storageId: versionStorageId,
      editType: "watermark",
      editMetadata: { watermark: { enabled: true, position: "center" } },
    });

    const versionUrl = await t.run((ctx) =>
      ctx.storage.getUrl(versionStorageId),
    );
    const [gallery, primaryUrl, detail, catalog] = await Promise.all([
      authed.query(api.media.list, { collectionId: setup.collectionId }),
      authed.query(api.media.getPrimaryImageUrl, {
        collectionId: setup.collectionId,
      }),
      authed.query(api.media.getWithMetadata, { mediaId: setup.mediaFileId }),
      authed.query(api.media.getBatchPrimaryImageUrls, {
        collectionIds: [setup.collectionId],
      }),
    ]);
    expect(gallery[0]?.url).toBe(versionUrl);
    expect(gallery[0]?.thumbnailUrl).toBeNull();
    expect(primaryUrl).toBe(versionUrl);
    expect(catalog).toEqual([
      { collectionId: setup.collectionId, url: versionUrl },
    ]);
    expect(detail?.url).toBe(versionUrl);
    expect(detail?.watermarked).toBe(true);
    expect(detail?.originalUrl).toBe(
      await t.run((ctx) => ctx.storage.getUrl(setup.storageId)),
    );
  });

  test("should increment version number correctly", async () => {
    const t = convexTest(schema, modules);
    const setup = await createTestSetup(t);
    const authed = authedForUser(t, setup.userId);

    // Create version 1
    await authed.mutation(api.mediaVersions.createVersion, {
      mediaId: setup.mediaFileId,
      storageId: await uploadVersion(t, setup),
      editType: "crop",
    });

    // Create version 2
    const version2Id = await authed.mutation(api.mediaVersions.createVersion, {
      mediaId: setup.mediaFileId,
      storageId: await uploadVersion(t, setup),
      editType: "rotate",
    });

    const version2 = await t.run(async (ctx) => {
      return await ctx.db.get(version2Id);
    });

    expect(version2?.versionNumber).toBe(2);
  });

  test("should increment usage counters when creating a version", async () => {
    const t = convexTest(schema, modules);
    const setup = await createTestSetup(t);
    const authed = authedForUser(t, setup.userId);

    await authed.mutation(api.mediaVersions.createVersion, {
      mediaId: setup.mediaFileId,
      storageId: await uploadVersion(t, setup),
      editType: "adjust",
    });

    const usageCounter = await t.run(async (ctx) => {
      return await ctx.db
        .query("organizationUsageCounters")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", setup.organizationId),
        )
        .unique();
    });

    expect(usageCounter?.mediaVersionCount).toBe(1);
    expect(usageCounter?.storageBytes).toBeGreaterThan(0);
  });

  test("should list versions sorted by version number", async () => {
    const t = convexTest(schema, modules);
    const setup = await createTestSetup(t);
    const authed = authedForUser(t, setup.userId);

    // Create multiple versions
    await authed.mutation(api.mediaVersions.createVersion, {
      mediaId: setup.mediaFileId,
      storageId: await uploadVersion(t, setup),
      editType: "crop",
    });

    await authed.mutation(api.mediaVersions.createVersion, {
      mediaId: setup.mediaFileId,
      storageId: await uploadVersion(t, setup),
      editType: "rotate",
    });

    await authed.mutation(api.mediaVersions.createVersion, {
      mediaId: setup.mediaFileId,
      storageId: await uploadVersion(t, setup),
      editType: "adjust",
    });

    const versions = await authed.query(api.mediaVersions.listVersions, {
      mediaId: setup.mediaFileId,
    });

    expect(versions.length).toBe(3);
    expect(versions[0].versionNumber).toBe(3); // Newest first
    expect(versions[1].versionNumber).toBe(2);
    expect(versions[2].versionNumber).toBe(1);
  });

  test("should revert to previous version", async () => {
    const t = convexTest(schema, modules);
    const setup = await createTestSetup(t);
    const authed = authedForUser(t, setup.userId);

    // Create versions
    const version1Id = await authed.mutation(api.mediaVersions.createVersion, {
      mediaId: setup.mediaFileId,
      storageId: await uploadVersion(t, setup),
      editType: "crop",
    });

    await authed.mutation(api.mediaVersions.createVersion, {
      mediaId: setup.mediaFileId,
      storageId: await uploadVersion(t, setup),
      editType: "rotate",
    });

    // Revert to version 1
    await authed.mutation(api.mediaVersions.revertToVersion, {
      versionId: version1Id,
    });

    const mediaFile = await t.run(async (ctx) => {
      return await ctx.db.get(setup.mediaFileId);
    });

    expect(mediaFile?.currentVersionId).toBe(version1Id);
  });

  test("should require media.upload permission", async () => {
    const t = convexTest(schema, modules);
    const [setup, unauthorizedUserId] = await Promise.all([
      createTestSetup(t),
      t.run(async (ctx) => {
        return await ctx.db.insert("users", {
          name: "Unauthorized User",
          email: "unauthorized@example.com",
        });
      }),
    ]);

    // Create user without media.upload permission
    const noPermRoleId = await t.run(async (ctx) => {
      return await ctx.db.insert("roles", {
        organizationId: setup.organizationId,
        name: "Viewer",
        isSystemRole: false,
      });
    });

    await t.run(async (ctx) => {
      await ctx.db.insert("userOrganizations", {
        userId: unauthorizedUserId,
        organizationId: setup.organizationId,
        roleId: noPermRoleId,
        joinedAt: Date.now(),
      });
    });

    // Try to create version without permission - should throw
    await expect(
      authedForUser(t, unauthorizedUserId).mutation(
        api.mediaVersions.createVersion,
        {
          mediaId: setup.mediaFileId,
          storageId: await uploadVersion(t, setup),
          editType: "crop",
        },
      ),
    ).rejects.toThrow();
  });

  test("should enforce organization isolation", async () => {
    const t = convexTest(schema, modules);
    const [setup, otherOrgId] = await Promise.all([
      createTestSetup(t),
      t.run(async (ctx) => {
        return await ctx.db.insert("organizations", {
          name: "Other Museum",
          slug: `other-museum-${Math.random().toString(36).slice(2, 8)}`,
          type: "museum",
        });
      }),
    ]);

    // Create another organization
    const [otherUserId, otherRoleId] = await Promise.all([
      t.run(async (ctx) => {
        return await ctx.db.insert("users", {
          name: "Other User",
          email: "other@example.com",
        });
      }),
      t.run(async (ctx) => {
        const [mediaUploadPermId, roleId] = await Promise.all([
          ctx.db.insert("permissions", {
            name: "media.upload",
            category: "media",
          }),
          ctx.db.insert("roles", {
            organizationId: otherOrgId,
            name: "Admin",
            isSystemRole: true,
          }),
        ]);
        await ctx.db.insert("rolePermissions", {
          roleId,
          permissionId: mediaUploadPermId,
        });

        return roleId;
      }),
    ]);
    await t.run(async (ctx) => {
      await ctx.db.insert("userOrganizations", {
        userId: otherUserId,
        organizationId: otherOrgId,
        roleId: otherRoleId,
        joinedAt: Date.now(),
      });
    });

    // Try to create version for media in different org - should throw
    await expect(
      authedForUser(t, otherUserId).mutation(api.mediaVersions.createVersion, {
        mediaId: setup.mediaFileId,
        storageId: await uploadVersion(t, setup),
        editType: "crop",
      }),
    ).rejects.toThrow();
  });
});
