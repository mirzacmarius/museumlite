import { convexTest } from "convex-test";
import { expect, test } from "vitest";

import { modules } from "../tests/testSetup";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";

async function createCollectionsCreatorContext(settings: {
  accessionWorkflowEnabled?: boolean;
  deaccessionWorkflowEnabled?: boolean;
}) {
  const t = convexTest(schema, modules);

  const context = await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", { name: "Workflow User" });
    const organizationId = await ctx.db.insert("organizations", {
      name: "Workflow Preference Org",
      slug: `workflow-preference-org-${Math.random().toString(36).slice(2, 8)}`,
      type: "museum",
      settings,
    });

    const createPermissionId = await ctx.db.insert("permissions", {
      name: "collections.create",
      category: "collections",
      description: "Create collections",
    });
    const userRoleId = await ctx.db.insert("roles", {
      organizationId,
      name: "Cataloger",
      description: "Creates collection records",
      isSystemRole: false,
    });
    const approvalRoleId = await ctx.db.insert("roles", {
      organizationId,
      name: "Approver",
      description: "Approves workflow records",
      isSystemRole: false,
    });

    await ctx.db.insert("rolePermissions", {
      roleId: userRoleId,
      permissionId: createPermissionId,
    });
    await ctx.db.insert("userOrganizations", {
      userId,
      organizationId,
      roleId: userRoleId,
      joinedAt: Date.now(),
    });

    return { approvalRoleId, organizationId, userId };
  });

  return {
    t,
    asUser: t.withIdentity({ subject: context.userId }),
    ...context,
  };
}

test("disabled accession workflow publishes submitted object drafts immediately", async () => {
  const { asUser, organizationId, approvalRoleId, t } =
    await createCollectionsCreatorContext({
      accessionWorkflowEnabled: false,
    });

  await t.run(async (ctx) => {
    await ctx.db.insert("workflowConfigs", {
      organizationId,
      workflowType: "accession",
      steps: [{ stepNumber: 1, roleId: approvalRoleId, name: "Curator" }],
      canInitiateRoles: [],
    });
  });

  const accessionId = await asUser.mutation(api.accessions.upsertObjectDraft, {
    organizationId,
    saveMode: "submit",
    objectData: {
      accessionNumber: "AUTO-1",
      title: "Auto published object",
    },
  });

  const result = await t.run(async (ctx) => {
    const accession = await ctx.db.get(accessionId);
    const collection = await ctx.db
      .query("collections")
      .withIndex("by_organization_and_accessionNumber", (q) =>
        q.eq("organizationId", organizationId).eq("accessionNumber", "AUTO-1"),
      )
      .first();
    return { accession, collection };
  });

  expect(result.accession?.status).toBe("approved");
  expect(result.accession?.workflowStep).toBeUndefined();
  expect(result.collection?.title).toBe("Auto published object");
  expect(result.collection?.status).toBe("active");
});

test("disabled deaccession workflow applies the collection disposition immediately", async () => {
  const { asUser, organizationId, approvalRoleId, t, userId } =
    await createCollectionsCreatorContext({
      deaccessionWorkflowEnabled: false,
    });

  const collectionId = await t.run(async (ctx) => {
    await ctx.db.insert("workflowConfigs", {
      organizationId,
      workflowType: "deaccession",
      steps: [{ stepNumber: 1, roleId: approvalRoleId, name: "Admin" }],
      canInitiateRoles: [],
    });

    return await ctx.db.insert("collections", {
      organizationId,
      accessionNumber: "DEACC-1",
      title: "Object to deaccession",
      status: "active",
      catalogedBy: userId,
      catalogedAt: Date.now(),
    });
  });

  const deaccessionId = await asUser.mutation(api.deaccessions.create, {
    organizationId,
    collectionId,
    dateDeaccessioned: Date.now(),
    reason: "Duplicate object",
    method: "destruction",
  });

  const result = await t.run(async (ctx) => {
    const deaccession = await ctx.db.get(deaccessionId);
    const collection = await ctx.db.get(collectionId as Id<"collections">);
    return { collection, deaccession };
  });

  expect(result.deaccession?.status).toBe("approved");
  expect(result.deaccession?.workflowStep).toBeUndefined();
  expect(result.collection?.status).toBe("deaccessioned");
});
