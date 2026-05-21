import { getAuthUserId } from "@convex-dev/auth/server";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { mutation, query } from "./_generated/server";
import { metadataRecord } from "./schema";
import { requireModuleEnabled } from "./utils/featureGates";
import { requirePermission } from "./utils/permissions";

const relatedEntityTypeValidator = v.union(
  v.literal("loan"),
  v.literal("exhibition"),
  v.literal("acquisition"),
  v.literal("item"),
);

const relationshipTypeValidator = v.union(
  v.literal("lender"),
  v.literal("borrower"),
  v.literal("donor"),
  v.literal("vendor"),
  v.literal("buyer"),
);

export const list = query({
  args: {
    accountId: v.id("accounts"),
  },
  returns: v.array(
    v.object({
      _id: v.id("accountRelationships"),
      _creationTime: v.number(),
      organizationId: v.id("organizations"),
      accountId: v.id("accounts"),
      relatedEntityType: relatedEntityTypeValidator,
      relatedEntityId: v.string(),
      relationshipType: relationshipTypeValidator,
      startDate: v.number(),
      endDate: v.optional(v.number()),
      notes: v.optional(v.string()),
      metadata: v.optional(metadataRecord),
      createdAt: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const account = await ctx.db.get(args.accountId);
    if (!account) {
      throw new Error("Account not found");
    }
    await Promise.all([
      requireModuleEnabled(ctx, account.organizationId, "accounts"),
      requirePermission(ctx, account.organizationId, "accounts.read"),
    ]);
    const relationships = await ctx.db
      .query("accountRelationships")
      .withIndex("by_account", (q) => q.eq("accountId", args.accountId))
      .collect();

    return relationships;
  },
});

export const listByEntity = query({
  args: {
    relatedEntityType: relatedEntityTypeValidator,
    relatedEntityId: v.string(),
  },
  returns: v.array(
    v.object({
      _id: v.id("accountRelationships"),
      _creationTime: v.number(),
      organizationId: v.id("organizations"),
      accountId: v.id("accounts"),
      relatedEntityType: relatedEntityTypeValidator,
      relatedEntityId: v.string(),
      relationshipType: relationshipTypeValidator,
      startDate: v.number(),
      endDate: v.optional(v.number()),
      notes: v.optional(v.string()),
      metadata: v.optional(metadataRecord),
      createdAt: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const relationships = await ctx.db
      .query("accountRelationships")
      .withIndex("by_related_entity", (q) =>
        q
          .eq("relatedEntityType", args.relatedEntityType)
          .eq("relatedEntityId", args.relatedEntityId),
      )
      .collect();

    if (relationships.length === 0) {
      return [];
    }

    const firstRelationship = relationships[0];
    if (!firstRelationship) {
      return [];
    }

    await Promise.all([
      requireModuleEnabled(
      ctx,
      firstRelationship.organizationId,
      "accounts",
    ),
      requirePermission(
      ctx,
      firstRelationship.organizationId,
      "accounts.read",
    ),
    ]);

    return relationships;
  },
});

type TimelineEvent = {
  type: "relationship" | "document" | "note";
  timestamp: number;
  description: string;
  metadata?: unknown;
};

export const timeline = query({
  args: {
    accountId: v.id("accounts"),
    limit: v.optional(v.number()),
    cursor: v.optional(v.string()),
  },
  returns: v.object({
    events: v.array(
      v.object({
        type: v.union(
          v.literal("relationship"),
          v.literal("document"),
          v.literal("note"),
        ),
        timestamp: v.number(),
        description: v.string(),
        metadata: v.optional(v.any()),
      }),
    ),
    isDone: v.boolean(),
    continueCursor: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const account = await ctx.db.get(args.accountId);
    if (!account) {
      throw new Error("Account not found");
    }

    await Promise.all([
      requireModuleEnabled(ctx, account.organizationId, "accounts"),
      requirePermission(ctx, account.organizationId, "accounts.read"),
    ]);

    const events: TimelineEvent[] = [];

    const relationships = await ctx.db
      .query("accountRelationships")
      .withIndex("by_account", (q) => q.eq("accountId", args.accountId))
      .collect();

    for (const rel of relationships) {
      events.push({
        type: "relationship",
        timestamp: rel.createdAt,
        description: `Linked to ${rel.relatedEntityType} ${rel.relatedEntityId} as ${rel.relationshipType}`,
        metadata: {
          relationshipId: rel._id,
          relatedEntityType: rel.relatedEntityType,
          relatedEntityId: rel.relatedEntityId,
          relationshipType: rel.relationshipType,
        },
      });
    }

    const documents = await ctx.db
      .query("accountDocuments")
      .withIndex("by_account", (q) => q.eq("accountId", args.accountId))
      .collect();

    for (const doc of documents) {
      events.push({
        type: "document",
        timestamp: doc.uploadedAt,
        description: `Uploaded document: ${doc.filename}`,
        metadata: {
          documentId: doc._id,
          filename: doc.filename,
          documentType: doc.documentType,
        },
      });
    }

    if (account.lastModifiedAt && account.notes) {
      events.push({
        type: "note",
        timestamp: account.lastModifiedAt,
        description: "Notes updated",
        metadata: {
          notes: account.notes,
        },
      });
    }

    events.sort((a, b) => b.timestamp - a.timestamp);

    const limit = args.limit ?? 50;
    const cursor = args.cursor ? Number.parseInt(args.cursor, 10) : 0;
    const startIndex = cursor;
    const endIndex = Math.min(startIndex + limit, events.length);
    const page = events.slice(startIndex, endIndex);

    return {
      events: page,
      isDone: endIndex >= events.length,
      continueCursor:
        endIndex < events.length ? endIndex.toString() : undefined,
    };
  },
});

export const create = mutation({
  args: {
    accountId: v.id("accounts"),
    relatedEntityType: relatedEntityTypeValidator,
    relatedEntityId: v.string(),
    relationshipType: relationshipTypeValidator,
    startDate: v.number(),
    endDate: v.optional(v.number()),
    notes: v.optional(v.string()),
    metadata: v.optional(metadataRecord),
  },
  returns: v.id("accountRelationships"),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const account = await ctx.db.get(args.accountId);
    if (!account) {
      throw new Error("Account not found");
    }
    await Promise.all([
      requireModuleEnabled(ctx, account.organizationId, "accounts"),
      requirePermission(ctx, account.organizationId, "accounts.write"),
    ]);
    const relationshipId = await ctx.db.insert("accountRelationships", {
      organizationId: account.organizationId,
      accountId: args.accountId,
      relatedEntityType: args.relatedEntityType,
      relatedEntityId: args.relatedEntityId,
      relationshipType: args.relationshipType,
      startDate: args.startDate,
      endDate: args.endDate,
      notes: args.notes?.trim(),
      metadata: args.metadata,
      createdAt: Date.now(),
    });

    await ctx.runMutation(internal.audit.logAction, {
      organizationId: account.organizationId,
      userId,
      action: "created_account_relationship",
      entityType: "accountRelationship",
      entityId: relationshipId,
      changes: {
        relatedEntityType: args.relatedEntityType,
        relatedEntityId: args.relatedEntityId,
        relationshipType: args.relationshipType,
      },
    });

    return relationshipId;
  },
});

export const update = mutation({
  args: {
    relationshipId: v.id("accountRelationships"),
    relationshipType: v.optional(relationshipTypeValidator),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
    notes: v.optional(v.string()),
    metadata: v.optional(metadataRecord),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const relationship = await ctx.db.get(args.relationshipId);
    if (!relationship) {
      throw new Error("Relationship not found");
    }

    await Promise.all([
      requireModuleEnabled(ctx, relationship.organizationId, "accounts"),
      requirePermission(ctx, relationship.organizationId, "accounts.write"),
    ]);

    const updates: Record<string, unknown> = {};

    if (args.relationshipType !== undefined)
      updates.relationshipType = args.relationshipType;
    if (args.startDate !== undefined) updates.startDate = args.startDate;
    if (args.endDate !== undefined) updates.endDate = args.endDate;
    if (args.notes !== undefined) updates.notes = args.notes?.trim();
    if (args.metadata !== undefined) updates.metadata = args.metadata;

    await Promise.all([
      ctx.db.patch(args.relationshipId, updates),
      ctx.runMutation(internal.audit.logAction, {
      organizationId: relationship.organizationId,
      userId,
      action: "updated_account_relationship",
      entityType: "accountRelationship",
      entityId: args.relationshipId,
      changes: updates,
    }),
    ]);

    return null;
  },
});

export const remove = mutation({
  args: {
    relationshipId: v.id("accountRelationships"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const relationship = await ctx.db.get(args.relationshipId);
    if (!relationship) {
      throw new Error("Relationship not found");
    }
    await Promise.all([
      requireModuleEnabled(ctx, relationship.organizationId, "accounts"),
      requirePermission(ctx, relationship.organizationId, "accounts.delete"),
      ctx.db.delete(args.relationshipId),
      ctx.runMutation(internal.audit.logAction, {
        organizationId: relationship.organizationId,
        userId,
        action: "deleted_account_relationship",
        entityType: "accountRelationship",
        entityId: args.relationshipId,
        changes: {
          relatedEntityType: relationship.relatedEntityType,
          relatedEntityId: relationship.relatedEntityId,
        },
      }),
    ] as const);

    return null;
  },
});
