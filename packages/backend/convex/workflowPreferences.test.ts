import { expect, test, vi } from "vitest";

import { createConvexTestWithRateLimiter } from "../tests/testHarness";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

async function createCollectionsCreatorContext(settings: {
  accessionWorkflowEnabled?: boolean;
  deaccessionWorkflowEnabled?: boolean;
}) {
  const t = createConvexTestWithRateLimiter();

  const context = await t.run(async (ctx) => {
    const [userId, organizationId, createPermissionId] = await Promise.all([
      ctx.db.insert("users", { name: "Workflow User" }),
      ctx.db.insert("organizations", {
        name: "Workflow Preference Org",
        slug: `workflow-preference-org-${Math.random().toString(36).slice(2, 8)}`,
        type: "museum",
        settings,
      }),
      ctx.db.insert("permissions", {
        name: "collections.create",
        category: "collections",
        description: "Create collections",
      }),
    ]);
    const [userRoleId, approvalRoleId] = await Promise.all([
      ctx.db.insert("roles", {
        organizationId,
        name: "Cataloger",
        description: "Creates collection records",
        isSystemRole: false,
      }),
      ctx.db.insert("roles", {
        organizationId,
        name: "Approver",
        description: "Approves workflow records",
        isSystemRole: false,
      }),
    ]);
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

  const uploadUrl = new URL(
    await asUser.mutation(api.users.generateUploadUrl, {
      organizationId,
      mimeType: "image/jpeg",
    }),
  );
  const uploadResponse = await t.fetch(uploadUrl.pathname + uploadUrl.search, {
    method: "POST",
    headers: { "Content-Type": "image/jpeg" },
    body: new Blob([new Uint8Array([0xff])], { type: "image/jpeg" }),
  });
  expect(uploadResponse.status).toBe(200);
  const {
    storageId: mediaStorageId,
  }: { storageId: import("./_generated/dataModel").Id<"_storage"> } =
    await uploadResponse.json();

  // Publishing makes the image primary; fake timers keep its thumbnail job queued.
  vi.useFakeTimers();
  const accessionId = await asUser
    .mutation(api.accessions.upsertObjectDraft, {
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
    })
    .finally(() => vi.useRealTimers());

  const result = await t.run(async (ctx) => {
    const [accession, collection] = await Promise.all([
      ctx.db.get(accessionId),
      ctx.db
        .query("collections")
        .withIndex("by_organization_and_accessionNumber", (q) =>
          q
            .eq("organizationId", organizationId)
            .eq("accessionNumber", "AUTO-1"),
        )
        .first(),
    ]);
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
  expect(result.media?.isPrimary).toBe(true);
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
    disposition: "Witnessed destruction by contractor",
  });

  const result = await t.run(async (ctx) => {
    const [deaccession, collection] = await Promise.all([
      ctx.db.get(deaccessionId),
      ctx.db.get(collectionId as Id<"collections">),
    ]);
    return { collection, deaccession };
  });

  expect(result.deaccession?.status).toBe("approved");
  expect(result.deaccession?.workflowStep).toBeUndefined();
  expect(result.collection?.status).toBe("deaccessioned");
});
