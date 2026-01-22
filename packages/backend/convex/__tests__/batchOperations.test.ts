import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import schema from "../schema";
import { modules } from "./testSetup";

type TestSetup = {
  organizationId: Id<"organizations">;
  userId: Id<"users">;
  roleId: Id<"roles">;
};

async function createTestOrg(
  t: ReturnType<typeof convexTest>,
  permissions: string[] = [],
): Promise<TestSetup> {
  const organizationId = await t.run(async (ctx) => {
    return await ctx.db.insert("organizations", {
      name: "Batch Test Org",
      slug: `batch-org-${Math.random().toString(36).slice(2, 8)}`,
      type: "museum",
    });
  });

  const userId = await t.run(async (ctx) => {
    return await ctx.db.insert("users", {
      name: "Batch User",
      email: `batch-${Math.random().toString(36).slice(2, 8)}@test.dev`,
    });
  });

  const roleId = await t.run(async (ctx) => {
    return await ctx.db.insert("roles", {
      organizationId,
      name: "Test Role",
      isSystemRole: false,
    });
  });

  for (const permName of permissions) {
    const permissionId = await t.run(async (ctx) => {
      const existing = await ctx.db
        .query("permissions")
        .filter((q) => q.eq(q.field("name"), permName))
        .first();
      if (existing) return existing._id;
      return await ctx.db.insert("permissions", {
        name: permName,
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

async function createCollection(
  t: ReturnType<typeof convexTest>,
  organizationId: Id<"organizations">,
  userId: Id<"users">,
  title: string,
): Promise<Id<"collections">> {
  return await t.run(async (ctx) => {
    return await ctx.db.insert("collections", {
      organizationId,
      title,
      accessionNumber: `ACC-${Math.random().toString(36).slice(2, 8)}`,
      status: "active",
      catalogedBy: userId,
      catalogedAt: Date.now(),
    });
  });
}

describe("Batch Operations: cancelBatchJob", () => {
  test("cancels a pending batch job", async () => {
    // #given
    const t = convexTest(schema, modules);
    const { organizationId, userId } = await createTestOrg(t, [
      "collections.update",
    ]);

    const jobId = await t.run(async (ctx) => {
      return await ctx.db.insert("batchJobs", {
        organizationId,
        jobType: "bulk_edit",
        targetIds: [],
        totalItems: 10,
        processedItems: 0,
        successCount: 0,
        failureCount: 0,
        status: "pending",
        createdBy: userId,
        createdAt: Date.now(),
      });
    });

    // #when
    const authed = t.withIdentity({
      subject: `${userId}|session-cancel`,
      issuer: "https://example.test",
    });

    await authed.mutation(api.batchOperations.cancelBatchJob, { jobId });

    // #then
    const job = await t.run(async (ctx) => ctx.db.get(jobId));
    expect(job?.status).toBe("cancelled");
    expect(job?.completedAt).toBeDefined();
  });

  test("cannot cancel completed job", async () => {
    // #given
    const t = convexTest(schema, modules);
    const { organizationId, userId } = await createTestOrg(t, [
      "collections.update",
    ]);

    const jobId = await t.run(async (ctx) => {
      return await ctx.db.insert("batchJobs", {
        organizationId,
        jobType: "bulk_edit",
        targetIds: [],
        totalItems: 10,
        processedItems: 10,
        successCount: 10,
        failureCount: 0,
        status: "completed",
        createdBy: userId,
        createdAt: Date.now(),
        completedAt: Date.now(),
      });
    });

    // #when
    const authed = t.withIdentity({
      subject: `${userId}|session-cancel-completed`,
      issuer: "https://example.test",
    });

    // #then
    await expect(
      authed.mutation(api.batchOperations.cancelBatchJob, { jobId }),
    ).rejects.toThrow("Cannot cancel completed or failed job");
  });
});

describe("Batch Operations: quickBulkEdit", () => {
  test("edits multiple collections synchronously", async () => {
    // #given
    const t = convexTest(schema, modules);
    const { organizationId, userId } = await createTestOrg(t, [
      "collections.update",
    ]);

    const col1 = await createCollection(t, organizationId, userId, "Item 1");
    const col2 = await createCollection(t, organizationId, userId, "Item 2");

    // #when
    const authed = t.withIdentity({
      subject: `${userId}|session-quick-edit`,
      issuer: "https://example.test",
    });

    const result = await authed.mutation(api.batchOperations.quickBulkEdit, {
      organizationId,
      collectionIds: [col1, col2],
      updates: {
        condition: "Good",
        isPubliclyVisible: true,
      },
    });

    // #then
    expect(result.successCount).toBe(2);
    expect(result.failureCount).toBe(0);
    expect(result.errors).toEqual([]);

    const updated1 = await t.run(async (ctx) => ctx.db.get(col1));
    const updated2 = await t.run(async (ctx) => ctx.db.get(col2));
    expect(updated1?.condition).toBe("Good");
    expect(updated1?.isPubliclyVisible).toBe(true);
    expect(updated2?.condition).toBe("Good");
  });

  test("rejects batches larger than 20 items", async () => {
    // #given
    const t = convexTest(schema, modules);
    const { organizationId, userId } = await createTestOrg(t, [
      "collections.update",
    ]);

    const collectionIds: Id<"collections">[] = [];
    for (let i = 0; i < 21; i++) {
      collectionIds.push(
        await createCollection(t, organizationId, userId, `Item ${i}`),
      );
    }

    // #when
    const authed = t.withIdentity({
      subject: `${userId}|session-quick-edit-large`,
      issuer: "https://example.test",
    });

    // #then
    await expect(
      authed.mutation(api.batchOperations.quickBulkEdit, {
        organizationId,
        collectionIds,
        updates: { condition: "Good" },
      }),
    ).rejects.toThrow("Use createBulkEditJob for batches larger than 20 items");
  });

  test("returns empty result for empty array", async () => {
    // #given
    const t = convexTest(schema, modules);
    const { organizationId, userId } = await createTestOrg(t, [
      "collections.update",
    ]);

    // #when
    const authed = t.withIdentity({
      subject: `${userId}|session-quick-edit-empty`,
      issuer: "https://example.test",
    });

    const result = await authed.mutation(api.batchOperations.quickBulkEdit, {
      organizationId,
      collectionIds: [],
      updates: { condition: "Good" },
    });

    // #then
    expect(result.successCount).toBe(0);
    expect(result.failureCount).toBe(0);
    expect(result.errors).toEqual([]);
  });
});

describe("Batch Operations: quickBulkStatusChange", () => {
  test("changes status of multiple collections", async () => {
    // #given
    const t = convexTest(schema, modules);
    const { organizationId, userId } = await createTestOrg(t, [
      "collections.update",
    ]);

    const col1 = await createCollection(t, organizationId, userId, "Item 1");
    const col2 = await createCollection(t, organizationId, userId, "Item 2");

    // #when
    const authed = t.withIdentity({
      subject: `${userId}|session-status-change`,
      issuer: "https://example.test",
    });

    const result = await authed.mutation(
      api.batchOperations.quickBulkStatusChange,
      {
        organizationId,
        collectionIds: [col1, col2],
        newStatus: "archived",
        reason: "Batch archive test",
      },
    );

    // #then
    expect(result.successCount).toBe(2);
    expect(result.failureCount).toBe(0);

    const archived1 = await t.run(async (ctx) => ctx.db.get(col1));
    expect(archived1?.status).toBe("archived");
    expect(archived1?.archivedReason).toBe("Batch archive test");
    expect(archived1?.archivedAt).toBeDefined();
  });

  test("requires delete permission for deleted status", async () => {
    // #given - only has update permission, not delete
    const t = convexTest(schema, modules);
    const { organizationId, userId } = await createTestOrg(t, [
      "collections.update",
    ]);

    const col1 = await createCollection(t, organizationId, userId, "Item 1");

    // #when
    const authed = t.withIdentity({
      subject: `${userId}|session-delete-no-perm`,
      issuer: "https://example.test",
    });

    // #then
    await expect(
      authed.mutation(api.batchOperations.quickBulkStatusChange, {
        organizationId,
        collectionIds: [col1],
        newStatus: "deleted",
      }),
    ).rejects.toThrow();
  });
});

describe("Batch Operations: getBatchJobStatus", () => {
  test("returns job status with progress percentage", async () => {
    // #given
    const t = convexTest(schema, modules);
    const { organizationId, userId } = await createTestOrg(t, [
      "collections.read",
    ]);

    const jobId = await t.run(async (ctx) => {
      return await ctx.db.insert("batchJobs", {
        organizationId,
        jobType: "bulk_edit",
        targetIds: [],
        totalItems: 100,
        processedItems: 50,
        successCount: 45,
        failureCount: 5,
        status: "processing",
        createdBy: userId,
        createdAt: Date.now(),
        startedAt: Date.now(),
      });
    });

    // #when
    const authed = t.withIdentity({
      subject: `${userId}|session-status`,
      issuer: "https://example.test",
    });

    const status = await authed.query(api.batchOperations.getBatchJobStatus, {
      jobId,
    });

    // #then
    expect(status).not.toBeNull();
    expect(status?.progress).toBe(50);
    expect(status?.processedItems).toBe(50);
    expect(status?.totalItems).toBe(100);
    expect(status?.successCount).toBe(45);
    expect(status?.failureCount).toBe(5);
    expect(status?.status).toBe("processing");
  });

  test("calculates progress correctly at 0%", async () => {
    // #given
    const t = convexTest(schema, modules);
    const { organizationId, userId } = await createTestOrg(t, [
      "collections.read",
    ]);

    const jobId = await t.run(async (ctx) => {
      return await ctx.db.insert("batchJobs", {
        organizationId,
        jobType: "bulk_edit",
        targetIds: [],
        totalItems: 100,
        processedItems: 0,
        successCount: 0,
        failureCount: 0,
        status: "pending",
        createdBy: userId,
        createdAt: Date.now(),
      });
    });

    // #when
    const authed = t.withIdentity({
      subject: `${userId}|session-status-zero`,
      issuer: "https://example.test",
    });

    const status = await authed.query(api.batchOperations.getBatchJobStatus, {
      jobId,
    });

    // #then
    expect(status?.progress).toBe(0);
  });
});

describe("Batch Operations: listBatchJobs", () => {
  test("lists jobs for organization", async () => {
    // #given
    const t = convexTest(schema, modules);
    const { organizationId, userId } = await createTestOrg(t, [
      "collections.read",
    ]);

    await t.run(async (ctx) => {
      await ctx.db.insert("batchJobs", {
        organizationId,
        jobType: "bulk_edit",
        targetIds: [],
        totalItems: 10,
        processedItems: 10,
        successCount: 10,
        failureCount: 0,
        status: "completed",
        createdBy: userId,
        createdAt: Date.now() - 1000,
        completedAt: Date.now(),
      });
      await ctx.db.insert("batchJobs", {
        organizationId,
        jobType: "bulk_move",
        targetIds: [],
        totalItems: 5,
        processedItems: 5,
        successCount: 3,
        failureCount: 2,
        status: "completed",
        createdBy: userId,
        createdAt: Date.now(),
        completedAt: Date.now(),
      });
    });

    // #when
    const authed = t.withIdentity({
      subject: `${userId}|session-list`,
      issuer: "https://example.test",
    });

    const jobs = await authed.query(api.batchOperations.listBatchJobs, {
      organizationId,
    });

    // #then
    expect(jobs.length).toBe(2);
    expect(jobs[0]?.jobType).toBe("bulk_move");
    expect(jobs[1]?.jobType).toBe("bulk_edit");
  });

  test("filters by status", async () => {
    // #given
    const t = convexTest(schema, modules);
    const { organizationId, userId } = await createTestOrg(t, [
      "collections.read",
    ]);

    await t.run(async (ctx) => {
      await ctx.db.insert("batchJobs", {
        organizationId,
        jobType: "bulk_edit",
        targetIds: [],
        totalItems: 10,
        processedItems: 10,
        successCount: 10,
        failureCount: 0,
        status: "completed",
        createdBy: userId,
        createdAt: Date.now(),
      });
      await ctx.db.insert("batchJobs", {
        organizationId,
        jobType: "bulk_move",
        targetIds: [],
        totalItems: 5,
        processedItems: 0,
        successCount: 0,
        failureCount: 0,
        status: "pending",
        createdBy: userId,
        createdAt: Date.now(),
      });
    });

    // #when
    const authed = t.withIdentity({
      subject: `${userId}|session-list-filter`,
      issuer: "https://example.test",
    });

    const pendingJobs = await authed.query(api.batchOperations.listBatchJobs, {
      organizationId,
      status: "pending",
    });

    // #then
    expect(pendingJobs.length).toBe(1);
    expect(pendingJobs[0]?.status).toBe("pending");
  });
});

describe("Batch Operations: bulkAddTags", () => {
  test("adds tags to multiple collections", async () => {
    // #given
    const t = convexTest(schema, modules);
    const { organizationId, userId } = await createTestOrg(t, [
      "collections.update",
    ]);

    const col1 = await createCollection(t, organizationId, userId, "Item 1");
    const col2 = await createCollection(t, organizationId, userId, "Item 2");

    // #when
    const authed = t.withIdentity({
      subject: `${userId}|session-add-tags`,
      issuer: "https://example.test",
    });

    const result = await authed.mutation(api.batchOperations.bulkAddTags, {
      organizationId,
      collectionIds: [col1, col2],
      tags: ["important", "featured"],
    });

    // #then
    expect(result.successCount).toBe(2);
    expect(result.failureCount).toBe(0);

    const updated1 = await t.run(async (ctx) => ctx.db.get(col1));
    expect(updated1?.tags).toContain("important");
    expect(updated1?.tags).toContain("featured");
  });
});

describe("Batch Operations: bulkRemoveTags", () => {
  test("removes tags from multiple collections", async () => {
    // #given
    const t = convexTest(schema, modules);
    const { organizationId, userId } = await createTestOrg(t, [
      "collections.update",
    ]);

    const col1 = await t.run(async (ctx) => {
      return await ctx.db.insert("collections", {
        organizationId,
        title: "Tagged Item",
        accessionNumber: `ACC-${Math.random().toString(36).slice(2, 8)}`,
        status: "active",
        tags: ["remove-me", "keep-me"],
        catalogedBy: userId,
        catalogedAt: Date.now(),
      });
    });

    // #when
    const authed = t.withIdentity({
      subject: `${userId}|session-remove-tags`,
      issuer: "https://example.test",
    });

    const result = await authed.mutation(api.batchOperations.bulkRemoveTags, {
      organizationId,
      collectionIds: [col1],
      tags: ["remove-me"],
    });

    // #then
    expect(result.successCount).toBe(1);

    const updated = await t.run(async (ctx) => ctx.db.get(col1));
    expect(updated?.tags).not.toContain("remove-me");
    expect(updated?.tags).toContain("keep-me");
  });
});
