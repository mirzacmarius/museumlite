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
  const [organizationId, userId] = await Promise.all([
    t.run(async (ctx) => {
      return await ctx.db.insert("organizations", {
        name: "Workflow Test Org",
        slug: `workflow-org-${Math.random().toString(36).slice(2, 8)}`,
        type: "museum",
        settings: {
          enabledModules: ["fine_art", "accounts"],
        },
      });
    }),
    t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        name: "Workflow User",
        email: `workflow-${Math.random().toString(36).slice(2, 8)}@test.dev`,
      });
    }),
  ]);
  const [roleId, permissionIds] = await Promise.all([
    t.run(async (ctx) => {
      return await ctx.db.insert("roles", {
        organizationId,
        name: roleName,
        isSystemRole: true,
      });
    }),
    Promise.all(
      [...new Set(permissionNames)].map((permissionName) =>
        t.run(async (ctx) => {
          return await ctx.db.insert("permissions", {
            name: permissionName,
            category: getPermissionCategory(permissionName),
          });
        }),
      ),
    ),
  ]);
  await Promise.all(
    permissionIds.map((permissionId) =>
      t.run(async (ctx) => {
        await ctx.db.insert("rolePermissions", {
          roleId,
          permissionId,
        });
      }),
    ),
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
// State Transition Validation Tests
// ============================================

describe("Epic 24: State Transition Validation", () => {
  test("allows valid sequential transition (step 1 → 2)", async () => {
    // #given
    const t = convexTest(schema, modules);
    const { organizationId, roleId } = await createOrgWithRole(t, [
      "organization.manage_settings",
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
      "organization.manage_settings",
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
      "organization.manage_settings",
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
      "organization.manage_settings",
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
    expect(result.reason).toContain("Allowed: 2");
  });

  test("allows all transitions when no workflow config exists", async () => {
    // #given
    const t = convexTest(schema, modules);
    const { organizationId } = await createOrgWithRole(t, [
      "organization.manage_settings",
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
});

// ============================================
// Multi-Approver Logic Tests
// ============================================

describe("Epic 24: Multi-Approver Logic", () => {
  test("single approval mode marks step as fully approved after one approval", async () => {
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
    expect(status.isFullyApproved).toBe(true);
    expect(status.userHasApproved).toBe(true);
  });

  test("multi approval mode requires threshold before fully approved", async () => {
    // #given
    const t = convexTest(schema, modules);
    const [{ organizationId, userId, roleId }, userId2] = await Promise.all([
      createOrgWithRole(t, ["organization.manage_settings"]),
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

  test("rejects duplicate approval from same user", async () => {
    // #given
    const t = convexTest(schema, modules);
    const { organizationId, userId } = await createOrgWithRole(t, [
      "organization.manage_settings",
    ]);

    await t.run(async (ctx) => {
      await ctx.db.insert("workflowStepApprovals", {
        organizationId,
        workflowType: "accession",
        entityId: "dup-test-entity",
        stepNumber: 1,
        approvedBy: userId,
        approvedAt: Date.now(),
      });
    });

    // #when / #then
    await expect(
      t.run(async (ctx) => {
        return await ctx.runMutation(internal.workflows.recordStepApproval, {
          organizationId,
          workflowType: "accession",
          entityId: "dup-test-entity",
          stepNumber: 1,
          approvedBy: userId,
        });
      }),
    ).rejects.toThrow("User has already approved this step");
  });

  test("clearStepApprovals retains original votes for review", async () => {
    // #given
    const t = convexTest(schema, modules);
    const [{ organizationId, userId }, userId2] = await Promise.all([
      createOrgWithRole(t, [
        "organization.manage_settings",
        "collections.read",
      ]),
      t.run(async (ctx) => {
        return await ctx.db.insert("users", {
          name: "Another User",
          email: `another-${Math.random().toString(36).slice(2, 8)}@test.dev`,
        });
      }),
    ]);
    await t.run(async (ctx) => {
      await ctx.db.insert("workflowStepApprovals", {
        organizationId,
        workflowType: "accession",
        entityId: "clear-test-entity",
        stepNumber: 1,
        approvedBy: userId,
        approvedAt: Date.now(),
      });
      await ctx.db.insert("workflowStepApprovals", {
        organizationId,
        workflowType: "accession",
        entityId: "clear-test-entity",
        stepNumber: 1,
        approvedBy: userId2,
        approvedAt: Date.now(),
      });
    });

    // #when
    await t.run(async (ctx) => {
      return await ctx.runMutation(internal.workflows.clearStepApprovals, {
        workflowType: "accession",
        entityId: "clear-test-entity",
        stepNumber: 1,
      });
    });

    // #then
    const retained = await t
      .withIdentity({
        subject: `${userId}|retained-votes`,
        issuer: "https://example.test",
      })
      .query(api.workflows.listRetainedApprovals, {
        organizationId,
        paginationOpts: { numItems: 25, cursor: null },
      });
    expect(retained.page).toHaveLength(2);
    expect(retained.page.every((vote) => vote.clearedAt !== null)).toBe(true);
    expect(retained.page.map((vote) => vote.approvedBy)).toEqual(
      expect.arrayContaining([userId, userId2]),
    );
  });
});

// ============================================
// Workflow Templates Tests
// ============================================

describe("Epic 24: Workflow Templates", () => {
  test("listTemplates returns templates filtered by workflow type", async () => {
    // #given
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      await ctx.db.insert("workflowTemplates", {
        name: "Accession Template",
        workflowType: "accession",
        isSystem: true,
        steps: [{ stepNumber: 1, name: "Review", roleName: "Admin" }],
        createdAt: Date.now(),
      });
      await ctx.db.insert("workflowTemplates", {
        name: "Loan Template",
        workflowType: "loan",
        isSystem: true,
        steps: [{ stepNumber: 1, name: "Review", roleName: "Admin" }],
        createdAt: Date.now(),
      });
    });

    // #when
    const [accessionTemplates, loanTemplates] = await Promise.all([
      t.query(api.workflows.listTemplates, {
        workflowType: "accession",
      }),
      t.query(api.workflows.listTemplates, {
        workflowType: "loan",
      }),
    ]);
    // #then
    expect(accessionTemplates.length).toBe(1);
    expect(accessionTemplates[0]?.name).toBe("Accession Template");
    expect(loanTemplates.length).toBe(1);
    expect(loanTemplates[0]?.name).toBe("Loan Template");
  });

  test("applyTemplateToOrganization maps role names to role IDs", async () => {
    // #given
    const t = convexTest(schema, modules);
    const { organizationId, userId, roleId } = await createOrgWithRole(
      t,
      ["organization.manage_settings"],
      "Admin",
    );

    const [curatorRoleId, templateId] = await Promise.all([
      t.run(async (ctx) => {
        return await ctx.db.insert("roles", {
          organizationId,
          name: "Curator",
          isSystemRole: false,
        });
      }),
      t.run(async (ctx) => {
        return await ctx.db.insert("workflowTemplates", {
          name: "Two-Step Template",
          workflowType: "accession",
          isSystem: true,
          steps: [
            { stepNumber: 1, name: "Curator Review", roleName: "Curator" },
            { stepNumber: 2, name: "Director Approval", roleName: "Admin" },
          ],
          createdAt: Date.now(),
        });
      }),
    ]);
    // #when
    const authed = t.withIdentity({
      subject: `${userId}|session-template`,
      issuer: "https://example.test",
    });

    const configId = await authed.mutation(
      api.workflows.applyTemplateToOrganization,
      {
        organizationId,
        templateId,
      },
    );

    // #then
    const config = await t.run(async (ctx) => {
      return await ctx.db.get(configId);
    });

    expect(config).not.toBeNull();
    expect(config?.steps.length).toBe(2);
    expect(config?.steps[0]?.roleId).toBe(curatorRoleId);
    expect(config?.steps[1]?.roleId).toBe(roleId);
    expect(config?.templateId).toBe(templateId);
  });

  test("applyTemplateToOrganization throws if role not found", async () => {
    // #given
    const t = convexTest(schema, modules);
    const [{ organizationId, userId }, templateId] = await Promise.all([
      createOrgWithRole(t, ["organization.manage_settings"], "Admin"),
      t.run(async (ctx) => {
        return await ctx.db.insert("workflowTemplates", {
          name: "Missing Role Template",
          workflowType: "accession",
          isSystem: true,
          steps: [
            { stepNumber: 1, name: "Review", roleName: "NonExistentRole" },
          ],
          createdAt: Date.now(),
        });
      }),
    ]);
    // #when / #then
    const authed = t.withIdentity({
      subject: `${userId}|session-missing-role`,
      issuer: "https://example.test",
    });

    await expect(
      authed.mutation(api.workflows.applyTemplateToOrganization, {
        organizationId,
        templateId,
      }),
    ).rejects.toThrow('Role "NonExistentRole" not found in organization');
  });
});

// ============================================
// Workflow History Tests
// ============================================

describe("Epic 24: Workflow History", () => {
  test("recordWorkflowHistory creates history entry", async () => {
    // #given
    const t = convexTest(schema, modules);
    const { organizationId, userId } = await createOrgWithRole(t, [
      "collections.read",
    ]);

    // #when
    const historyId = await t.run(async (ctx) => {
      return await ctx.runMutation(internal.workflows.recordWorkflowHistory, {
        organizationId,
        workflowType: "accession",
        entityId: "acc-history-test",
        fromStep: 1,
        toStep: 2,
        action: "approved",
        performedBy: userId,
        comment: "Looks good",
      });
    });

    // #then
    const history = await t.run(async (ctx) => {
      return await ctx.db.get(historyId);
    });

    expect(history).not.toBeNull();
    expect(history?.workflowType).toBe("accession");
    expect(history?.entityId).toBe("acc-history-test");
    expect(history?.fromStep).toBe(1);
    expect(history?.toStep).toBe(2);
    expect(history?.action).toBe("approved");
    expect(history?.performedBy).toBe(userId);
    expect(history?.comment).toBe("Looks good");
  });

  test("getWorkflowHistoryForEntity returns newest history first", async () => {
    const t = convexTest(schema, modules);
    const { organizationId, userId } = await createOrgWithRole(t, [
      "loans.read",
    ]);

    const entityId = await t.run(async (ctx) => {
      await ctx.db.patch(organizationId, { subscriptionTier: "pro" });
      const loanId = await ctx.db.insert("loans", {
        organizationId,
        loanNumber: "WF-HIST-LOAN",
        type: "incoming",
        lenderBorrowerName: "History lender",
        startDate: Date.now(),
        status: "pending",
      });
      await ctx.db.insert("workflowHistory", {
        organizationId,
        workflowType: "loan",
        entityId: loanId,
        fromStep: 0,
        toStep: 1,
        action: "submitted",
        performedBy: userId,
        performedAt: Date.now() - 2000,
      });
      await ctx.db.insert("workflowHistory", {
        organizationId,
        workflowType: "loan",
        entityId: loanId,
        fromStep: 1,
        toStep: 2,
        action: "approved",
        performedBy: userId,
        performedAt: Date.now() - 1000,
      });
      await ctx.db.insert("workflowHistory", {
        organizationId,
        workflowType: "loan",
        entityId: "other-entity",
        fromStep: 0,
        toStep: 1,
        action: "submitted",
        performedBy: userId,
        performedAt: Date.now(),
      });
      return loanId;
    });

    const history = await t
      .withIdentity({ subject: `${userId}|session-1` })
      .query(api.workflows.getWorkflowHistoryForEntity, {
        workflowType: "loan",
        entityId,
      });

    expect(history.map((row) => row.action)).toEqual(["approved", "submitted"]);
  });

  test("getWorkflowHistoryForEntity caps at 200 newest rows", async () => {
    const t = convexTest(schema, modules);
    const { organizationId, userId } = await createOrgWithRole(t, [
      "loans.read",
    ]);
    const comments = Array.from(
      { length: 201 },
      (_, index) => `h-${index + 1}`,
    );
    const entityId = await t.run(async (ctx) => {
      await ctx.db.patch(organizationId, { subscriptionTier: "pro" });
      const loanId = await ctx.db.insert("loans", {
        organizationId,
        loanNumber: "WF-HIST-CAP",
        type: "incoming",
        lenderBorrowerName: "History lender",
        startDate: Date.now(),
        status: "pending",
      });
      for (const comment of comments) {
        await ctx.db.insert("workflowHistory", {
          organizationId,
          workflowType: "loan",
          entityId: loanId,
          fromStep: 0,
          toStep: 1,
          action: "submitted",
          performedBy: userId,
          performedAt: Date.now(),
          comment,
        });
      }
      return loanId;
    });

    const history = await t
      .withIdentity({ subject: `${userId}|session-1` })
      .query(api.workflows.getWorkflowHistoryForEntity, {
        workflowType: "loan",
        entityId,
      });

    expect(history.map((row) => row.comment)).toEqual(
      comments.slice(1).reverse(),
    );
  });

  test("acquisition history keeps the per-org loop because there is no entity table", async () => {
    const t = convexTest(schema, modules);
    const { organizationId, userId } = await createOrgWithRole(t, [
      "collections.read",
    ]);
    await t.run(async (ctx) => {
      await ctx.db.insert("workflowHistory", {
        organizationId,
        workflowType: "acquisition",
        entityId: "acq-no-table",
        fromStep: 0,
        toStep: 1,
        action: "submitted",
        performedBy: userId,
        performedAt: Date.now(),
        comment: "Acquisition row",
      });
    });
    const authed = t.withIdentity({ subject: `${userId}|session-1` });
    expect(
      await authed.query(api.workflows.getWorkflowHistoryForEntity, {
        workflowType: "acquisition",
        entityId: "acq-no-table",
      }),
    ).toEqual([
      expect.objectContaining({
        action: "submitted",
        comment: "Acquisition row",
      }),
    ]);
    expect(
      await authed.query(api.workflows.getWorkflowHistoryForEntity, {
        workflowType: "acquisition",
        entityId: "acq-missing",
      }),
    ).toEqual([]);
  });

  test("getWorkflowHistoryByUser returns user actions across entities", async () => {
    // #given
    const t = convexTest(schema, modules);
    const { organizationId, userId, roleId } = await createOrgWithRole(t, [
      "collections.read",
    ]);

    const otherUserId = await t.run(async (ctx) => {
      const id = await ctx.db.insert("users", {
        name: "Other User",
        email: `other-${Math.random().toString(36).slice(2, 8)}@test.dev`,
      });
      await ctx.db.insert("userOrganizations", {
        userId: id,
        organizationId,
        roleId,
        joinedAt: Date.now(),
      });
      return id;
    });

    await t.run(async (ctx) => {
      await ctx.db.insert("workflowHistory", {
        organizationId,
        workflowType: "accession",
        entityId: "entity-1",
        fromStep: 0,
        toStep: 1,
        action: "submitted",
        performedBy: userId,
        performedAt: Date.now(),
      });
      await ctx.db.insert("workflowHistory", {
        organizationId,
        workflowType: "accession",
        entityId: "entity-2",
        fromStep: 1,
        toStep: 2,
        action: "approved",
        performedBy: userId,
        performedAt: Date.now(),
      });
      await ctx.db.insert("workflowHistory", {
        organizationId,
        workflowType: "accession",
        entityId: "entity-3",
        fromStep: 0,
        toStep: 1,
        action: "submitted",
        performedBy: otherUserId,
        performedAt: Date.now(),
      });
    });

    // #when
    const authed = t.withIdentity({
      subject: `${userId}|session-history-user`,
      issuer: "https://example.test",
    });

    const history = await authed.query(api.workflows.getWorkflowHistoryByUser, {
      organizationId,
      userId,
    });

    // #then
    expect(history.length).toBe(2);
    expect(history.every((h) => h.entityId.startsWith("entity-"))).toBe(true);
  });
});
