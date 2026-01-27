import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import schema from "../convex/schema";

import { modules } from "./testSetup";

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
  const organizationId = await t.run(async (ctx) => {
    return await ctx.db.insert("organizations", {
      name: "Test Museum",
      slug: `test-museum-${Math.random().toString(36).slice(2, 8)}`,
      type: "museum",
    });
  });

  const userId = await t.run(async (ctx) => {
    return await ctx.db.insert("users", {
      name: "Test User",
      email: `test-${Math.random().toString(36).slice(2, 8)}@example.com`,
    });
  });

  const mediaUploadPermissionId = await t.run(async (ctx) => {
    return await ctx.db.insert("permissions", {
      name: "media.upload",
      category: "media",
    });
  });

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

  const collectionId = await t.run(async (ctx) => {
    return await ctx.db.insert("collections", {
      organizationId,
      title: "Test Collection",
      type: "fine_art",
      accessionNumber: "TEST-001",
      status: "active",
      catalogedBy: userId,
      catalogedAt: Date.now(),
      createdBy: userId,
      createdAt: Date.now(),
    });
  });

  const storageId = await t.run(async (ctx) => {
    return "test-storage-id" as Id<"_storage">;
  });

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

describe("mediaVersions", () => {
  test("should create first version of media file", async () => {
    const t = convexTest(schema, modules);
    const setup = await createTestSetup(t);

    const versionId = await t.mutation(
      api.mediaVersions.createVersion,
      {
        mediaId: setup.mediaFileId,
        storageId: setup.storageId,
        editType: "crop",
        editMetadata: { x: 0, y: 0, width: 100, height: 100 },
      },
      { as: setup.userId },
    );

    expect(versionId).toBeDefined();

    const version = await t.run(async (ctx) => {
      return await ctx.db.get(versionId);
    });

    expect(version).toBeDefined();
    expect(version?.versionNumber).toBe(1);
    expect(version?.editType).toBe("crop");
  });

  test("should increment version number correctly", async () => {
    const t = convexTest(schema, modules);
    const setup = await createTestSetup(t);

    // Create version 1
    await t.mutation(
      api.mediaVersions.createVersion,
      {
        mediaId: setup.mediaFileId,
        storageId: setup.storageId,
        editType: "crop",
      },
      { as: setup.userId },
    );

    // Create version 2
    const version2Id = await t.mutation(
      api.mediaVersions.createVersion,
      {
        mediaId: setup.mediaFileId,
        storageId: setup.storageId,
        editType: "rotate",
      },
      { as: setup.userId },
    );

    const version2 = await t.run(async (ctx) => {
      return await ctx.db.get(version2Id);
    });

    expect(version2?.versionNumber).toBe(2);
  });

  test("should list versions sorted by version number", async () => {
    const t = convexTest(schema, modules);
    const setup = await createTestSetup(t);

    // Create multiple versions
    await t.mutation(
      api.mediaVersions.createVersion,
      {
        mediaId: setup.mediaFileId,
        storageId: setup.storageId,
        editType: "crop",
      },
      { as: setup.userId },
    );

    await t.mutation(
      api.mediaVersions.createVersion,
      {
        mediaId: setup.mediaFileId,
        storageId: setup.storageId,
        editType: "rotate",
      },
      { as: setup.userId },
    );

    await t.mutation(
      api.mediaVersions.createVersion,
      {
        mediaId: setup.mediaFileId,
        storageId: setup.storageId,
        editType: "adjust",
      },
      { as: setup.userId },
    );

    const versions = await t.query(
      api.mediaVersions.listVersions,
      {
        mediaId: setup.mediaFileId,
      },
      { as: setup.userId },
    );

    expect(versions.length).toBe(3);
    expect(versions[0].versionNumber).toBe(3); // Newest first
    expect(versions[1].versionNumber).toBe(2);
    expect(versions[2].versionNumber).toBe(1);
  });

  test("should revert to previous version", async () => {
    const t = convexTest(schema, modules);
    const setup = await createTestSetup(t);

    // Create versions
    const version1Id = await t.mutation(
      api.mediaVersions.createVersion,
      {
        mediaId: setup.mediaFileId,
        storageId: setup.storageId,
        editType: "crop",
      },
      { as: setup.userId },
    );

    await t.mutation(
      api.mediaVersions.createVersion,
      {
        mediaId: setup.mediaFileId,
        storageId: setup.storageId,
        editType: "rotate",
      },
      { as: setup.userId },
    );

    // Revert to version 1
    await t.mutation(
      api.mediaVersions.revertToVersion,
      {
        versionId: version1Id,
      },
      { as: setup.userId },
    );

    const mediaFile = await t.run(async (ctx) => {
      return await ctx.db.get(setup.mediaFileId);
    });

    expect(mediaFile?.currentVersionId).toBe(version1Id);
  });

  test("should require media.upload permission", async () => {
    const t = convexTest(schema, modules);
    const setup = await createTestSetup(t);

    // Create user without media.upload permission
    const unauthorizedUserId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        name: "Unauthorized User",
        email: "unauthorized@example.com",
      });
    });

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
    await expect(async () => {
      await t.mutation(
        api.mediaVersions.createVersion,
        {
          mediaId: setup.mediaFileId,
          storageId: setup.storageId,
          editType: "crop",
        },
        { as: unauthorizedUserId },
      );
    }).rejects.toThrow();
  });

  test("should enforce organization isolation", async () => {
    const t = convexTest(schema, modules);
    const setup = await createTestSetup(t);

    // Create another organization
    const otherOrgId = await t.run(async (ctx) => {
      return await ctx.db.insert("organizations", {
        name: "Other Museum",
        slug: `other-museum-${Math.random().toString(36).slice(2, 8)}`,
        type: "museum",
      });
    });

    const otherUserId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        name: "Other User",
        email: "other@example.com",
      });
    });

    const otherRoleId = await t.run(async (ctx) => {
      const mediaUploadPermId = await ctx.db.insert("permissions", {
        name: "media.upload",
        category: "media",
      });

      const roleId = await ctx.db.insert("roles", {
        organizationId: otherOrgId,
        name: "Admin",
        isSystemRole: true,
      });

      await ctx.db.insert("rolePermissions", {
        roleId,
        permissionId: mediaUploadPermId,
      });

      return roleId;
    });

    await t.run(async (ctx) => {
      await ctx.db.insert("userOrganizations", {
        userId: otherUserId,
        organizationId: otherOrgId,
        roleId: otherRoleId,
        joinedAt: Date.now(),
      });
    });

    // Try to create version for media in different org - should throw
    await expect(async () => {
      await t.mutation(
        api.mediaVersions.createVersion,
        {
          mediaId: setup.mediaFileId,
          storageId: setup.storageId,
          editType: "crop",
        },
        { as: otherUserId },
      );
    }).rejects.toThrow();
  });
});
