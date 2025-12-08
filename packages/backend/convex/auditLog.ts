import { v } from "convex/values";
import { query } from "./_generated/server";
import { requirePermission } from "./utils/permissions";

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
      changes: v.optional(v.any()),
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
