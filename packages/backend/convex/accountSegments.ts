import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { mutation, query } from "./_generated/server";
import { filterCondition } from "./schema";
import { requireModuleEnabled } from "./utils/featureGates";
import { requirePermission } from "./utils/permissions";

// Use the shared filterCondition validator from schema
const filterValidator = filterCondition;

export const list = query({
  args: {
    organizationId: v.id("organizations"),
  },
  returns: v.array(
    v.object({
      _id: v.id("accountSegments"),
      _creationTime: v.number(),
      organizationId: v.id("organizations"),
      name: v.string(),
      description: v.optional(v.string()),
      filters: v.array(filterValidator),
      createdBy: v.id("users"),
      createdAt: v.number(),
      updatedAt: v.optional(v.number()),
    }),
  ),
  handler: async (ctx, args) => {
    await Promise.all([
      requireModuleEnabled(ctx, args.organizationId, "accounts"),
      requirePermission(ctx, args.organizationId, "accounts.read"),
    ]);
    const segments = await ctx.db
      .query("accountSegments")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .collect();

    return segments;
  },
});

export const get = query({
  args: {
    segmentId: v.id("accountSegments"),
  },
  returns: v.union(
    v.object({
      _id: v.id("accountSegments"),
      _creationTime: v.number(),
      organizationId: v.id("organizations"),
      name: v.string(),
      description: v.optional(v.string()),
      filters: v.array(filterValidator),
      createdBy: v.id("users"),
      createdAt: v.number(),
      updatedAt: v.optional(v.number()),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const segment = await ctx.db.get(args.segmentId);
    if (!segment) {
      return null;
    }

    await Promise.all([
      requireModuleEnabled(ctx, segment.organizationId, "accounts"),
      requirePermission(ctx, segment.organizationId, "accounts.read"),
    ]);

    return segment;
  },
});

type FilterCondition = {
  field: string;
  operator: "eq" | "ne" | "in" | "contains" | "gt" | "lt" | "gte" | "lte";
  value: unknown;
};

function applyFilter(
  account: Record<string, unknown>,
  filter: FilterCondition,
): boolean {
  const fieldValue = account[filter.field];

  switch (filter.operator) {
    case "eq":
      return fieldValue === filter.value;
    case "ne":
      return fieldValue !== filter.value;
    case "in":
      if (Array.isArray(filter.value)) {
        return filter.value.includes(fieldValue);
      }
      return false;
    case "contains":
      if (typeof fieldValue === "string" && typeof filter.value === "string") {
        return fieldValue.toLowerCase().includes(filter.value.toLowerCase());
      }
      if (Array.isArray(fieldValue)) {
        return fieldValue.includes(filter.value);
      }
      return false;
    case "gt":
      if (typeof fieldValue === "number" && typeof filter.value === "number") {
        return fieldValue > filter.value;
      }
      return false;
    case "lt":
      if (typeof fieldValue === "number" && typeof filter.value === "number") {
        return fieldValue < filter.value;
      }
      return false;
    case "gte":
      if (typeof fieldValue === "number" && typeof filter.value === "number") {
        return fieldValue >= filter.value;
      }
      return false;
    case "lte":
      if (typeof fieldValue === "number" && typeof filter.value === "number") {
        return fieldValue <= filter.value;
      }
      return false;
    default:
      return false;
  }
}

export const apply = query({
  args: {
    segmentId: v.id("accountSegments"),
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const segment = await ctx.db.get(args.segmentId);
    if (!segment) {
      throw new Error("Segment not found");
    }
    await Promise.all([
      requireModuleEnabled(ctx, segment.organizationId, "accounts"),
      requirePermission(ctx, segment.organizationId, "accounts.read"),
    ]);
    const allAccounts = await ctx.db
      .query("accounts")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", segment.organizationId),
      )
      .collect();

    const filteredAccounts = allAccounts.filter((account) => {
      return segment.filters.every((filter: FilterCondition) =>
        applyFilter(account as Record<string, unknown>, filter),
      );
    });

    return filteredAccounts;
  },
});

export const create = mutation({
  args: {
    organizationId: v.id("organizations"),
    name: v.string(),
    description: v.optional(v.string()),
    filters: v.array(filterValidator),
  },
  returns: v.id("accountSegments"),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    await Promise.all([
      requireModuleEnabled(ctx, args.organizationId, "accounts"),
      requirePermission(ctx, args.organizationId, "accounts.write"),
    ]);
    const segmentId = await ctx.db.insert("accountSegments", {
      organizationId: args.organizationId,
      name: args.name.trim(),
      description: args.description?.trim(),
      filters: args.filters,
      createdBy: userId,
      createdAt: Date.now(),
    });

    await ctx.runMutation(internal.audit.logAction, {
      organizationId: args.organizationId,
      userId,
      action: "created_account_segment",
      entityType: "accountSegment",
      entityId: segmentId,
      changes: { name: args.name.trim() },
    });

    return segmentId;
  },
});

export const update = mutation({
  args: {
    segmentId: v.id("accountSegments"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    filters: v.optional(v.array(filterValidator)),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const segment = await ctx.db.get(args.segmentId);
    if (!segment) {
      throw new Error("Segment not found");
    }

    await Promise.all([
      requireModuleEnabled(ctx, segment.organizationId, "accounts"),
      requirePermission(ctx, segment.organizationId, "accounts.write"),
    ]);

    const updates: Record<string, unknown> = {
      updatedAt: Date.now(),
    };

    if (args.name !== undefined) updates.name = args.name.trim();
    if (args.description !== undefined)
      updates.description = args.description?.trim();
    if (args.filters !== undefined) updates.filters = args.filters;

    await Promise.all([
      ctx.db.patch(args.segmentId, updates),
      ctx.runMutation(internal.audit.logAction, {
      organizationId: segment.organizationId,
      userId,
      action: "updated_account_segment",
      entityType: "accountSegment",
      entityId: args.segmentId,
      changes: updates,
    }),
    ]);

    return null;
  },
});

export const remove = mutation({
  args: {
    segmentId: v.id("accountSegments"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const segment = await ctx.db.get(args.segmentId);
    if (!segment) {
      throw new Error("Segment not found");
    }
    await Promise.all([
      requireModuleEnabled(ctx, segment.organizationId, "accounts"),
      requirePermission(ctx, segment.organizationId, "accounts.manage"),
      ctx.db.delete(args.segmentId),
      ctx.runMutation(internal.audit.logAction, {
        organizationId: segment.organizationId,
        userId,
        action: "deleted_account_segment",
        entityType: "accountSegment",
        entityId: args.segmentId,
        changes: { name: segment.name },
      }),
    ] as const);

    return null;
  },
});
