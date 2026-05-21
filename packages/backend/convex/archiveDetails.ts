import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  type MutationCtx,
  mutation,
  type QueryCtx,
  query,
} from "./_generated/server";
import { requireModuleEnabled } from "./utils/featureGates";
import { requirePermission } from "./utils/permissions";

const confidentialityLevelValidator = v.union(
  v.literal("public"),
  v.literal("internal"),
  v.literal("confidential"),
  v.literal("restricted"),
  v.literal("top_secret"),
);

async function requireArchiveModule(
  ctx: QueryCtx | MutationCtx,
  organizationId: Id<"organizations">,
) {
  await requireModuleEnabled(ctx, organizationId, "archive");
}

export const get = query({
  args: {
    collectionId: v.id("collections"),
  },
  returns: v.union(
    v.object({
      _id: v.id("archiveDetails"),
      collectionId: v.id("collections"),
      organizationId: v.id("organizations"),
      documentType: v.optional(v.string()),
      retentionCategory: v.optional(v.string()),
      retentionYears: v.optional(v.number()),
      retentionStartDate: v.optional(v.number()),
      retentionExpiresAt: v.optional(v.number()),
      flaggedForDestruction: v.optional(v.boolean()),
      destructionDate: v.optional(v.number()),
      destructionMethod: v.optional(v.string()),
      destructionWitnessedBy: v.optional(v.string()),
      legalHold: v.optional(v.boolean()),
      legalHoldReason: v.optional(v.string()),
      confidentialityLevel: v.optional(confidentialityLevelValidator),
      accessRestrictions: v.optional(v.array(v.string())),
      originatingDepartment: v.optional(v.string()),
      recordSeries: v.optional(v.string()),
      boxNumber: v.optional(v.string()),
      folderNumber: v.optional(v.string()),
      digitalAssetUrl: v.optional(v.string()),
      digitalAssetStorageId: v.optional(v.id("_storage")),
      fileFormat: v.optional(v.string()),
      fileSize: v.optional(v.number()),
      pageCount: v.optional(v.number()),
      ocrProcessed: v.optional(v.boolean()),
      keywords: v.optional(v.array(v.string())),
      createdAt: v.number(),
      lastModifiedAt: v.optional(v.number()),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const [userId, collection] = await Promise.all([
      getAuthUserId(ctx),
      ctx.db.get(args.collectionId),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    if (!collection) {
      return null;
    }
    await Promise.all([
      requireArchiveModule(ctx, collection.organizationId),
      requirePermission(ctx, collection.organizationId, "collections.read"),
    ]);
    const details = await ctx.db
      .query("archiveDetails")
      .withIndex("by_collection", (q) =>
        q.eq("collectionId", args.collectionId),
      )
      .unique();

    return details;
  },
});

export const upsert = mutation({
  args: {
    collectionId: v.id("collections"),
    documentType: v.optional(v.string()),
    retentionCategory: v.optional(v.string()),
    retentionYears: v.optional(v.number()),
    retentionStartDate: v.optional(v.number()),
    retentionExpiresAt: v.optional(v.number()),
    flaggedForDestruction: v.optional(v.boolean()),
    destructionDate: v.optional(v.number()),
    destructionMethod: v.optional(v.string()),
    destructionWitnessedBy: v.optional(v.string()),
    legalHold: v.optional(v.boolean()),
    legalHoldReason: v.optional(v.string()),
    confidentialityLevel: v.optional(confidentialityLevelValidator),
    accessRestrictions: v.optional(v.array(v.string())),
    originatingDepartment: v.optional(v.string()),
    recordSeries: v.optional(v.string()),
    boxNumber: v.optional(v.string()),
    folderNumber: v.optional(v.string()),
    digitalAssetUrl: v.optional(v.string()),
    digitalAssetStorageId: v.optional(v.id("_storage")),
    fileFormat: v.optional(v.string()),
    fileSize: v.optional(v.number()),
    pageCount: v.optional(v.number()),
    ocrProcessed: v.optional(v.boolean()),
    keywords: v.optional(v.array(v.string())),
  },
  returns: v.id("archiveDetails"),
  handler: async (ctx, args) => {
    const [userId, collection] = await Promise.all([
      getAuthUserId(ctx),
      ctx.db.get(args.collectionId),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    if (!collection) {
      throw new Error("Collection not found");
    }
    await Promise.all([
      requireArchiveModule(ctx, collection.organizationId),
      requirePermission(ctx, collection.organizationId, "collections.update"),
    ]);
    const existing = await ctx.db
      .query("archiveDetails")
      .withIndex("by_collection", (q) =>
        q.eq("collectionId", args.collectionId),
      )
      .unique();

    const { collectionId, ...updateData } = args;

    if (existing) {
      await Promise.all([
        ctx.db.patch(existing._id, {
          ...updateData,
          lastModifiedAt: Date.now(),
        }),
        ctx.runMutation(internal.audit.logAction, {
          organizationId: collection.organizationId,
          userId,
          action: "updated",
          entityType: "archiveDetails",
          entityId: existing._id,
          changes: updateData,
        }),
      ]);

      return existing._id;
    }

    const id = await ctx.db.insert("archiveDetails", {
      collectionId: args.collectionId,
      organizationId: collection.organizationId,
      ...updateData,
      createdAt: Date.now(),
    });

    await ctx.runMutation(internal.audit.logAction, {
      organizationId: collection.organizationId,
      userId,
      action: "created",
      entityType: "archiveDetails",
      entityId: id,
      changes: updateData,
    });

    return id;
  },
});

export const remove = mutation({
  args: {
    archiveDetailsId: v.id("archiveDetails"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const [userId, details] = await Promise.all([
      getAuthUserId(ctx),
      ctx.db.get(args.archiveDetailsId),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    if (!details) {
      throw new Error("Archive details not found");
    }
    await Promise.all([
      requireArchiveModule(ctx, details.organizationId),
      requirePermission(ctx, details.organizationId, "collections.delete"),
      ctx.db.delete(args.archiveDetailsId),
      ctx.runMutation(internal.audit.logAction, {
        organizationId: details.organizationId,
        userId,
        action: "deleted",
        entityType: "archiveDetails",
        entityId: args.archiveDetailsId,
      }),
    ] as const);

    return null;
  },
});

export const listExpiredRetention = query({
  args: {
    organizationId: v.id("organizations"),
  },
  returns: v.array(
    v.object({
      _id: v.id("archiveDetails"),
      collectionId: v.id("collections"),
      documentType: v.optional(v.string()),
      retentionExpiresAt: v.optional(v.number()),
      flaggedForDestruction: v.optional(v.boolean()),
      legalHold: v.optional(v.boolean()),
    }),
  ),
  handler: async (ctx, args) => {
    const [userId] = await Promise.all([
      getAuthUserId(ctx),

      requireArchiveModule(ctx, args.organizationId),
      requirePermission(ctx, args.organizationId, "collections.read"),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const now = Date.now();

    const archives = await ctx.db
      .query("archiveDetails")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .collect();

    const expired = archives.filter(
      (a) =>
        a.retentionExpiresAt !== undefined &&
        a.retentionExpiresAt <= now &&
        !a.legalHold,
    );

    return expired.map((a) => ({
      _id: a._id,
      collectionId: a.collectionId,
      documentType: a.documentType,
      retentionExpiresAt: a.retentionExpiresAt,
      flaggedForDestruction: a.flaggedForDestruction,
      legalHold: a.legalHold,
    }));
  },
});

export const listFlaggedForDestruction = query({
  args: {
    organizationId: v.id("organizations"),
  },
  returns: v.array(
    v.object({
      _id: v.id("archiveDetails"),
      collectionId: v.id("collections"),
      documentType: v.optional(v.string()),
      retentionExpiresAt: v.optional(v.number()),
      legalHold: v.optional(v.boolean()),
    }),
  ),
  handler: async (ctx, args) => {
    const [userId] = await Promise.all([
      getAuthUserId(ctx),

      requireArchiveModule(ctx, args.organizationId),
      requirePermission(ctx, args.organizationId, "collections.read"),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    const archives = await ctx.db
      .query("archiveDetails")
      .withIndex("by_organization_and_destruction_flag", (q) =>
        q
          .eq("organizationId", args.organizationId)
          .eq("flaggedForDestruction", true),
      )
      .collect();

    return archives.flatMap((archive) =>
      archive.legalHold
        ? []
        : [
            {
              _id: archive._id,
              collectionId: archive.collectionId,
              documentType: archive.documentType,
              retentionExpiresAt: archive.retentionExpiresAt,
              legalHold: archive.legalHold,
            },
          ],
    );
  },
});

export const setLegalHold = mutation({
  args: {
    archiveDetailsId: v.id("archiveDetails"),
    legalHold: v.boolean(),
    legalHoldReason: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const [userId, details] = await Promise.all([
      getAuthUserId(ctx),
      ctx.db.get(args.archiveDetailsId),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    if (!details) {
      throw new Error("Archive details not found");
    }
    await Promise.all([
      requireArchiveModule(ctx, details.organizationId),
      requirePermission(ctx, details.organizationId, "collections.update"),
      ctx.db.patch(args.archiveDetailsId, {
        legalHold: args.legalHold,
        legalHoldReason: args.legalHold ? args.legalHoldReason : undefined,
        flaggedForDestruction: args.legalHold
          ? false
          : details.flaggedForDestruction,
        lastModifiedAt: Date.now(),
      }),
      ctx.runMutation(internal.audit.logAction, {
        organizationId: details.organizationId,
        userId,
        action: args.legalHold ? "set_legal_hold" : "removed_legal_hold",
        entityType: "archiveDetails",
        entityId: args.archiveDetailsId,
        changes: {
          legalHold: args.legalHold,
          legalHoldReason: args.legalHoldReason,
        },
      }),
    ] as const);

    return null;
  },
});

export const flagForDestruction = mutation({
  args: {
    archiveDetailsId: v.id("archiveDetails"),
    flagged: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const [userId, details] = await Promise.all([
      getAuthUserId(ctx),
      ctx.db.get(args.archiveDetailsId),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    if (!details) {
      throw new Error("Archive details not found");
    }

    if (details.legalHold) {
      throw new Error("Cannot flag for destruction: document is on legal hold");
    }
    await Promise.all([
      requireArchiveModule(ctx, details.organizationId),
      requirePermission(ctx, details.organizationId, "collections.update"),
      ctx.db.patch(args.archiveDetailsId, {
        flaggedForDestruction: args.flagged,
        lastModifiedAt: Date.now(),
      }),
      ctx.runMutation(internal.audit.logAction, {
        organizationId: details.organizationId,
        userId,
        action: args.flagged
          ? "flagged_for_destruction"
          : "unflagged_for_destruction",
        entityType: "archiveDetails",
        entityId: args.archiveDetailsId,
      }),
    ] as const);

    return null;
  },
});

export const recordDestruction = mutation({
  args: {
    archiveDetailsId: v.id("archiveDetails"),
    destructionMethod: v.string(),
    destructionWitnessedBy: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const [userId, details] = await Promise.all([
      getAuthUserId(ctx),
      ctx.db.get(args.archiveDetailsId),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    if (!details) {
      throw new Error("Archive details not found");
    }

    if (details.legalHold) {
      throw new Error("Cannot destroy: document is on legal hold");
    }
    await Promise.all([
      requireArchiveModule(ctx, details.organizationId),
      requirePermission(ctx, details.organizationId, "collections.delete"),
      ctx.db.patch(args.archiveDetailsId, {
        destructionDate: Date.now(),
        destructionMethod: args.destructionMethod,
        destructionWitnessedBy: args.destructionWitnessedBy,
        lastModifiedAt: Date.now(),
      }),
      ctx.runMutation(internal.audit.logAction, {
        organizationId: details.organizationId,
        userId,
        action: "recorded_destruction",
        entityType: "archiveDetails",
        entityId: args.archiveDetailsId,
        changes: {
          destructionMethod: args.destructionMethod,
          destructionWitnessedBy: args.destructionWitnessedBy,
        },
      }),
    ] as const);

    return null;
  },
});
