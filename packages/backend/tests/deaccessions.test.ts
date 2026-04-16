import { convexTest } from "convex-test";
import { expect, test } from "vitest";
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

async function createOrgUserWithPermissions(
  t: ReturnType<typeof convexTest>,
  permissionNames: string[],
) {
  return t.run(async (ctx) => {
    const organizationId = await ctx.db.insert("organizations", {
      name: "Test Museum",
      slug: `test-museum-${Math.random().toString(36).slice(2, 8)}`,
      type: "museum",
    });

    const userId = await ctx.db.insert("users", {
      email: `user-${Math.random().toString(36).slice(2, 8)}@example.com`,
      name: "Test User",
    });

    const roleId = await ctx.db.insert("roles", {
      organizationId,
      name: "Collections Admin",
      isSystemRole: false,
    });

    for (const permissionName of permissionNames) {
      const permissionId = await ctx.db.insert("permissions", {
        name: permissionName,
        category: permissionName.split(".")[0] || "collections",
      });

      await ctx.db.insert("rolePermissions", {
        roleId,
        permissionId,
      });
    }

    await ctx.db.insert("userOrganizations", {
      userId,
      organizationId,
      roleId,
      joinedAt: Date.now(),
    });

    const collectionId = await ctx.db.insert("collections", {
      organizationId,
      accessionNumber: `OBJ-${Math.random().toString(36).slice(2, 8)}`,
      title: "Collection Object",
      status: "active",
      catalogedBy: userId,
      catalogedAt: Date.now(),
    });

    return { organizationId, userId, roleId, collectionId };
  });
}

test("delete requests create pending deaccessions instead of deleting immediately", async () => {
  const t = convexTest(schema, modules);
  const { organizationId, userId, roleId, collectionId } =
    await createOrgUserWithPermissions(t, [
      "collections.create",
      "collections.read",
      "collections.approve_deaccession",
    ]);

  await t.run(async (ctx) => {
    await ctx.db.insert("workflowConfigs", {
      organizationId,
      workflowType: "deaccession",
      steps: [{ stepNumber: 1, roleId, name: "Approve delete" }],
      canInitiateRoles: [roleId],
    });
  });

  const authed = authedForUser(t, userId);
  const deaccessionId = await authed.mutation(api.deaccessions.create, {
    organizationId,
    collectionId,
    dateDeaccessioned: Date.now(),
    reason: "Duplicate object",
    method: "destruction",
    targetCollectionStatus: "deleted",
  });

  const deaccession = await authed.query(api.deaccessions.get, {
    deaccessionId,
  });

  expect(deaccession).not.toBeNull();
  expect(deaccession?.status).toBe("pending");
  expect(deaccession?.targetCollectionStatus).toBe("deleted");

  const collection = await authed.query(api.collections.get, {
    collectionId,
  });
  expect(collection?.status).toBe("active");
});

test("approving an archive request marks the collection as archived", async () => {
  const t = convexTest(schema, modules);
  const { organizationId, userId, roleId, collectionId } =
    await createOrgUserWithPermissions(t, [
      "collections.create",
      "collections.read",
      "collections.approve_deaccession",
    ]);

  await t.run(async (ctx) => {
    await ctx.db.insert("workflowConfigs", {
      organizationId,
      workflowType: "deaccession",
      steps: [{ stepNumber: 1, roleId, name: "Approve archive" }],
      canInitiateRoles: [roleId],
    });
  });

  const authed = authedForUser(t, userId);
  const deaccessionId = await authed.mutation(api.deaccessions.create, {
    organizationId,
    collectionId,
    dateDeaccessioned: Date.now(),
    reason: "Moved out of active catalog",
    method: "destruction",
    targetCollectionStatus: "archived",
  });

  await authed.mutation(api.deaccessions.approve, {
    deaccessionId,
  });

  const collection = await authed.query(api.collections.get, {
    collectionId,
  });

  expect(collection?.status).toBe("archived");
  expect(collection?.archivedReason).toBe("Moved out of active catalog");
});
