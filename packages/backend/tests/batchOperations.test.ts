import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import type { Id } from "../convex/_generated/dataModel";
import schema from "../convex/schema";

import { modules } from "./testSetup";

describe("batchOperations schema", () => {
  test("should create batch job with correct structure", async () => {
    const t = convexTest(schema, modules);

    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", { email: "test@example.com" });
    });

    const orgId = await t.run(async (ctx) => {
      return await ctx.db.insert("organizations", {
        name: "Test Org",
        slug: "test-org",
        type: "museum",
      });
    });

    const collectionId = await t.run(async (ctx) => {
      return await ctx.db.insert("collections", {
        organizationId: orgId,
        accessionNumber: "2025.001",
        title: "Test Object",
        status: "active",
        catalogedBy: userId,
        catalogedAt: Date.now(),
      });
    });

    const jobId = await t.run(async (ctx) => {
      return await ctx.db.insert("batchJobs", {
        organizationId: orgId,
        jobType: "bulk_edit",
        targetIds: [collectionId],
        totalItems: 1,
        editPayload: {
          condition: "good",
        },
        processedItems: 0,
        successCount: 0,
        failureCount: 0,
        status: "pending",
        createdBy: userId,
        createdAt: Date.now(),
      });
    });

    expect(jobId).toBeDefined();

    const job = await t.run(async (ctx) => {
      return await ctx.db.get(jobId);
    });

    expect(job).toBeDefined();
    expect(job?.jobType).toBe("bulk_edit");
    expect(job?.status).toBe("pending");
    expect(job?.totalItems).toBe(1);
  });

  test("should track job progress", async () => {
    const t = convexTest(schema, modules);

    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", { email: "test@example.com" });
    });

    const orgId = await t.run(async (ctx) => {
      return await ctx.db.insert("organizations", {
        name: "Test Org",
        slug: "test-org",
        type: "museum",
      });
    });

    const collectionIds = await t.run(async (ctx) => {
      const ids: Id<"collections">[] = [];
      for (let i = 0; i < 5; i++) {
        const id = await ctx.db.insert("collections", {
          organizationId: orgId,
          accessionNumber: `2025.00${i + 1}`,
          title: `Test Object ${i + 1}`,
          status: "active",
          catalogedBy: userId,
          catalogedAt: Date.now(),
        });
        ids.push(id);
      }
      return ids;
    });

    const jobId = await t.run(async (ctx) => {
      return await ctx.db.insert("batchJobs", {
        organizationId: orgId,
        jobType: "bulk_move",
        targetIds: collectionIds,
        totalItems: 5,
        processedItems: 0,
        successCount: 0,
        failureCount: 0,
        status: "processing",
        createdBy: userId,
        createdAt: Date.now(),
        startedAt: Date.now(),
      });
    });

    const thirdCollectionId = collectionIds[2];
    if (!thirdCollectionId) throw new Error("Missing collection");

    await t.run(async (ctx) => {
      await ctx.db.patch(jobId, {
        processedItems: 3,
        successCount: 2,
        failureCount: 1,
        errors: [{ itemId: thirdCollectionId, error: "Location at capacity" }],
      });
    });

    const job = await t.run(async (ctx) => {
      return await ctx.db.get(jobId);
    });

    expect(job?.processedItems).toBe(3);
    expect(job?.successCount).toBe(2);
    expect(job?.failureCount).toBe(1);
    expect(job?.errors).toHaveLength(1);
  });

  test("should support bulk status change job", async () => {
    const t = convexTest(schema, modules);

    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", { email: "test@example.com" });
    });

    const orgId = await t.run(async (ctx) => {
      return await ctx.db.insert("organizations", {
        name: "Test Org",
        slug: "test-org",
        type: "museum",
      });
    });

    const collectionId = await t.run(async (ctx) => {
      return await ctx.db.insert("collections", {
        organizationId: orgId,
        accessionNumber: "2025.001",
        title: "Test Object",
        status: "active",
        catalogedBy: userId,
        catalogedAt: Date.now(),
      });
    });

    const jobId = await t.run(async (ctx) => {
      return await ctx.db.insert("batchJobs", {
        organizationId: orgId,
        jobType: "bulk_status_change",
        targetIds: [collectionId],
        totalItems: 1,
        statusPayload: {
          newStatus: "archived",
          reason: "Collection reorganization",
        },
        processedItems: 0,
        successCount: 0,
        failureCount: 0,
        status: "pending",
        createdBy: userId,
        createdAt: Date.now(),
      });
    });

    const job = await t.run(async (ctx) => {
      return await ctx.db.get(jobId);
    });

    expect(job?.jobType).toBe("bulk_status_change");
    expect(job?.statusPayload?.newStatus).toBe("archived");
    expect(job?.statusPayload?.reason).toBe("Collection reorganization");
  });

  test("should query jobs by organization and status", async () => {
    const t = convexTest(schema, modules);

    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", { email: "test@example.com" });
    });

    const orgId = await t.run(async (ctx) => {
      return await ctx.db.insert("organizations", {
        name: "Test Org",
        slug: "test-org",
        type: "museum",
      });
    });

    await t.run(async (ctx) => {
      await ctx.db.insert("batchJobs", {
        organizationId: orgId,
        jobType: "bulk_edit",
        targetIds: [],
        totalItems: 0,
        processedItems: 0,
        successCount: 0,
        failureCount: 0,
        status: "completed",
        createdBy: userId,
        createdAt: Date.now(),
      });
      await ctx.db.insert("batchJobs", {
        organizationId: orgId,
        jobType: "bulk_move",
        targetIds: [],
        totalItems: 0,
        processedItems: 0,
        successCount: 0,
        failureCount: 0,
        status: "processing",
        createdBy: userId,
        createdAt: Date.now(),
      });
    });

    const completedJobs = await t.run(async (ctx) => {
      return await ctx.db
        .query("batchJobs")
        .withIndex("by_organization_and_status", (q) =>
          q.eq("organizationId", orgId).eq("status", "completed"),
        )
        .collect();
    });

    expect(completedJobs).toHaveLength(1);
    expect(completedJobs[0]?.jobType).toBe("bulk_edit");

    const processingJobs = await t.run(async (ctx) => {
      return await ctx.db
        .query("batchJobs")
        .withIndex("by_organization_and_status", (q) =>
          q.eq("organizationId", orgId).eq("status", "processing"),
        )
        .collect();
    });

    expect(processingJobs).toHaveLength(1);
    expect(processingJobs[0]?.jobType).toBe("bulk_move");
  });
});
