import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "../convex/_generated/api.js";
import type { Doc, Id } from "../convex/_generated/dataModel.js";
import schema from "../convex/schema.js";
import { modules } from "./testSetup.js";

type TestSetup = {
  organizationId: Id<"organizations">;
  userId: Id<"users">;
  roleId: Id<"roles">;
  userOrgId: Id<"userOrganizations">;
};

async function createTestOrg(
  t: ReturnType<typeof convexTest>,
  userName = "Test User",
  userEmail = "user@test.dev",
  username = "testuser",
): Promise<TestSetup> {
  const { organizationId, userId } = await t.run(async (ctx) => {
    const [organizationId, userId] = await Promise.all([
      ctx.db.insert("organizations", {
        name: "Comments Org",
        slug: `comments-org-${Math.random().toString(36).slice(2, 8)}`,
        type: "museum",
      }),
      ctx.db.insert("users", {
        name: userName,
        email: userEmail,
        username,
      }),
    ]);

    return { organizationId, userId };
  });

  const roleId = await t.run(async (ctx) => {
    return await ctx.db.insert("roles", {
      organizationId,
      name: "Curator",
      isSystemRole: false,
    });
  });

  const [permissionReadId, permissionUpdateId] = await Promise.all([
    t.run(async (ctx) => {
      return await ctx.db.insert("permissions", {
        name: "collections.read",
        category: "collections",
      });
    }),
    t.run(async (ctx) => {
      return await ctx.db.insert("permissions", {
        name: "collections.update",
        category: "collections",
      });
    }),
  ]);
  await t.run(async (ctx) => {
    await ctx.db.insert("rolePermissions", {
      roleId,
      permissionId: permissionReadId,
    });
    await ctx.db.insert("rolePermissions", {
      roleId,
      permissionId: permissionUpdateId,
    });
  });

  const userOrgId = await t.run(async (ctx) => {
    return await ctx.db.insert("userOrganizations", {
      userId,
      organizationId,
      roleId,
      joinedAt: Date.now(),
    });
  });

  return { organizationId, userId, roleId, userOrgId };
}

async function createCollection(
  t: ReturnType<typeof convexTest>,
  organizationId: Id<"organizations">,
  userId: Id<"users">,
  title = "Test Object",
) {
  return await t.run(async (ctx) => {
    return await ctx.db.insert("collections", {
      organizationId,
      accessionNumber: `ACC-${Math.random().toString(36).slice(2, 6)}`,
      title,
      status: "active",
      catalogedBy: userId,
      catalogedAt: Date.now(),
    });
  });
}

async function createUserInOrg(
  t: ReturnType<typeof convexTest>,
  organizationId: Id<"organizations">,
  roleId: Id<"roles">,
  name: string,
  email: string,
  username: string,
) {
  const userId = await t.run(async (ctx) => {
    return await ctx.db.insert("users", {
      name,
      email,
      username,
    });
  });

  await t.run(async (ctx) => {
    await ctx.db.insert("userOrganizations", {
      userId,
      organizationId,
      roleId,
      joinedAt: Date.now(),
    });
  });

  return userId;
}

describe("objectComments", () => {
  test("creates and lists comments", async () => {
    const t = convexTest(schema, modules);
    const { organizationId, userId } = await createTestOrg(t);
    const collectionId = await createCollection(t, organizationId, userId);

    const authed = t.withIdentity({
      subject: `${userId}|comment-session`,
      issuer: "https://example.test",
    });

    const commentId = await authed.mutation(api.objectComments.create, {
      objectId: collectionId,
      content: "First note",
    });

    expect(commentId).toBeDefined();

    const comments = await authed.query(api.objectComments.list, {
      objectId: collectionId,
    });

    expect(comments).toHaveLength(1);
    expect(comments[0]?.content).toBe("First note");
  });

  test("deletes own comment", async () => {
    const t = convexTest(schema, modules);
    const { organizationId, userId } = await createTestOrg(t);
    const collectionId = await createCollection(t, organizationId, userId);

    const authed = t.withIdentity({
      subject: `${userId}|comment-delete`,
      issuer: "https://example.test",
    });

    const commentId = await authed.mutation(api.objectComments.create, {
      objectId: collectionId,
      content: "Delete me",
    });

    await authed.mutation(api.objectComments.remove, { commentId });

    const comments = await authed.query(api.objectComments.list, {
      objectId: collectionId,
    });

    expect(comments).toHaveLength(0);
  });

  test("stores mentions and notifies users", async () => {
    const t = convexTest(schema, modules);
    const { organizationId, userId, roleId } = await createTestOrg(
      t,
      "Author",
      "author@test.dev",
      "author",
    );
    const [mentionedUserId, collectionId] = await Promise.all([
      createUserInOrg(
        t,
        organizationId,
        roleId,
        "Jane Doe",
        "jane@test.dev",
        "jane",
      ),
      createCollection(t, organizationId, userId),
    ]);
    const authed = t.withIdentity({
      subject: `${userId}|comment-mention`,
      issuer: "https://example.test",
    });

    const commentId = await authed.mutation(api.objectComments.create, {
      objectId: collectionId,
      content: "Hello @jane thanks!",
    });

    const comment = await t.run(async (ctx) => {
      return (await ctx.db.get(commentId)) as Doc<"objectComments"> | null;
    });

    expect(comment?.mentionedUserIds).toEqual([mentionedUserId]);

    const notifications = await t.run(async (ctx) => {
      return await ctx.db
        .query("notifications")
        .withIndex("by_user", (q) => q.eq("userId", mentionedUserId))
        .collect();
    });

    expect(notifications.length).toBeGreaterThan(0);
    expect(notifications[0]?.type).toBe("comment_mention");
  });
});
