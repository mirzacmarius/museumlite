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

describe("mediaEdits", () => {
  test("should track crop operation with parameters", async () => {
    const t = convexTest(schema, modules);
    const setup = await createTestSetup(t);

    const editHistoryId = await t.mutation(api.mediaEdits.trackEdit, {
      mediaId: setup.mediaFileId,
      operation: "crop",
      parameters: { x: 10, y: 10, width: 200, height: 150 },
    }, { as: setup.userId });

    expect(editHistoryId).toBeDefined();

    const editHistory = await t.run(async (ctx) => {
      return await ctx.db.get(editHistoryId);
    });

    expect(editHistory).toBeDefined();
    expect(editHistory?.operation).toBe("crop");
    expect(editHistory?.parameters).toEqual({ x: 10, y: 10, width: 200, height: 150 });
  });

  test("should track all operation types", async () => {
    const t = convexTest(schema, modules);
    const setup = await createTestSetup(t);

    // Track crop
    await t.mutation(api.mediaEdits.trackEdit, {
      mediaId: setup.mediaFileId,
      operation: "crop",
      parameters: { x: 0, y: 0, width: 100, height: 100 },
    }, { as: setup.userId });

    // Track rotate
    await t.mutation(api.mediaEdits.trackEdit, {
      mediaId: setup.mediaFileId,
      operation: "rotate",
      parameters: { degrees: 90 },
    }, { as: setup.userId });

    // Track adjust
    await t.mutation(api.mediaEdits.trackEdit, {
      mediaId: setup.mediaFileId,
      operation: "adjust",
      parameters: { brightness: 120, contrast: 110 },
    }, { as: setup.userId });

    // Track watermark
    await t.mutation(api.mediaEdits.trackEdit, {
      mediaId: setup.mediaFileId,
      operation: "watermark",
      parameters: { text: "Copyright 2026", position: "bottom-right" },
    }, { as: setup.userId });

    const history = await t.query(api.mediaEdits.getEditHistory, {
      mediaId: setup.mediaFileId,
    }, { as: setup.userId });

    expect(history.length).toBe(4);
    expect(history.some((h) => h.operation === "crop")).toBe(true);
    expect(history.some((h) => h.operation === "rotate")).toBe(true);
    expect(history.some((h) => h.operation === "adjust")).toBe(true);
    expect(history.some((h) => h.operation === "watermark")).toBe(true);
  });

  test("should get edit history chronologically", async () => {
    const t = convexTest(schema, modules);
    const setup = await createTestSetup(t);

    // Create multiple edits with slight delays
    await t.mutation(api.mediaEdits.trackEdit, {
      mediaId: setup.mediaFileId,
      operation: "crop",
    }, { as: setup.userId });

    await t.mutation(api.mediaEdits.trackEdit, {
      mediaId: setup.mediaFileId,
      operation: "rotate",
    }, { as: setup.userId });

    await t.mutation(api.mediaEdits.trackEdit, {
      mediaId: setup.mediaFileId,
      operation: "adjust",
    }, { as: setup.userId });

    const history = await t.query(api.mediaEdits.getEditHistory, {
      mediaId: setup.mediaFileId,
    }, { as: setup.userId });

    expect(history.length).toBe(3);
    // Most recent first
    expect(history[0].operation).toBe("adjust");
    expect(history[1].operation).toBe("rotate");
    expect(history[2].operation).toBe("crop");
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

    // Try to track edit without permission - should throw
    await expect(async () => {
      await t.mutation(api.mediaEdits.trackEdit, {
        mediaId: setup.mediaFileId,
        operation: "crop",
      }, { as: unauthorizedUserId });
    }).rejects.toThrow();
  });
});
