import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "../convex/_generated/api.js";
import type { Doc, Id } from "../convex/_generated/dataModel.js";
import * as organizations from "../convex/organizations.js";
import schema from "../convex/schema.js";
import { expectMatchesReturns } from "./returnsValidation.js";
import {
  authedForUser,
  capabilityFailureOf,
  createConvexTest,
  createOrgUserCollectionWithPermissions,
  createOrgUserWithPermissions,
} from "./testHarness.js";
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

  const [roleId, permissionReadId, permissionUpdateId] = await Promise.all([
    t.run(async (ctx) => {
      return await ctx.db.insert("roles", {
        organizationId,
        name: "Curator",
        isSystemRole: false,
      });
    }),
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

  test("retains original museum field notes", async () => {
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

    await expect(
      authed.mutation(api.objectComments.remove, { commentId }),
    ).rejects.toThrow("Permanent evidence");

    const comments = await authed.query(api.objectComments.list, {
      objectId: collectionId,
    });

    expect(comments).toHaveLength(1);
    expect(comments[0]).toMatchObject({ _id: commentId, content: "Delete me" });
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

describe("Comments module", () => {
  const ADMIN_PERMISSIONS = [
    "collections.read",
    "collections.update",
    "organization.manage_settings",
  ];

  test("an organization that never chose has Comments on", async () => {
    const t = createConvexTest();
    const { userId, collectionId } =
      await createOrgUserCollectionWithPermissions(t, ADMIN_PERMISSIONS, {
        enabledModules: ["accounts"],
      });
    const member = authedForUser(t, userId);

    await member.mutation(api.objectComments.create, {
      objectId: collectionId,
      content: "Noted on arrival",
    });

    const comments = await member.query(api.objectComments.list, {
      objectId: collectionId,
    });
    expect(comments.map((comment) => comment.content)).toEqual([
      "Noted on arrival",
    ]);
  });

  test("turning Comments off refuses new comments and keeps existing ones until it is turned back on", async () => {
    const t = createConvexTest();
    const { organizationId, userId, collectionId } =
      await createOrgUserCollectionWithPermissions(t, ADMIN_PERMISSIONS);
    const admin = authedForUser(t, userId);
    await admin.mutation(api.objectComments.create, {
      objectId: collectionId,
      content: "Frame needs checking",
    });

    await admin.mutation(api.organizations.setModuleEnabled, {
      organizationId,
      moduleId: "comments",
      enabled: false,
    });

    expect(
      await capabilityFailureOf(
        admin.mutation(api.objectComments.create, {
          objectId: collectionId,
          content: "Written while off",
        }),
      ),
    ).toMatchObject({ reason: "module_disabled", module: "comments" });
    const whileOff = await admin.query(api.objectComments.list, {
      objectId: collectionId,
    });
    expect(whileOff.map((comment) => comment.content)).toEqual([
      "Frame needs checking",
    ]);

    await admin.mutation(api.organizations.setModuleEnabled, {
      organizationId,
      moduleId: "comments",
      enabled: true,
    });
    await admin.mutation(api.objectComments.create, {
      objectId: collectionId,
      content: "Frame checked",
    });
    const afterOn = await admin.query(api.objectComments.list, {
      objectId: collectionId,
    });
    expect(afterOn.map((comment) => comment.content)).toEqual([
      "Frame needs checking",
      "Frame checked",
    ]);
  });

  test("organization reads report Comments as off once it is turned off", async () => {
    const t = createConvexTest();
    const { organizationId, userId } = await createOrgUserWithPermissions(
      t,
      ADMIN_PERMISSIONS,
      { enabledModules: ["fine_art"] },
    );
    const admin = authedForUser(t, userId);

    await admin.mutation(api.organizations.setModuleEnabled, {
      organizationId,
      moduleId: "comments",
      enabled: false,
    });

    const organization = await admin.query(api.organizations.get, {
      organizationId,
    });
    expectMatchesReturns(organizations.get, organization);
    expect(organization?.settings).toMatchObject({
      enabledModules: ["fine_art"],
      disabledModules: ["comments"],
    });
    const memberships = await admin.query(
      api.organizations.listUserOrganizations,
      {},
    );
    expectMatchesReturns(organizations.listUserOrganizations, memberships);
    expect(memberships[0]?.settings?.disabledModules).toEqual(["comments"]);
  });

  test("only members who manage settings can turn Comments off", async () => {
    const t = createConvexTest();
    const { organizationId, userId } = await createOrgUserWithPermissions(t, [
      "collections.read",
      "collections.update",
    ]);

    expect(
      await capabilityFailureOf(
        authedForUser(t, userId).mutation(api.organizations.setModuleEnabled, {
          organizationId,
          moduleId: "comments",
          enabled: false,
        }),
      ),
    ).toMatchObject({ reason: "permission_missing" });
  });

  test("a non-member gets the same refusal whether Comments is on or off", async () => {
    const t = createConvexTest();
    const { organizationId, userId, collectionId } =
      await createOrgUserCollectionWithPermissions(t, ADMIN_PERMISSIONS);
    const { userId: outsiderId } = await createOrgUserWithPermissions(
      t,
      ADMIN_PERMISSIONS,
      { slugPrefix: "other-museum" },
    );
    const outsider = authedForUser(t, outsiderId);
    const attempt = () =>
      capabilityFailureOf(
        outsider.mutation(api.objectComments.create, {
          objectId: collectionId,
          content: "Probe",
        }),
      );

    const whileOn = await attempt();
    await authedForUser(t, userId).mutation(
      api.organizations.setModuleEnabled,
      { organizationId, moduleId: "comments", enabled: false },
    );
    const whileOff = await attempt();

    expect(whileOn).toMatchObject({ reason: "permission_missing" });
    expect(whileOff).toEqual(whileOn);
  });
});
