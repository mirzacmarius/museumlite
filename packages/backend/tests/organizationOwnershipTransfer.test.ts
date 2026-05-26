import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
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

async function createHierarchyTransferFixture(t: ReturnType<typeof convexTest>) {
  const ownerUserId = await t.run(async (ctx) => {
    return await ctx.db.insert("users", {
      name: "Source Owner",
      email: `source-owner-${Math.random().toString(36).slice(2, 8)}@test.dev`,
    });
  });
  const secondSuperAdminUserId = await t.run(async (ctx) => {
    return await ctx.db.insert("users", {
      name: "Source SuperAdmin Two",
      email: `source-sa-two-${Math.random().toString(36).slice(2, 8)}@test.dev`,
    });
  });
  const newOwnerUserId = await t.run(async (ctx) => {
    return await ctx.db.insert("users", {
      name: "Target New Owner",
      email: `target-owner-${Math.random().toString(36).slice(2, 8)}@test.dev`,
    });
  });

  const targetOrganizationId = await t.run(async (ctx) => {
    return await ctx.db.insert("organizations", {
      name: "Target Parent Org",
      slug: `target-parent-${Math.random().toString(36).slice(2, 8)}`,
      type: "museum",
      subscriptionTier: "enterprise",
      ownerUserId: newOwnerUserId,
      allowsIncomingTransferRequests: true,
      isActive: true,
    });
  });

  const sourceOrganizationId = await t.run(async (ctx) => {
    return await ctx.db.insert("organizations", {
      name: "Source Child Org",
      slug: `source-child-${Math.random().toString(36).slice(2, 8)}`,
      type: "museum",
      subscriptionTier: "pro",
      ownerUserId,
      isActive: true,
    });
  });

  const { superAdminRoleId, targetMemberRoleId } = await t.run(async (ctx) => {
      const superAdminRoleId = await ctx.db.insert("roles", {
        organizationId: sourceOrganizationId,
        name: "super_admin",
        isSystemRole: true,
      });
      const targetMemberRoleId = await ctx.db.insert("roles", {
        organizationId: targetOrganizationId,
        name: "admin",
        isSystemRole: true,
      });
      const manageSettingsPermissionId = await ctx.db.insert("permissions", {
        name: "organization.manage_settings",
        category: "organization",
      });
      await ctx.db.insert("rolePermissions", {
        roleId: superAdminRoleId,
        permissionId: manageSettingsPermissionId,
      });
      return { superAdminRoleId, targetMemberRoleId, manageSettingsPermissionId };
    });

  await t.run(async (ctx) => {
    await ctx.db.insert("userOrganizations", {
      userId: ownerUserId,
      organizationId: sourceOrganizationId,
      roleId: superAdminRoleId,
      joinedAt: Date.now(),
    });
    await ctx.db.insert("userOrganizations", {
      userId: secondSuperAdminUserId,
      organizationId: sourceOrganizationId,
      roleId: superAdminRoleId,
      joinedAt: Date.now(),
    });
    await ctx.db.insert("userOrganizations", {
      userId: newOwnerUserId,
      organizationId: sourceOrganizationId,
      roleId: superAdminRoleId,
      joinedAt: Date.now(),
    });
    await ctx.db.insert("userOrganizations", {
      userId: newOwnerUserId,
      organizationId: targetOrganizationId,
      roleId: targetMemberRoleId,
      joinedAt: Date.now(),
    });
  });

  return {
    sourceOrganizationId,
    targetOrganizationId,
    ownerUserId,
    secondSuperAdminUserId,
    newOwnerUserId,
    superAdminRoleId,
  };
}

describe("organizationOwnershipTransfer", () => {
  test("multi-SuperAdmin transfer requires unanimous approval", async () => {
    const t = convexTest(schema, modules);
    const {
      sourceOrganizationId,
      targetOrganizationId,
      ownerUserId,
      secondSuperAdminUserId,
      newOwnerUserId,
    } = await createHierarchyTransferFixture(t);

    const ownerAuthed = authedForUser(t, ownerUserId);
    const secondAuthed = authedForUser(t, secondSuperAdminUserId);
    const newOwnerAuthed = authedForUser(t, newOwnerUserId);

    const pendingSummary = await ownerAuthed.mutation(
      api.organizationOwnershipTransfer.requestOwnershipTransfer,
      {
        organizationId: sourceOrganizationId,
        targetOrganizationId,
        newOwnerUserId,
      },
    );
    expect(pendingSummary.status).toBe("pending_super_admin_approval");

    const sourceBeforeApproval = await t.run(async (ctx) =>
      ctx.db.get(sourceOrganizationId),
    );
    expect(sourceBeforeApproval?.ownerUserId).toBe(ownerUserId);
    expect(sourceBeforeApproval?.parentOrganizationId).toBeUndefined();

    const partialSummary = await secondAuthed.mutation(
      api.organizationOwnershipTransfer.approveOwnershipTransfer,
      {
        requestId: pendingSummary.requestId,
      },
    );
    expect(partialSummary.status).toBe("pending_super_admin_approval");

    const completedSummary = await newOwnerAuthed.mutation(
      api.organizationOwnershipTransfer.approveOwnershipTransfer,
      {
        requestId: pendingSummary.requestId,
      },
    );
    expect(completedSummary.status).toBe("completed");

    const sourceAfterApproval = await t.run(async (ctx) =>
      ctx.db.get(sourceOrganizationId),
    );
    expect(sourceAfterApproval?.ownerUserId).toBe(newOwnerUserId);
    expect(sourceAfterApproval?.parentOrganizationId).toBe(targetOrganizationId);
    expect(sourceAfterApproval?.rootOrganizationId).toBe(targetOrganizationId);
  });

  test("rejects transfer when target organization does not accept requests", async () => {
    const t = convexTest(schema, modules);
    const {
      sourceOrganizationId,
      targetOrganizationId,
      ownerUserId,
      newOwnerUserId,
    } = await createHierarchyTransferFixture(t);

    await t.run(async (ctx) => {
      await ctx.db.patch(targetOrganizationId, {
        allowsIncomingTransferRequests: false,
      });
    });

    const ownerAuthed = authedForUser(t, ownerUserId);

    await expect(
      ownerAuthed.mutation(
        api.organizationOwnershipTransfer.requestOwnershipTransfer,
        {
          organizationId: sourceOrganizationId,
          targetOrganizationId,
          newOwnerUserId,
        },
      ),
    ).rejects.toThrow(/does not accept ownership transfers/);
  });

  test("rejects transfer when new owner is not a member of the target organization", async () => {
    const t = convexTest(schema, modules);
    const {
      sourceOrganizationId,
      targetOrganizationId,
      ownerUserId,
      newOwnerUserId,
    } = await createHierarchyTransferFixture(t);

    await t.run(async (ctx) => {
      const membership = await ctx.db
        .query("userOrganizations")
        .withIndex("by_user_and_organization", (q) =>
          q
            .eq("userId", newOwnerUserId)
            .eq("organizationId", targetOrganizationId),
        )
        .first();
      if (membership) {
        await ctx.db.delete(membership._id);
      }
    });

    const ownerAuthed = authedForUser(t, ownerUserId);

    await expect(
      ownerAuthed.mutation(
        api.organizationOwnershipTransfer.requestOwnershipTransfer,
        {
          organizationId: sourceOrganizationId,
          targetOrganizationId,
          newOwnerUserId,
        },
      ),
    ).rejects.toThrow(/member of the target organization/);
  });

  test("SuperAdmin can cancel a pending transfer request", async () => {
    const t = convexTest(schema, modules);
    const {
      sourceOrganizationId,
      targetOrganizationId,
      ownerUserId,
      newOwnerUserId,
    } = await createHierarchyTransferFixture(t);

    const ownerAuthed = authedForUser(t, ownerUserId);

    const pendingSummary = await ownerAuthed.mutation(
      api.organizationOwnershipTransfer.requestOwnershipTransfer,
      {
        organizationId: sourceOrganizationId,
        targetOrganizationId,
        newOwnerUserId,
      },
    );

    const cancelledSummary = await ownerAuthed.mutation(
      api.organizationOwnershipTransfer.cancelOwnershipTransfer,
      {
        requestId: pendingSummary.requestId,
      },
    );
    expect(cancelledSummary.status).toBe("cancelled");

    const pendingRequests = await ownerAuthed.query(
      api.organizationOwnershipTransfer.listPendingOwnershipTransfers,
      { organizationId: sourceOrganizationId },
    );
    expect(pendingRequests).toHaveLength(0);
  });
});
