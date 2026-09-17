import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  internalMutation,
  type MutationCtx,
  mutation,
  query,
} from "./_generated/server";
import { customFieldValue } from "./schema";
import {
  replaceCollectionOptionUsages,
  syncCollectionOptionUsages,
} from "./utils/collectionOptionUsages";
import { requirePermission } from "./utils/permissions";

// ============================================
// Constants
// ============================================

const BATCH_CHUNK_SIZE = 50; // Process items in chunks to avoid timeouts

async function assertCollectionsBelongToOrg(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
  collectionIds: Id<"collections">[],
): Promise<void> {
  const collections = await Promise.all(
    collectionIds.map((id) => ctx.db.get(id)),
  );
  for (const collection of collections) {
    if (!collection) {
      throw new Error("Some collections not found");
    }
    if (collection.organizationId !== organizationId) {
      throw new Error("Some collections do not belong to this organization");
    }
  }
}

// ============================================
// Batch Job Management
// ============================================

/**
 * Create a bulk edit job
 */
export const createBulkEditJob = mutation({
  args: {
    organizationId: v.id("organizations"),
    collectionIds: v.array(v.id("collections")),
    updates: v.object({
      collectionGroupId: v.optional(v.id("collectionGroups")),
      currentLocationId: v.optional(v.id("locations")),
      condition: v.optional(v.string()),
      displayStatus: v.optional(v.string()),
      isPubliclyVisible: v.optional(v.boolean()),
      isSearchable: v.optional(v.boolean()),
      tags: v.optional(v.array(v.string())),
      customFields: v.optional(v.record(v.string(), customFieldValue)),
    }),
  },
  returns: v.id("batchJobs"),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    if (args.collectionIds.length === 0) {
      throw new Error("No collections selected");
    }

    if (args.collectionIds.length > 1000) {
      throw new Error("Maximum 1000 items per batch operation");
    }

    await requirePermission(ctx, args.organizationId, "collections.update");

    await assertCollectionsBelongToOrg(
      ctx,
      args.organizationId,
      args.collectionIds,
    );

    const jobId = await ctx.db.insert("batchJobs", {
      organizationId: args.organizationId,
      jobType: "bulk_edit",
      targetIds: args.collectionIds,
      totalItems: args.collectionIds.length,
      editPayload: args.updates,
      processedItems: 0,
      successCount: 0,
      failureCount: 0,
      status: "pending",
      createdBy: userId,
      createdAt: Date.now(),
    });

    // Schedule processing
    await ctx.scheduler.runAfter(0, internal.batchOperations.processBatchJob, {
      jobId,
    });

    return jobId;
  },
});

/**
 * Create a bulk move job
 */
export const createBulkMoveJob = mutation({
  args: {
    organizationId: v.id("organizations"),
    collectionIds: v.array(v.id("collections")),
    toLocationId: v.id("locations"),
    reason: v.optional(v.string()),
    overrideCapacity: v.optional(v.boolean()),
    overrideStatus: v.optional(v.boolean()),
  },
  returns: v.id("batchJobs"),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    if (args.collectionIds.length === 0) {
      throw new Error("No collections selected");
    }

    if (args.collectionIds.length > 1000) {
      throw new Error("Maximum 1000 items per batch operation");
    }

    await requirePermission(ctx, args.organizationId, "locations.update");

    // Validate target location
    const toLocation = await ctx.db.get(args.toLocationId);
    if (!toLocation || toLocation.organizationId !== args.organizationId) {
      throw new Error("Invalid target location");
    }

    await assertCollectionsBelongToOrg(
      ctx,
      args.organizationId,
      args.collectionIds,
    );

    const jobId = await ctx.db.insert("batchJobs", {
      organizationId: args.organizationId,
      jobType: "bulk_move",
      targetIds: args.collectionIds,
      totalItems: args.collectionIds.length,
      movePayload: {
        toLocationId: args.toLocationId,
        reason: args.reason,
        overrideCapacity: args.overrideCapacity,
        overrideStatus: args.overrideStatus,
      },
      processedItems: 0,
      successCount: 0,
      failureCount: 0,
      status: "pending",
      createdBy: userId,
      createdAt: Date.now(),
    });

    // Schedule processing
    await ctx.scheduler.runAfter(0, internal.batchOperations.processBatchJob, {
      jobId,
    });

    return jobId;
  },
});

/**
 * Create a bulk status change job
 */
export const createBulkStatusChangeJob = mutation({
  args: {
    organizationId: v.id("organizations"),
    collectionIds: v.array(v.id("collections")),
    newStatus: v.union(
      v.literal("active"),
      v.literal("archived"),
      v.literal("deleted"),
    ),
    reason: v.optional(v.string()),
  },
  returns: v.id("batchJobs"),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    if (args.collectionIds.length === 0) {
      throw new Error("No collections selected");
    }

    if (args.collectionIds.length > 1000) {
      throw new Error("Maximum 1000 items per batch operation");
    }

    if (args.newStatus === "deleted") {
      await requirePermission(ctx, args.organizationId, "collections.delete");
    } else {
      await requirePermission(ctx, args.organizationId, "collections.update");
    }

    await assertCollectionsBelongToOrg(
      ctx,
      args.organizationId,
      args.collectionIds,
    );

    const jobId = await ctx.db.insert("batchJobs", {
      organizationId: args.organizationId,
      jobType: "bulk_status_change",
      targetIds: args.collectionIds,
      totalItems: args.collectionIds.length,
      statusPayload: {
        newStatus: args.newStatus,
        reason: args.reason,
      },
      processedItems: 0,
      successCount: 0,
      failureCount: 0,
      status: "pending",
      createdBy: userId,
      createdAt: Date.now(),
    });

    // Schedule processing
    await ctx.scheduler.runAfter(0, internal.batchOperations.processBatchJob, {
      jobId,
    });

    return jobId;
  },
});

/**
 * Cancel a batch job
 */
export const cancelBatchJob = mutation({
  args: {
    jobId: v.id("batchJobs"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const [userId, job] = await Promise.all([
      getAuthUserId(ctx),
      ctx.db.get(args.jobId),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    if (!job) {
      throw new Error("Job not found");
    }

    if (job.status === "completed" || job.status === "failed") {
      throw new Error("Cannot cancel completed or failed job");
    }

    await requirePermission(ctx, job.organizationId, "collections.update");

    await ctx.db.patch(args.jobId, {
      status: "cancelled",
      completedAt: Date.now(),
    });

    return null;
  },
});

// ============================================
// Queries
// ============================================

/**
 * Get batch job status
 */
export const getBatchJobStatus = query({
  args: {
    jobId: v.id("batchJobs"),
  },
  returns: v.union(
    v.object({
      _id: v.id("batchJobs"),
      jobType: v.string(),
      status: v.string(),
      totalItems: v.number(),
      processedItems: v.number(),
      successCount: v.number(),
      failureCount: v.number(),
      errors: v.optional(
        v.array(
          v.object({
            itemId: v.id("collections"),
            error: v.string(),
          }),
        ),
      ),
      progress: v.number(),
      createdAt: v.number(),
      startedAt: v.optional(v.number()),
      completedAt: v.optional(v.number()),
      createdByName: v.optional(v.string()),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    if (!(await getAuthUserId(ctx))) {
      throw new Error("Not authenticated");
    }

    const job = await ctx.db.get(args.jobId);
    if (!job) {
      return null;
    }

    try {
      await requirePermission(ctx, job.organizationId, "collections.read");
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.startsWith("Permission denied")
      ) {
        return null;
      }
      throw error;
    }

    const createdBy = await ctx.db.get(job.createdBy);

    return {
      _id: job._id,
      jobType: job.jobType,
      status: job.status,
      totalItems: job.totalItems,
      processedItems: job.processedItems,
      successCount: job.successCount,
      failureCount: job.failureCount,
      errors: job.errors,
      progress:
        job.totalItems > 0
          ? Math.round((job.processedItems / job.totalItems) * 100)
          : 0,
      createdAt: job.createdAt,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      createdByName: createdBy?.name ?? createdBy?.username,
    };
  },
});

/**
 * List recent batch jobs for an organization
 */
export const listBatchJobs = query({
  args: {
    organizationId: v.id("organizations"),
    status: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("processing"),
        v.literal("completed"),
        v.literal("failed"),
        v.literal("cancelled"),
      ),
    ),
    limit: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      _id: v.id("batchJobs"),
      jobType: v.string(),
      status: v.string(),
      totalItems: v.number(),
      processedItems: v.number(),
      successCount: v.number(),
      failureCount: v.number(),
      progress: v.number(),
      createdAt: v.number(),
      completedAt: v.optional(v.number()),
      createdByName: v.optional(v.string()),
    }),
  ),
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.organizationId, "collections.read");

    const jobsQuery = args.status
      ? ctx.db
          .query("batchJobs")
          .withIndex("by_organization_and_status", (q) =>
            q
              .eq("organizationId", args.organizationId)
              .eq("status", args.status!),
          )
      : ctx.db
          .query("batchJobs")
          .withIndex("by_organization", (q) =>
            q.eq("organizationId", args.organizationId),
          );

    const jobs = await jobsQuery.collect();

    // Sort by creation date descending
    jobs.sort((a, b) => b.createdAt - a.createdAt);

    const limitedJobs = args.limit
      ? jobs.slice(0, args.limit)
      : jobs.slice(0, 50);

    const enriched = await Promise.all(
      limitedJobs.map(async (job) => {
        const createdBy = await ctx.db.get(job.createdBy);
        return {
          _id: job._id,
          jobType: job.jobType,
          status: job.status,
          totalItems: job.totalItems,
          processedItems: job.processedItems,
          successCount: job.successCount,
          failureCount: job.failureCount,
          progress:
            job.totalItems > 0
              ? Math.round((job.processedItems / job.totalItems) * 100)
              : 0,
          createdAt: job.createdAt,
          completedAt: job.completedAt,
          createdByName: createdBy?.name ?? createdBy?.username,
        };
      }),
    );

    return enriched;
  },
});

// ============================================
// Internal Processing
// ============================================

/**
 * Process a batch job (internal, called by scheduler)
 */
export const processBatchJob = internalMutation({
  args: {
    jobId: v.id("batchJobs"),
    startIndex: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job) {
      return null;
    }

    if (job.status === "cancelled" || job.status === "completed") {
      return null;
    }

    const startIndex = args.startIndex ?? 0;

    // Mark as processing if just starting
    if (startIndex === 0) {
      await ctx.db.patch(args.jobId, {
        status: "processing",
        startedAt: Date.now(),
      });
    }

    // Get chunk of items to process
    const endIndex = Math.min(
      startIndex + BATCH_CHUNK_SIZE,
      job.targetIds.length,
    );
    const chunkIds = job.targetIds.slice(startIndex, endIndex);

    let successCount = job.successCount;
    let failureCount = job.failureCount;
    const errors: Array<{ itemId: Id<"collections">; error: string }> = [
      ...(job.errors ?? []),
    ];

    const chunkResults = await Promise.all(
      chunkIds.map(async (collectionId) => {
        try {
          const collection = await ctx.db.get(collectionId);
          if (!collection) {
            return {
              itemId: collectionId,
              error: "Collection not found",
            };
          }

          if (collection.organizationId !== job.organizationId) {
            return {
              itemId: collectionId,
              error: "Collection belongs to different organization",
            };
          }

          if (job.jobType === "bulk_edit" && job.editPayload) {
            await processBulkEdit(
              ctx,
              collection,
              job.editPayload,
              job.createdBy,
            );
            return { success: true as const };
          }
          if (job.jobType === "bulk_move" && job.movePayload) {
            const moveResult = await processBulkMove(
              ctx,
              collection,
              job.movePayload,
              job.createdBy,
            );
            if (moveResult.success) {
              return { success: true as const };
            }
            return {
              itemId: collectionId,
              error: moveResult.error ?? "Move failed",
            };
          }
          if (job.jobType === "bulk_status_change" && job.statusPayload) {
            await processBulkStatusChange(
              ctx,
              collection,
              job.statusPayload,
              job.createdBy,
            );
            return { success: true as const };
          }
          return { success: true as const };
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : "Unknown error";
          return { itemId: collectionId, error: errorMessage };
        }
      }),
    );

    for (const result of chunkResults) {
      if ("success" in result && result.success) {
        successCount++;
      } else if ("error" in result) {
        errors.push({ itemId: result.itemId, error: result.error });
        failureCount++;
      }
    }

    // Update job progress
    const processedItems = endIndex;
    const isComplete = endIndex >= job.targetIds.length;

    await ctx.db.patch(args.jobId, {
      processedItems,
      successCount,
      failureCount,
      errors: errors.length > 0 ? errors.slice(-100) : undefined, // Keep last 100 errors
      status: isComplete ? "completed" : "processing",
      completedAt: isComplete ? Date.now() : undefined,
    });

    // Schedule next chunk if not complete
    if (!isComplete) {
      await ctx.scheduler.runAfter(
        100,
        internal.batchOperations.processBatchJob,
        {
          jobId: args.jobId,
          startIndex: endIndex,
        },
      );
    } else {
      // Send completion notification
      await ctx.runMutation(internal.notifications.sendBatchJobCompleted, {
        organizationId: job.organizationId,
        userId: job.createdBy,
        jobId: args.jobId,
        jobType: job.jobType,
        totalItems: job.totalItems,
        successCount,
        failureCount,
      });
    }

    return null;
  },
});

// ============================================
// Processing Helpers
// ============================================

type CollectionDoc = Doc<"collections">;
type CollectionCustomFields = NonNullable<CollectionDoc["customFields"]>;

async function processBulkEdit(
  ctx: MutationCtx,
  collection: CollectionDoc,
  payload: {
    collectionGroupId?: Id<"collectionGroups">;
    currentLocationId?: Id<"locations">;
    condition?: string;
    displayStatus?: string;
    isPubliclyVisible?: boolean;
    isSearchable?: boolean;
    tags?: string[];
    customFields?: CollectionCustomFields;
  },
  userId: Id<"users">,
) {
  const updates: Partial<CollectionDoc> = {
    lastModifiedBy: userId,
    lastModifiedAt: Date.now(),
  };

  if (payload.collectionGroupId !== undefined) {
    updates.collectionGroupId = payload.collectionGroupId;
  }
  if (payload.currentLocationId !== undefined) {
    updates.currentLocationId = payload.currentLocationId;
  }
  if (payload.condition !== undefined) {
    updates.condition = payload.condition;
  }
  if (payload.displayStatus !== undefined) {
    updates.displayStatus = payload.displayStatus;
  }
  if (payload.isPubliclyVisible !== undefined) {
    updates.isPubliclyVisible = payload.isPubliclyVisible;
  }
  if (payload.isSearchable !== undefined) {
    updates.isSearchable = payload.isSearchable;
  }
  if (payload.tags !== undefined) {
    updates.tags = payload.tags;
  }
  if (payload.customFields !== undefined) {
    // Merge custom fields
    updates.customFields = {
      ...(collection.customFields ?? {}),
      ...payload.customFields,
    };
  }

  await ctx.db.patch(collection._id, updates);
  if (payload.condition !== undefined) {
    const updated = await ctx.db.get(collection._id);
    if (updated) await replaceCollectionOptionUsages(ctx, updated);
  }
}

async function processBulkMove(
  ctx: MutationCtx,
  collection: CollectionDoc,
  payload: {
    toLocationId: Id<"locations">;
    reason?: string;
    overrideCapacity?: boolean;
    overrideStatus?: boolean;
  },
  userId: Id<"users">,
): Promise<{ success: boolean; error?: string }> {
  const toLocation = await ctx.db.get(payload.toLocationId);
  if (!toLocation) {
    return { success: false, error: "Target location not found" };
  }

  // Check location status
  const locationStatus = toLocation.status ?? "active";
  if (!toLocation.isActive || locationStatus === "closed") {
    if (!payload.overrideStatus) {
      return { success: false, error: "Target location is closed" };
    }
  }

  if (locationStatus === "renovation" && !payload.overrideStatus) {
    return { success: false, error: "Target location is under renovation" };
  }

  // Check capacity
  if (toLocation.capacity && !payload.overrideCapacity) {
    const objectsAtLocation = await ctx.db
      .query("collections")
      .withIndex("by_currentLocation", (q) =>
        q.eq("currentLocationId", payload.toLocationId),
      )
      .collect();

    if (objectsAtLocation.length >= toLocation.capacity) {
      return {
        success: false,
        error: `Location at capacity (${objectsAtLocation.length}/${toLocation.capacity})`,
      };
    }
  }

  const fromLocationId = collection.currentLocationId;

  // Create location history entry
  await ctx.db.insert("locationHistory", {
    collectionId: collection._id,
    fromLocationId,
    toLocationId: payload.toLocationId,
    movedBy: userId,
    movedAt: Date.now(),
    reason: payload.reason ?? "Bulk move operation",
  });

  // Update collection location
  await ctx.db.patch(collection._id, {
    currentLocationId: payload.toLocationId,
    lastModifiedBy: userId,
    lastModifiedAt: Date.now(),
  });

  return { success: true };
}

async function processBulkStatusChange(
  ctx: MutationCtx,
  collection: CollectionDoc,
  payload: {
    newStatus: "active" | "archived" | "deleted";
    reason?: string;
  },
  userId: Id<"users">,
) {
  const now = Date.now();
  const updates: Partial<CollectionDoc> = {
    status: payload.newStatus,
    lastModifiedBy: userId,
    lastModifiedAt: now,
  };

  if (payload.newStatus === "archived") {
    updates.archivedAt = now;
    updates.archivedBy = userId;
    updates.archivedReason = payload.reason;
  } else if (payload.newStatus === "deleted") {
    updates.deletedAt = now;
    updates.deletedBy = userId;
    updates.deletedReason = payload.reason;
  } else if (payload.newStatus === "active") {
    // Clear archived/deleted fields when restoring
    updates.archivedAt = undefined;
    updates.archivedBy = undefined;
    updates.archivedReason = undefined;
    updates.deletedAt = undefined;
    updates.deletedBy = undefined;
    updates.deletedReason = undefined;
  }

  await ctx.db.patch(collection._id, updates);
}

// ============================================
// Quick Batch Operations (Synchronous for small batches)
// ============================================

/**
 * Quick bulk edit for small batches (< 20 items) - synchronous
 */
export const quickBulkEdit = mutation({
  args: {
    organizationId: v.id("organizations"),
    collectionIds: v.array(v.id("collections")),
    updates: v.object({
      collectionGroupId: v.optional(v.id("collectionGroups")),
      currentLocationId: v.optional(v.id("locations")),
      condition: v.optional(v.string()),
      displayStatus: v.optional(v.string()),
      isPubliclyVisible: v.optional(v.boolean()),
      isSearchable: v.optional(v.boolean()),
      tags: v.optional(v.array(v.string())),
    }),
  },
  returns: v.object({
    successCount: v.number(),
    failureCount: v.number(),
    errors: v.array(
      v.object({
        itemId: v.id("collections"),
        error: v.string(),
      }),
    ),
  }),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    if (args.collectionIds.length === 0) {
      return { successCount: 0, failureCount: 0, errors: [] };
    }

    if (args.collectionIds.length > 20) {
      throw new Error("Use createBulkEditJob for batches larger than 20 items");
    }

    await requirePermission(ctx, args.organizationId, "collections.update");

    await assertCollectionsBelongToOrg(
      ctx,
      args.organizationId,
      args.collectionIds,
    );

    const editResults = await Promise.all(
      args.collectionIds.map(async (collectionId) => {
        try {
          const updates: Partial<CollectionDoc> = {
            lastModifiedBy: userId,
            lastModifiedAt: Date.now(),
          };

          if (args.updates.collectionGroupId !== undefined) {
            updates.collectionGroupId = args.updates.collectionGroupId;
          }
          if (args.updates.currentLocationId !== undefined) {
            updates.currentLocationId = args.updates.currentLocationId;
          }
          if (args.updates.condition !== undefined) {
            updates.condition = args.updates.condition;
          }
          if (args.updates.displayStatus !== undefined) {
            updates.displayStatus = args.updates.displayStatus;
          }
          if (args.updates.isPubliclyVisible !== undefined) {
            updates.isPubliclyVisible = args.updates.isPubliclyVisible;
          }
          if (args.updates.isSearchable !== undefined) {
            updates.isSearchable = args.updates.isSearchable;
          }
          if (args.updates.tags !== undefined) {
            updates.tags = args.updates.tags;
          }

          await ctx.db.patch(collectionId, updates);
          if (args.updates.condition !== undefined) {
            await syncCollectionOptionUsages(ctx, collectionId);
          }
          return { success: true as const };
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : "Unknown error";
          return { itemId: collectionId, error: errorMessage };
        }
      }),
    );

    let successCount = 0;
    let failureCount = 0;
    const errors: Array<{ itemId: Id<"collections">; error: string }> = [];
    for (const result of editResults) {
      if ("success" in result) {
        successCount++;
      } else {
        errors.push({ itemId: result.itemId, error: result.error });
        failureCount++;
      }
    }

    return { successCount, failureCount, errors };
  },
});

/**
 * Quick bulk status change for small batches (< 20 items) - synchronous
 */
export const quickBulkStatusChange = mutation({
  args: {
    organizationId: v.id("organizations"),
    collectionIds: v.array(v.id("collections")),
    newStatus: v.union(
      v.literal("active"),
      v.literal("archived"),
      v.literal("deleted"),
    ),
    reason: v.optional(v.string()),
  },
  returns: v.object({
    successCount: v.number(),
    failureCount: v.number(),
    errors: v.array(
      v.object({
        itemId: v.id("collections"),
        error: v.string(),
      }),
    ),
  }),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    if (args.collectionIds.length === 0) {
      return { successCount: 0, failureCount: 0, errors: [] };
    }

    if (args.collectionIds.length > 20) {
      throw new Error(
        "Use createBulkStatusChangeJob for batches larger than 20 items",
      );
    }

    if (args.newStatus === "deleted") {
      await requirePermission(ctx, args.organizationId, "collections.delete");
    } else {
      await requirePermission(ctx, args.organizationId, "collections.update");
    }

    const now = Date.now();
    const statusResults = await Promise.all(
      args.collectionIds.map(async (collectionId) => {
        try {
          const collection = await ctx.db.get(collectionId);
          if (!collection) {
            return {
              itemId: collectionId,
              error: "Collection not found",
            };
          }

          if (collection.organizationId !== args.organizationId) {
            return {
              itemId: collectionId,
              error: "Collection belongs to different organization",
            };
          }

          const updates: Partial<CollectionDoc> = {
            status: args.newStatus,
            lastModifiedBy: userId,
            lastModifiedAt: now,
          };

          if (args.newStatus === "archived") {
            updates.archivedAt = now;
            updates.archivedBy = userId;
            updates.archivedReason = args.reason;
          } else if (args.newStatus === "deleted") {
            updates.deletedAt = now;
            updates.deletedBy = userId;
            updates.deletedReason = args.reason;
          } else if (args.newStatus === "active") {
            updates.archivedAt = undefined;
            updates.archivedBy = undefined;
            updates.archivedReason = undefined;
            updates.deletedAt = undefined;
            updates.deletedBy = undefined;
            updates.deletedReason = undefined;
          }

          await ctx.db.patch(collectionId, updates);
          return { success: true as const };
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : "Unknown error";
          return { itemId: collectionId, error: errorMessage };
        }
      }),
    );

    let successCount = 0;
    let failureCount = 0;
    const errors: Array<{ itemId: Id<"collections">; error: string }> = [];
    for (const result of statusResults) {
      if ("success" in result) {
        successCount++;
      } else {
        errors.push({ itemId: result.itemId, error: result.error });
        failureCount++;
      }
    }

    return { successCount, failureCount, errors };
  },
});

/**
 * Add tags to multiple collections
 */
export const bulkAddTags = mutation({
  args: {
    organizationId: v.id("organizations"),
    collectionIds: v.array(v.id("collections")),
    tags: v.array(v.string()),
  },
  returns: v.object({
    successCount: v.number(),
    failureCount: v.number(),
  }),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    if (args.collectionIds.length > 100) {
      throw new Error("Maximum 100 items for bulk tag operation");
    }

    await requirePermission(ctx, args.organizationId, "collections.update");

    await assertCollectionsBelongToOrg(
      ctx,
      args.organizationId,
      args.collectionIds,
    );

    const addTagResults = await Promise.all(
      args.collectionIds.map(async (collectionId) => {
        try {
          const collection = await ctx.db.get(collectionId);
          if (!collection) {
            return false;
          }

          const existingTags = collection.tags ?? [];
          const newTags = [...new Set([...existingTags, ...args.tags])];

          await ctx.db.patch(collectionId, {
            tags: newTags,
            lastModifiedBy: userId,
            lastModifiedAt: Date.now(),
          });
          return true;
        } catch {
          return false;
        }
      }),
    );

    const successCount = addTagResults.filter(Boolean).length;
    const failureCount = addTagResults.length - successCount;

    return { successCount, failureCount };
  },
});

/**
 * Remove tags from multiple collections
 */
export const bulkRemoveTags = mutation({
  args: {
    organizationId: v.id("organizations"),
    collectionIds: v.array(v.id("collections")),
    tags: v.array(v.string()),
  },
  returns: v.object({
    successCount: v.number(),
    failureCount: v.number(),
  }),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    if (args.collectionIds.length > 100) {
      throw new Error("Maximum 100 items for bulk tag operation");
    }

    await requirePermission(ctx, args.organizationId, "collections.update");

    const removeTagResults = await Promise.all(
      args.collectionIds.map(async (collectionId) => {
        try {
          const collection = await ctx.db.get(collectionId);
          if (
            !collection ||
            collection.organizationId !== args.organizationId
          ) {
            return false;
          }

          const existingTags = collection.tags ?? [];
          const tagsToRemove = new Set(args.tags);
          const newTags = existingTags.filter((tag) => !tagsToRemove.has(tag));

          await ctx.db.patch(collectionId, {
            tags: newTags,
            lastModifiedBy: userId,
            lastModifiedAt: Date.now(),
          });
          return true;
        } catch {
          return false;
        }
      }),
    );

    const successCount = removeTagResults.filter(Boolean).length;
    const failureCount = removeTagResults.length - successCount;

    return { successCount, failureCount };
  },
});
