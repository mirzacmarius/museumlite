import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import schema from "../convex/schema";
import { modules } from "./testSetup";

type OrgSetup = {
  organizationId: Id<"organizations">;
  userId: Id<"users">;
  roleId: Id<"roles">;
};

async function createOrgWithRole(
  t: ReturnType<typeof convexTest>,
  permissionNames: string[],
  roleName = "Test Role",
): Promise<OrgSetup> {
  const organizationId = await t.run(async (ctx) => {
    return await ctx.db.insert("organizations", {
      name: "Workflow Test Org",
      slug: `workflow-org-${Math.random().toString(36).slice(2, 8)}`,
      type: "museum",
      settings: {
        enabledModules: ["fine_art", "accounts"],
      },
    });
  });

  const userId = await t.run(async (ctx) => {
    return await ctx.db.insert("users", {
      name: "Workflow User",
      email: `workflow-${Math.random().toString(36).slice(2, 8)}@test.dev`,
    });
  });

  const roleId = await t.run(async (ctx) => {
    return await ctx.db.insert("roles", {
      organizationId,
      name: roleName,
      isSystemRole: true,
    });
  });

  for (const permissionName of permissionNames) {
    const permissionId = await t.run(async (ctx) => {
      return await ctx.db.insert("permissions", {
        name: permissionName,
        category: "collections",
      });
    });

    await t.run(async (ctx) => {
      await ctx.db.insert("rolePermissions", {
        roleId,
        permissionId,
      });
    });
  }

  await t.run(async (ctx) => {
    await ctx.db.insert("userOrganizations", {
      userId,
      organizationId,
      roleId,
      joinedAt: Date.now(),
    });
  });

  return { organizationId, userId, roleId };
}

// ============================================
// Workflow Config CRUD Tests
// ============================================

describe("Workflow Config CRUD", () => {
  test("list returns empty array when no configs exist", async () => {
    // #given
    const t = convexTest(schema, modules);
    const { organizationId } = await createOrgWithRole(t, ["settings.read"]);

    // #when
    const result = await t.query(api.workflows.list, {
      organizationId,
    });

    // #then
    expect(result).toEqual([]);
  });

  test("list returns all workflow configs for an organization", async () => {
    // #given
    const t = convexTest(schema, modules);
    const { organizationId, roleId } = await createOrgWithRole(t, [
      "settings.read",
    ]);

    await t.run(async (ctx) => {
      await ctx.db.insert("workflowConfigs", {
        organizationId,
        workflowType: "accession",
        steps: [{ stepNumber: 1, roleId, name: "Step 1" }],
        canInitiateRoles: [roleId],
      });

      await ctx.db.insert("workflowConfigs", {
        organizationId,
        workflowType: "loan",
        steps: [{ stepNumber: 1, roleId, name: "Loan Step 1" }],
        canInitiateRoles: [roleId],
      });
    });

    // #when
    const result = await t.query(api.workflows.list, {
      organizationId,
    });

    // #then
    expect(result).toHaveLength(2);
    expect(result[0].workflowType).toBe("accession");
    expect(result[1].workflowType).toBe("loan");
  });

  test("get returns null when workflow config does not exist", async () => {
    // #given
    const t = convexTest(schema, modules);
    const { organizationId } = await createOrgWithRole(t, ["settings.read"]);

    // #when
    const result = await t.query(api.workflows.get, {
      organizationId,
      workflowType: "accession",
    });

    // #then
    expect(result).toBeNull();
  });

  test("get returns workflow config when it exists", async () => {
    // #given
    const t = convexTest(schema, modules);
    const { organizationId, roleId } = await createOrgWithRole(t, [
      "settings.read",
    ]);

    await t.run(async (ctx) => {
      await ctx.db.insert("workflowConfigs", {
        organizationId,
        workflowType: "accession",
        steps: [
          { stepNumber: 1, roleId, name: "Review" },
          { stepNumber: 2, roleId, name: "Approve" },
        ],
        canInitiateRoles: [roleId],
      });
    });

    // #when
    const result = await t.query(api.workflows.get, {
      organizationId,
      workflowType: "accession",
    });

    // #then
    expect(result).not.toBeNull();
    expect(result?.workflowType).toBe("accession");
    expect(result?.steps).toHaveLength(2);
    expect(result?.steps[0].name).toBe("Review");
    expect(result?.steps[1].name).toBe("Approve");
  });

  test("upsert creates new workflow config when none exists", async () => {
    // #given
    const t = convexTest(schema, modules);
    const { organizationId, userId, roleId } = await createOrgWithRole(t, [
      "settings.update",
    ]);

    t.setUser({
      type: "user",
      tokenIdentifier: `test|${userId}`,
      id: userId,
    });

    // #when
    const configId = await t.mutation(api.workflows.upsert, {
      organizationId,
      workflowType: "accession",
      steps: [{ stepNumber: 1, roleId, name: "Initial Review" }],
      canInitiateRoles: [roleId],
    });

    // #then
    expect(configId).toBeDefined();

    const config = await t.run(async (ctx) => {
      return await ctx.db.get(configId);
    });

    expect(config).not.toBeNull();
    expect(config?.workflowType).toBe("accession");
    expect(config?.steps).toHaveLength(1);
    expect(config?.steps[0].name).toBe("Initial Review");
  });

  test("upsert updates existing workflow config", async () => {
    // #given
    const t = convexTest(schema, modules);
    const { organizationId, userId, roleId } = await createOrgWithRole(t, [
      "settings.update",
    ]);

    t.setUser({
      type: "user",
      tokenIdentifier: `test|${userId}`,
      id: userId,
    });

    const existingConfigId = await t.run(async (ctx) => {
      return await ctx.db.insert("workflowConfigs", {
        organizationId,
        workflowType: "accession",
        steps: [{ stepNumber: 1, roleId, name: "Old Step" }],
        canInitiateRoles: [roleId],
      });
    });

    // #when
    const configId = await t.mutation(api.workflows.upsert, {
      organizationId,
      workflowType: "accession",
      steps: [
        { stepNumber: 1, roleId, name: "Updated Step 1" },
        { stepNumber: 2, roleId, name: "Updated Step 2" },
      ],
      canInitiateRoles: [roleId],
    });

    // #then
    expect(configId).toBe(existingConfigId);

    const config = await t.run(async (ctx) => {
      return await ctx.db.get(configId);
    });

    expect(config?.steps).toHaveLength(2);
    expect(config?.steps[0].name).toBe("Updated Step 1");
    expect(config?.steps[1].name).toBe("Updated Step 2");
  });

  test("remove deletes workflow config", async () => {
    // #given
    const t = convexTest(schema, modules);
    const { organizationId, userId, roleId } = await createOrgWithRole(t, [
      "settings.update",
    ]);

    t.setUser({
      type: "user",
      tokenIdentifier: `test|${userId}`,
      id: userId,
    });

    const configId = await t.run(async (ctx) => {
      return await ctx.db.insert("workflowConfigs", {
        organizationId,
        workflowType: "accession",
        steps: [{ stepNumber: 1, roleId, name: "Step 1" }],
        canInitiateRoles: [roleId],
      });
    });

    // #when
    await t.mutation(api.workflows.remove, {
      id: configId,
    });

    // #then
    const config = await t.run(async (ctx) => {
      return await ctx.db.get(configId);
    });

    expect(config).toBeNull();
  });

  test("remove throws error when config not found", async () => {
    // #given
    const t = convexTest(schema, modules);
    const { userId } = await createOrgWithRole(t, ["settings.update"]);

    t.setUser({
      type: "user",
      tokenIdentifier: `test|${userId}`,
      id: userId,
    });

    const fakeId = "k17b7y7ys45s4d67k9p4ycpqhh6z9rh4" as Id<"workflowConfigs">;

    // #when #then
    await expect(
      t.mutation(api.workflows.remove, {
        id: fakeId,
      }),
    ).rejects.toThrow("Workflow config not found");
  });

  test("upsert requires authentication", async () => {
    // #given
    const t = convexTest(schema, modules);
    const { organizationId, roleId } = await createOrgWithRole(t, [
      "settings.update",
    ]);

    // #when #then
    await expect(
      t.mutation(api.workflows.upsert, {
        organizationId,
        workflowType: "accession",
        steps: [{ stepNumber: 1, roleId, name: "Step 1" }],
        canInitiateRoles: [roleId],
      }),
    ).rejects.toThrow("Not authenticated");
  });

  test("remove requires authentication", async () => {
    // #given
    const t = convexTest(schema, modules);
    const { organizationId, roleId } = await createOrgWithRole(t, [
      "settings.update",
    ]);

    const configId = await t.run(async (ctx) => {
      return await ctx.db.insert("workflowConfigs", {
        organizationId,
        workflowType: "accession",
        steps: [{ stepNumber: 1, roleId, name: "Step 1" }],
        canInitiateRoles: [roleId],
      });
    });

    // #when #then
    await expect(
      t.mutation(api.workflows.remove, {
        id: configId,
      }),
    ).rejects.toThrow("Not authenticated");
  });
});
