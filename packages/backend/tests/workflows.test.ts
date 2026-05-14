import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api, internal } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import schema from "../convex/schema";
import { modules } from "./testSetup";

type OrgSetup = {
  organizationId: Id<"organizations">;
  userId: Id<"users">;
  roleId: Id<"roles">;
};

function authedForUser(t: ReturnType<typeof convexTest>, userId: Id<"users">) {
  return t.withIdentity({
    subject: `${userId}|session-1`,
    issuer: "https://example.test",
  });
}

function getPermissionCategory(permissionName: string) {
  const prefix = permissionName.split(".")[0];
  switch (prefix) {
    case "collections":
    case "loans":
    case "locations":
    case "sites":
    case "media":
    case "users":
    case "organization":
    case "accounts":
      return prefix;
    default:
      return "collections";
  }
}

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

  await Promise.all(
    [...new Set(permissionNames)].map(async (permissionName) => {
      const permissionId = await t.run(async (ctx) => {
        return await ctx.db.insert("permissions", {
          name: permissionName,
          category: getPermissionCategory(permissionName),
        });
      });

      await t.run(async (ctx) => {
        await ctx.db.insert("rolePermissions", {
          roleId,
          permissionId,
        });
      });
    }),
  );

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
    const { organizationId, userId } = await createOrgWithRole(t, [
      "organization.manage_settings",
    ]);

    // #when
    const authed = authedForUser(t, userId);
    const result = await authed.query(api.workflows.list, {
      organizationId,
    });

    // #then
    expect(result).toEqual([]);
  });

  test("list returns all workflow configs for an organization", async () => {
    // #given
    const t = convexTest(schema, modules);
    const { organizationId, userId, roleId } = await createOrgWithRole(t, [
      "organization.manage_settings",
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
    const authed = authedForUser(t, userId);
    const result = await authed.query(api.workflows.list, {
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
    const { organizationId, userId } = await createOrgWithRole(t, [
      "organization.manage_settings",
    ]);

    // #when
    const authed = authedForUser(t, userId);
    const result = await authed.query(api.workflows.get, {
      organizationId,
      workflowType: "accession",
    });

    // #then
    expect(result).toBeNull();
  });

  test("get returns workflow config when it exists", async () => {
    // #given
    const t = convexTest(schema, modules);
    const { organizationId, userId, roleId } = await createOrgWithRole(t, [
      "organization.manage_settings",
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
    const authed = authedForUser(t, userId);
    const result = await authed.query(api.workflows.get, {
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
      "organization.manage_settings",
    ]);

    // #when
    const authed = authedForUser(t, userId);
    const configId = await authed.mutation(api.workflows.upsert, {
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
      "organization.manage_settings",
    ]);

    const existingConfigId = await t.run(async (ctx) => {
      return await ctx.db.insert("workflowConfigs", {
        organizationId,
        workflowType: "accession",
        steps: [{ stepNumber: 1, roleId, name: "Old Step" }],
        canInitiateRoles: [roleId],
      });
    });

    // #when
    const authed = authedForUser(t, userId);
    const configId = await authed.mutation(api.workflows.upsert, {
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
      "organization.manage_settings",
    ]);

    const configId = await t.run(async (ctx) => {
      return await ctx.db.insert("workflowConfigs", {
        organizationId,
        workflowType: "accession",
        steps: [{ stepNumber: 1, roleId, name: "Step 1" }],
        canInitiateRoles: [roleId],
      });
    });

    // #when
    const authed = authedForUser(t, userId);
    await authed.mutation(api.workflows.remove, {
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
    const [{ userId }, fakeId] = await Promise.all([
      createOrgWithRole(t, ["organization.manage_settings"]),
      t.run(async (ctx) => {
        const organizationId = await ctx.db.insert("organizations", {
          name: "Temp Org",
          slug: `temp-org-${Math.random().toString(36).slice(2, 8)}`,
          type: "museum",
        });
        const roleId = await ctx.db.insert("roles", {
          organizationId,
          name: "Temp Role",
          isSystemRole: true,
        });
        const configId = await ctx.db.insert("workflowConfigs", {
          organizationId,
          workflowType: "accession",
          steps: [{ stepNumber: 1, roleId, name: "Temp Step" }],
          canInitiateRoles: [roleId],
        });
        await ctx.db.delete(configId);
        return configId;
      }),
    ]);
    // #when #then
    await expect(
      authedForUser(t, userId).mutation(api.workflows.remove, {
        id: fakeId,
      }),
    ).rejects.toThrow("Workflow config not found");
  });

  test("upsert requires authentication", async () => {
    // #given
    const t = convexTest(schema, modules);
    const { organizationId, roleId } = await createOrgWithRole(t, [
      "organization.manage_settings",
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
      "organization.manage_settings",
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

// ============================================
// State Transition Validation Tests
// ============================================

describe("State Transition Validation", () => {
  test("allows valid sequential transition (step 1 → 2)", async () => {
    // #given
    const t = convexTest(schema, modules);
    const { organizationId, roleId } = await createOrgWithRole(t, [
      "settings.read",
      "settings.update",
    ]);

    await t.run(async (ctx) => {
      await ctx.db.insert("workflowConfigs", {
        organizationId,
        workflowType: "accession",
        steps: [
          { stepNumber: 1, roleId, name: "Step 1" },
          { stepNumber: 2, roleId, name: "Step 2" },
        ],
        canInitiateRoles: [roleId],
      });
    });

    // #when
    const result = await t.run(async (ctx) => {
      return await ctx.runQuery(internal.workflows.validateTransition, {
        organizationId,
        workflowType: "accession",
        fromStep: 1,
        toStep: 2,
      });
    });

    // #then
    expect(result.valid).toBe(true);
  });

  test("rejects invalid skip transition (step 1 → 3) when not allowed", async () => {
    // #given
    const t = convexTest(schema, modules);
    const { organizationId, roleId } = await createOrgWithRole(t, [
      "settings.read",
      "settings.update",
    ]);

    await t.run(async (ctx) => {
      await ctx.db.insert("workflowConfigs", {
        organizationId,
        workflowType: "accession",
        steps: [
          { stepNumber: 1, roleId, name: "Step 1" },
          { stepNumber: 2, roleId, name: "Step 2" },
          { stepNumber: 3, roleId, name: "Step 3" },
        ],
        canInitiateRoles: [roleId],
      });
    });

    // #when
    const result = await t.run(async (ctx) => {
      return await ctx.runQuery(internal.workflows.validateTransition, {
        organizationId,
        workflowType: "accession",
        fromStep: 1,
        toStep: 3,
      });
    });

    // #then
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("Only sequential transitions allowed");
  });

  test("allows transition when specified in allowedNextSteps", async () => {
    // #given
    const t = convexTest(schema, modules);
    const { organizationId, roleId } = await createOrgWithRole(t, [
      "settings.read",
      "settings.update",
    ]);

    await t.run(async (ctx) => {
      await ctx.db.insert("workflowConfigs", {
        organizationId,
        workflowType: "accession",
        steps: [
          { stepNumber: 1, roleId, name: "Step 1", allowedNextSteps: [2, 3] },
          { stepNumber: 2, roleId, name: "Step 2" },
          { stepNumber: 3, roleId, name: "Step 3" },
        ],
        canInitiateRoles: [roleId],
      });
    });

    // #when
    const result = await t.run(async (ctx) => {
      return await ctx.runQuery(internal.workflows.validateTransition, {
        organizationId,
        workflowType: "accession",
        fromStep: 1,
        toStep: 3,
      });
    });

    // #then
    expect(result.valid).toBe(true);
  });

  test("rejects transition not in allowedNextSteps", async () => {
    // #given
    const t = convexTest(schema, modules);
    const { organizationId, roleId } = await createOrgWithRole(t, [
      "settings.read",
      "settings.update",
    ]);

    await t.run(async (ctx) => {
      await ctx.db.insert("workflowConfigs", {
        organizationId,
        workflowType: "accession",
        steps: [
          { stepNumber: 1, roleId, name: "Step 1", allowedNextSteps: [2] },
          { stepNumber: 2, roleId, name: "Step 2" },
          { stepNumber: 3, roleId, name: "Step 3" },
        ],
        canInitiateRoles: [roleId],
      });
    });

    // #when
    const result = await t.run(async (ctx) => {
      return await ctx.runQuery(internal.workflows.validateTransition, {
        organizationId,
        workflowType: "accession",
        fromStep: 1,
        toStep: 3,
      });
    });

    // #then
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("not allowed");
  });

  test("allows transition to -1 (complete) from any step", async () => {
    // #given
    const t = convexTest(schema, modules);
    const { organizationId, roleId } = await createOrgWithRole(t, [
      "settings.read",
      "settings.update",
    ]);

    await t.run(async (ctx) => {
      await ctx.db.insert("workflowConfigs", {
        organizationId,
        workflowType: "accession",
        steps: [
          { stepNumber: 1, roleId, name: "Step 1" },
          { stepNumber: 2, roleId, name: "Step 2" },
        ],
        canInitiateRoles: [roleId],
      });
    });

    // #when
    const result = await t.run(async (ctx) => {
      return await ctx.runQuery(internal.workflows.validateTransition, {
        organizationId,
        workflowType: "accession",
        fromStep: 1,
        toStep: -1,
      });
    });

    // #then
    expect(result.valid).toBe(true);
  });

  test("allows all transitions when no workflow config exists", async () => {
    // #given
    const t = convexTest(schema, modules);
    const { organizationId } = await createOrgWithRole(t, [
      "settings.read",
      "settings.update",
    ]);

    // #when
    const result = await t.run(async (ctx) => {
      return await ctx.runQuery(internal.workflows.validateTransition, {
        organizationId,
        workflowType: "accession",
        fromStep: 1,
        toStep: 5,
      });
    });

    // #then
    expect(result.valid).toBe(true);
    expect(result.reason).toContain("No workflow config");
  });

  test("rejects transition from non-existent step", async () => {
    // #given
    const t = convexTest(schema, modules);
    const { organizationId, roleId } = await createOrgWithRole(t, [
      "settings.read",
      "settings.update",
    ]);

    await t.run(async (ctx) => {
      await ctx.db.insert("workflowConfigs", {
        organizationId,
        workflowType: "accession",
        steps: [
          { stepNumber: 1, roleId, name: "Step 1" },
          { stepNumber: 2, roleId, name: "Step 2" },
        ],
        canInitiateRoles: [roleId],
      });
    });

    // #when
    const result = await t.run(async (ctx) => {
      return await ctx.runQuery(internal.workflows.validateTransition, {
        organizationId,
        workflowType: "accession",
        fromStep: 5,
        toStep: 2,
      });
    });

    // #then
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("not found in workflow config");
  });

  test("allows transition from step 0 to step 1 (workflow initiation)", async () => {
    // #given
    const t = convexTest(schema, modules);
    const { organizationId, roleId } = await createOrgWithRole(t, [
      "settings.read",
      "settings.update",
    ]);

    await t.run(async (ctx) => {
      await ctx.db.insert("workflowConfigs", {
        organizationId,
        workflowType: "accession",
        steps: [
          { stepNumber: 1, roleId, name: "Step 1" },
          { stepNumber: 2, roleId, name: "Step 2" },
        ],
        canInitiateRoles: [roleId],
      });
    });

    // #when
    const result = await t.run(async (ctx) => {
      return await ctx.runQuery(internal.workflows.validateTransition, {
        organizationId,
        workflowType: "accession",
        fromStep: 0,
        toStep: 1,
      });
    });

    // #then
    expect(result.valid).toBe(true);
  });
});

// ============================================
// Workflow Approval Modes Tests
// ============================================

describe("Workflow Approval Modes", () => {
  test("single approval mode marks as fully approved after one approval", async () => {
    // #given
    const t = convexTest(schema, modules);
    const { organizationId, userId, roleId } = await createOrgWithRole(t, [
      "settings.read",
    ]);

    await t.run(async (ctx) => {
      await ctx.db.insert("workflowConfigs", {
        organizationId,
        workflowType: "accession",
        steps: [
          { stepNumber: 1, roleId, name: "Step 1", approvalMode: "single" },
        ],
        canInitiateRoles: [roleId],
      });
    });

    await t.run(async (ctx) => {
      await ctx.db.insert("workflowStepApprovals", {
        organizationId,
        workflowType: "accession",
        entityId: "test-entity-123",
        stepNumber: 1,
        approvedBy: userId,
        approvedAt: Date.now(),
      });
    });

    // #when
    const status = await t.run(async (ctx) => {
      return await ctx.runQuery(internal.workflows.checkStepApprovalStatus, {
        organizationId,
        workflowType: "accession",
        entityId: "test-entity-123",
        stepNumber: 1,
        userId,
      });
    });

    // #then
    expect(status.approvalMode).toBe("single");
    expect(status.currentApprovals).toBe(1);
    expect(status.requiredApprovals).toBe(1);
    expect(status.isFullyApproved).toBe(true);
    expect(status.userHasApproved).toBe(true);
  });

  test("single approval mode defaults when approvalMode not specified", async () => {
    // #given
    const t = convexTest(schema, modules);
    const { organizationId, userId, roleId } = await createOrgWithRole(t, [
      "settings.read",
    ]);

    await t.run(async (ctx) => {
      await ctx.db.insert("workflowConfigs", {
        organizationId,
        workflowType: "loan",
        steps: [{ stepNumber: 1, roleId, name: "Review" }],
        canInitiateRoles: [roleId],
      });
    });

    await t.run(async (ctx) => {
      await ctx.db.insert("workflowStepApprovals", {
        organizationId,
        workflowType: "loan",
        entityId: "loan-entity-456",
        stepNumber: 1,
        approvedBy: userId,
        approvedAt: Date.now(),
      });
    });

    // #when
    const status = await t.run(async (ctx) => {
      return await ctx.runQuery(internal.workflows.checkStepApprovalStatus, {
        organizationId,
        workflowType: "loan",
        entityId: "loan-entity-456",
        stepNumber: 1,
        userId,
      });
    });

    // #then
    expect(status.approvalMode).toBe("single");
    expect(status.isFullyApproved).toBe(true);
  });

  test("multi approval mode requires threshold before fully approved", async () => {
    // #given
    const t = convexTest(schema, modules);
    const [{ organizationId, userId, roleId }, userId2] = await Promise.all([
      createOrgWithRole(t, ["settings.read"]),
      t.run(async (ctx) => {
        return await ctx.db.insert("users", {
          name: "Second User",
          email: `second-${Math.random().toString(36).slice(2, 8)}@test.dev`,
        });
      }),
    ]);
    await t.run(async (ctx) => {
      await ctx.db.insert("workflowConfigs", {
        organizationId,
        workflowType: "deaccession",
        steps: [
          {
            stepNumber: 1,
            roleId,
            name: "Committee Vote",
            approvalMode: "multi",
            requiredApprovals: 3,
          },
        ],
        canInitiateRoles: [roleId],
      });
    });

    await t.run(async (ctx) => {
      await ctx.db.insert("workflowStepApprovals", {
        organizationId,
        workflowType: "deaccession",
        entityId: "deacc-entity-123",
        stepNumber: 1,
        approvedBy: userId,
        approvedAt: Date.now(),
      });
      await ctx.db.insert("workflowStepApprovals", {
        organizationId,
        workflowType: "deaccession",
        entityId: "deacc-entity-123",
        stepNumber: 1,
        approvedBy: userId2,
        approvedAt: Date.now(),
      });
    });

    // #when
    const status = await t.run(async (ctx) => {
      return await ctx.runQuery(internal.workflows.checkStepApprovalStatus, {
        organizationId,
        workflowType: "deaccession",
        entityId: "deacc-entity-123",
        stepNumber: 1,
        userId,
      });
    });

    // #then
    expect(status.approvalMode).toBe("multi");
    expect(status.currentApprovals).toBe(2);
    expect(status.requiredApprovals).toBe(3);
    expect(status.isFullyApproved).toBe(false);
    expect(status.userHasApproved).toBe(true);
  });

  test("multi approval mode marks fully approved when threshold met", async () => {
    // #given
    const t = convexTest(schema, modules);
    const [{ organizationId, userId, roleId }, userId2, userId3] =
      await Promise.all([
        createOrgWithRole(t, ["settings.read"]),
        t.run(async (ctx) => {
          return await ctx.db.insert("users", {
            name: "Second User",
            email: `second-${Math.random().toString(36).slice(2, 8)}@test.dev`,
          });
        }),
        t.run(async (ctx) => {
          return await ctx.db.insert("users", {
            name: "Third User",
            email: `third-${Math.random().toString(36).slice(2, 8)}@test.dev`,
          });
        }),
      ]);
    await t.run(async (ctx) => {
      await ctx.db.insert("workflowConfigs", {
        organizationId,
        workflowType: "deaccession",
        steps: [
          {
            stepNumber: 1,
            roleId,
            name: "Committee Vote",
            approvalMode: "multi",
            requiredApprovals: 3,
          },
        ],
        canInitiateRoles: [roleId],
      });
    });

    await t.run(async (ctx) => {
      await ctx.db.insert("workflowStepApprovals", {
        organizationId,
        workflowType: "deaccession",
        entityId: "deacc-entity-456",
        stepNumber: 1,
        approvedBy: userId,
        approvedAt: Date.now(),
      });
      await ctx.db.insert("workflowStepApprovals", {
        organizationId,
        workflowType: "deaccession",
        entityId: "deacc-entity-456",
        stepNumber: 1,
        approvedBy: userId2,
        approvedAt: Date.now(),
      });
      await ctx.db.insert("workflowStepApprovals", {
        organizationId,
        workflowType: "deaccession",
        entityId: "deacc-entity-456",
        stepNumber: 1,
        approvedBy: userId3,
        approvedAt: Date.now(),
      });
    });

    // #when
    const status = await t.run(async (ctx) => {
      return await ctx.runQuery(internal.workflows.checkStepApprovalStatus, {
        organizationId,
        workflowType: "deaccession",
        entityId: "deacc-entity-456",
        stepNumber: 1,
        userId,
      });
    });

    // #then
    expect(status.approvalMode).toBe("multi");
    expect(status.currentApprovals).toBe(3);
    expect(status.requiredApprovals).toBe(3);
    expect(status.isFullyApproved).toBe(true);
    expect(status.userHasApproved).toBe(true);
  });

  test("unanimous approval mode requires all users with role to approve", async () => {
    // #given
    const t = convexTest(schema, modules);
    const { organizationId, userId, roleId } = await createOrgWithRole(t, [
      "settings.read",
    ]);

    const userId2 = await t.run(async (ctx) => {
      const newUserId = await ctx.db.insert("users", {
        name: "Second Reviewer",
        email: `reviewer2-${Math.random().toString(36).slice(2, 8)}@test.dev`,
      });

      await ctx.db.insert("userOrganizations", {
        userId: newUserId,
        organizationId,
        roleId,
        joinedAt: Date.now(),
      });

      return newUserId;
    });

    const userId3 = await t.run(async (ctx) => {
      const newUserId = await ctx.db.insert("users", {
        name: "Third Reviewer",
        email: `reviewer3-${Math.random().toString(36).slice(2, 8)}@test.dev`,
      });

      await ctx.db.insert("userOrganizations", {
        userId: newUserId,
        organizationId,
        roleId,
        joinedAt: Date.now(),
      });

      return newUserId;
    });

    await t.run(async (ctx) => {
      await ctx.db.insert("workflowConfigs", {
        organizationId,
        workflowType: "accession",
        steps: [
          {
            stepNumber: 1,
            roleId,
            name: "Board Approval",
            approvalMode: "unanimous",
          },
        ],
        canInitiateRoles: [roleId],
      });
    });

    await t.run(async (ctx) => {
      await ctx.db.insert("workflowStepApprovals", {
        organizationId,
        workflowType: "accession",
        entityId: "unanimous-entity-789",
        stepNumber: 1,
        approvedBy: userId,
        approvedAt: Date.now(),
      });
      await ctx.db.insert("workflowStepApprovals", {
        organizationId,
        workflowType: "accession",
        entityId: "unanimous-entity-789",
        stepNumber: 1,
        approvedBy: userId2,
        approvedAt: Date.now(),
      });
    });

    // #when
    const status = await t.run(async (ctx) => {
      return await ctx.runQuery(internal.workflows.checkStepApprovalStatus, {
        organizationId,
        workflowType: "accession",
        entityId: "unanimous-entity-789",
        stepNumber: 1,
        userId,
      });
    });

    // #then
    expect(status.approvalMode).toBe("unanimous");
    expect(status.currentApprovals).toBe(2);
    expect(status.requiredApprovals).toBe(3);
    expect(status.isFullyApproved).toBe(false);
    expect(status.userHasApproved).toBe(true);
  });

  test("unanimous approval mode marks fully approved when all users approve", async () => {
    // #given
    const t = convexTest(schema, modules);
    const { organizationId, userId, roleId } = await createOrgWithRole(t, [
      "settings.read",
    ]);

    const userId2 = await t.run(async (ctx) => {
      const newUserId = await ctx.db.insert("users", {
        name: "Second Board Member",
        email: `board2-${Math.random().toString(36).slice(2, 8)}@test.dev`,
      });

      await ctx.db.insert("userOrganizations", {
        userId: newUserId,
        organizationId,
        roleId,
        joinedAt: Date.now(),
      });

      return newUserId;
    });

    const userId3 = await t.run(async (ctx) => {
      const newUserId = await ctx.db.insert("users", {
        name: "Third Board Member",
        email: `board3-${Math.random().toString(36).slice(2, 8)}@test.dev`,
      });

      await ctx.db.insert("userOrganizations", {
        userId: newUserId,
        organizationId,
        roleId,
        joinedAt: Date.now(),
      });

      return newUserId;
    });

    await t.run(async (ctx) => {
      await ctx.db.insert("workflowConfigs", {
        organizationId,
        workflowType: "loan",
        steps: [
          {
            stepNumber: 1,
            roleId,
            name: "Board Vote",
            approvalMode: "unanimous",
          },
        ],
        canInitiateRoles: [roleId],
      });
    });

    await t.run(async (ctx) => {
      await ctx.db.insert("workflowStepApprovals", {
        organizationId,
        workflowType: "loan",
        entityId: "unanimous-loan-999",
        stepNumber: 1,
        approvedBy: userId,
        approvedAt: Date.now(),
      });
      await ctx.db.insert("workflowStepApprovals", {
        organizationId,
        workflowType: "loan",
        entityId: "unanimous-loan-999",
        stepNumber: 1,
        approvedBy: userId2,
        approvedAt: Date.now(),
      });
      await ctx.db.insert("workflowStepApprovals", {
        organizationId,
        workflowType: "loan",
        entityId: "unanimous-loan-999",
        stepNumber: 1,
        approvedBy: userId3,
        approvedAt: Date.now(),
      });
    });

    // #when
    const status = await t.run(async (ctx) => {
      return await ctx.runQuery(internal.workflows.checkStepApprovalStatus, {
        organizationId,
        workflowType: "loan",
        entityId: "unanimous-loan-999",
        stepNumber: 1,
        userId,
      });
    });

    // #then
    expect(status.approvalMode).toBe("unanimous");
    expect(status.currentApprovals).toBe(3);
    expect(status.requiredApprovals).toBe(3);
    expect(status.isFullyApproved).toBe(true);
    expect(status.userHasApproved).toBe(true);
  });

  test("checkStepApprovalStatus returns correct approvers list", async () => {
    // #given
    const t = convexTest(schema, modules);
    const [{ organizationId, userId, roleId }, userId2] = await Promise.all([
      createOrgWithRole(t, ["settings.read"]),
      t.run(async (ctx) => {
        return await ctx.db.insert("users", {
          name: "Approver Two",
          email: `approver2-${Math.random().toString(36).slice(2, 8)}@test.dev`,
        });
      }),
    ]);
    await t.run(async (ctx) => {
      await ctx.db.insert("workflowConfigs", {
        organizationId,
        workflowType: "accession",
        steps: [
          {
            stepNumber: 1,
            roleId,
            name: "Review",
            approvalMode: "multi",
            requiredApprovals: 2,
          },
        ],
        canInitiateRoles: [roleId],
      });
    });

    const approval1Time = Date.now();
    const approval2Time = Date.now() + 1000;

    await t.run(async (ctx) => {
      await ctx.db.insert("workflowStepApprovals", {
        organizationId,
        workflowType: "accession",
        entityId: "approvers-test-321",
        stepNumber: 1,
        approvedBy: userId,
        approvedAt: approval1Time,
      });
      await ctx.db.insert("workflowStepApprovals", {
        organizationId,
        workflowType: "accession",
        entityId: "approvers-test-321",
        stepNumber: 1,
        approvedBy: userId2,
        approvedAt: approval2Time,
      });
    });

    // #when
    const status = await t.run(async (ctx) => {
      return await ctx.runQuery(internal.workflows.checkStepApprovalStatus, {
        organizationId,
        workflowType: "accession",
        entityId: "approvers-test-321",
        stepNumber: 1,
        userId,
      });
    });

    // #then
    expect(status.approvers).toHaveLength(2);
    expect(status.approvers[0].userId).toBe(userId);
    expect(status.approvers[0].approvedAt).toBe(approval1Time);
    expect(status.approvers[1].userId).toBe(userId2);
    expect(status.approvers[1].approvedAt).toBe(approval2Time);
  });
});
