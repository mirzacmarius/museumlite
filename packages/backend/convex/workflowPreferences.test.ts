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

  const mediaStorageId = await t.run(async (ctx) => {
    return await ctx.storage.store(
      new Blob([new Uint8Array([0xff])], { type: "image/jpeg" }),
    );
  });

  const accessionId = await asUser.mutation(api.accessions.upsertObjectDraft, {
    organizationId,
    saveMode: "submit",
    objectData: {
      accessionNumber: "AUTO-1",
      title: "Auto published object",
    },
    draftMedia: [
      {
        storageId: mediaStorageId,
        fileName: "front.jpg",
        fileSize: 1,
        mimeType: "image/jpeg",
        mediaCategory: "image",
        isPrimary: false,
      },
    ],
  });

  const result = await t.run(async (ctx) => {
    const accession = await ctx.db.get(accessionId);
    const collection = await ctx.db
      .query("collections")
      .withIndex("by_organization_and_accessionNumber", (q) =>
        q.eq("organizationId", organizationId).eq("accessionNumber", "AUTO-1"),
      )
      .first();
    const media = collection
      ? await ctx.db
          .query("mediaFiles")
          .withIndex("by_collection", (q) =>
            q.eq("collectionId", collection._id),
          )
          .first()
      : null;
    const usageCounter = await ctx.db
      .query("organizationUsageCounters")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", organizationId),
      )
      .unique();
    return { accession, collection, media, usageCounter };
  });

  expect(result.accession?.status).toBe("approved");
  expect(result.accession?.workflowStep).toBeUndefined();
  expect(result.collection?.title).toBe("Auto published object");
  expect(result.collection?.status).toBe("active");
  expect(result.media?.fileName).toBe("front.jpg");
  expect(result.media?.fileType).toBe("image");
  expect(result.media?.mediaCategory).toBe("image");
  expect(result.media?.isPrimary).toBe(false);
  expect(result.media?.uploadStatus).toBe("completed");
  expect(result.usageCounter?.objectCount).toBe(1);
  expect(result.usageCounter?.mediaFileCount).toBe(1);
  expect(result.usageCounter?.mediaByType.image.count).toBe(1);
  expect(result.usageCounter?.mediaByType.image.bytes).toBe(1);
  expect(result.usageCounter?.storageBytes).toBe(1);
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
