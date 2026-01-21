import { v } from "convex/values";
import { query } from "./_generated/server";
import { auditLogChanges } from "./schema";
import { requirePermission } from "./utils/permissions";

const ENTITY_TYPES = [
  "collection",
  "loan",
  "accession",
  "deaccession",
  "location",
  "media",
  "user",
  "organization",
  "collectionGroup",
  "exhibition",
  "conservation",
] as const;

/**
 * List audit log entries with filtering
 */
export const list = query({
  args: {
    organizationId: v.id("organizations"),
    userId: v.optional(v.id("users")),
    entityType: v.optional(v.string()),
    action: v.optional(v.string()),
    fromDate: v.optional(v.number()),
    toDate: v.optional(v.number()),
    limit: v.optional(v.number()),
    cursor: v.optional(v.string()),
  },
  returns: v.object({
    entries: v.array(
      v.object({
        _id: v.id("auditLog"),
        action: v.string(),
        entityType: v.string(),
        entityId: v.string(),
        timestamp: v.number(),
        userId: v.id("users"),
        userName: v.optional(v.string()),
        userEmail: v.optional(v.string()),
        userImage: v.optional(v.string()),
        changes: v.optional(auditLogChanges),
      }),
    ),
    nextCursor: v.optional(v.string()),
    totalCount: v.number(),
  }),
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.organizationId, "collections.read");

    const limit = Math.min(args.limit ?? 50, 100);

    // Build query with filters
    const query = ctx.db
      .query("auditLog")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .order("desc");

    // Collect all entries for filtering (we need to filter in memory for some conditions)
    let entries = await query.collect();

    // Apply filters
    if (args.userId) {
      entries = entries.filter((e) => e.userId === args.userId);
    }
    if (args.entityType) {
      entries = entries.filter((e) => e.entityType === args.entityType);
    }
    if (args.action) {
      entries = entries.filter((e) =>
        e.action.toLowerCase().includes(args.action!.toLowerCase()),
      );
    }
    if (args.fromDate) {
      entries = entries.filter((e) => e.timestamp >= args.fromDate!);
    }
    if (args.toDate) {
      entries = entries.filter((e) => e.timestamp <= args.toDate!);
    }

    const totalCount = entries.length;

    // Apply cursor-based pagination
    let startIndex = 0;
    if (args.cursor) {
      const cursorIndex = entries.findIndex((e) => e._id === args.cursor);
      if (cursorIndex !== -1) {
        startIndex = cursorIndex + 1;
      }
    }

    const paginatedEntries = entries.slice(startIndex, startIndex + limit);
    const nextCursor =
      startIndex + limit < entries.length
        ? paginatedEntries[paginatedEntries.length - 1]?._id
        : undefined;

    // Enrich with user details
    const enrichedEntries = await Promise.all(
      paginatedEntries.map(async (entry) => {
        const user = await ctx.db.get(entry.userId);
        return {
          _id: entry._id,
          action: entry.action,
          entityType: entry.entityType,
          entityId: entry.entityId,
          timestamp: entry.timestamp,
          userId: entry.userId,
          userName: user?.name || undefined,
          userEmail: user?.email || undefined,
          userImage: user?.image || undefined,
          changes: entry.changes,
        };
      }),
    );

    return {
      entries: enrichedEntries,
      nextCursor,
      totalCount,
    };
  },
});

/**
 * Get available entity types for filter dropdown
 */
export const getEntityTypes = query({
  args: {},
  returns: v.array(v.string()),
  handler: async () => {
    return [...ENTITY_TYPES];
  },
});

/**
 * Get available actions for filter dropdown (based on existing data)
 */
export const getAvailableActions = query({
  args: {
    organizationId: v.id("organizations"),
  },
  returns: v.array(v.string()),
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.organizationId, "collections.read");

    const entries = await ctx.db
      .query("auditLog")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .collect();

    const actions = [...new Set(entries.map((e) => e.action))];
    return actions.sort();
  },
});

/**
 * Get users who have audit log entries (for filter dropdown)
 */
export const getActiveUsers = query({
  args: {
    organizationId: v.id("organizations"),
  },
  returns: v.array(
    v.object({
      _id: v.id("users"),
      name: v.optional(v.string()),
      email: v.optional(v.string()),
    }),
  ),
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.organizationId, "collections.read");

    const entries = await ctx.db
      .query("auditLog")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .collect();

    const userIds = [...new Set(entries.map((e) => e.userId))];

    const users = await Promise.all(
      userIds.map(async (userId) => {
        const user = await ctx.db.get(userId);
        return user
          ? { _id: user._id, name: user.name, email: user.email }
          : null;
      }),
    );

    return users.filter((u): u is NonNullable<typeof u> => u !== null);
  },
});

/**
 * Get audit log entries for a specific entity
 */
export const getByEntity = query({
  args: {
    organizationId: v.id("organizations"),
    entityType: v.string(),
    entityId: v.string(),
    limit: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      _id: v.id("auditLog"),
      action: v.string(),
      timestamp: v.number(),
      userName: v.optional(v.string()),
      changes: v.optional(auditLogChanges),
    }),
  ),
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.organizationId, "collections.read");

    const limit = args.limit ?? 10;

    const entries = await ctx.db
      .query("auditLog")
      .withIndex("by_entity", (q) =>
        q.eq("entityType", args.entityType).eq("entityId", args.entityId),
      )
      .order("desc")
      .take(limit);

    // Get user names for each entry
    const enrichedEntries = await Promise.all(
      entries.map(async (entry) => {
        const user = await ctx.db.get(entry.userId);
        return {
          _id: entry._id,
          action: entry.action,
          timestamp: entry.timestamp,
          userName: user?.name || user?.email || undefined,
          changes: entry.changes,
        };
      }),
    );

    return enrichedEntries;
  },
});

/**
 * Get recent audit log entries for an organization
 */
export const getRecent = query({
  args: {
    organizationId: v.id("organizations"),
    limit: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      _id: v.id("auditLog"),
      action: v.string(),
      entityType: v.string(),
      entityId: v.string(),
      timestamp: v.number(),
      userName: v.optional(v.string()),
    }),
  ),
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.organizationId, "collections.read");

    const limit = args.limit ?? 20;

    const entries = await ctx.db
      .query("auditLog")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .order("desc")
      .take(limit);

    // Get user names for each entry
    const enrichedEntries = await Promise.all(
      entries.map(async (entry) => {
        const user = await ctx.db.get(entry.userId);
        return {
          _id: entry._id,
          action: entry.action,
          entityType: entry.entityType,
          entityId: entry.entityId,
          timestamp: entry.timestamp,
          userName: user?.name || user?.email || undefined,
        };
      }),
    );

    return enrichedEntries;
  },
});
