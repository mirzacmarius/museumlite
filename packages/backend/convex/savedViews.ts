import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { mutation, query } from "./_generated/server";

const moduleValidator = v.union(
  v.literal("objects"),
  v.literal("loans"),
  v.literal("accounts"),
  v.literal("locations"),
  v.literal("accessions"),
);

const savedViewValidator = v.object({
  _id: v.id("savedViews"),
  _creationTime: v.number(),
  organizationId: v.id("organizations"),
  userId: v.id("users"),
  name: v.string(),
  module: moduleValidator,
  filters: v.string(),
  isDefault: v.optional(v.boolean()),
  createdAt: v.number(),
  lastUsedAt: v.optional(v.number()),
});

export const list = query({
  args: {
    organizationId: v.id("organizations"),
    module: v.optional(moduleValidator),
  },
  returns: v.array(savedViewValidator),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }

    const baseQuery = ctx.db
      .query("savedViews")
      .withIndex("by_organization_and_user", (q) =>
        q.eq("organizationId", args.organizationId).eq("userId", userId),
      );

    const views = await baseQuery.collect();

    if (args.module) {
      return views.filter((v) => v.module === args.module);
    }

    return views;
  },
});

export const get = query({
  args: {
    viewId: v.id("savedViews"),
  },
  returns: v.union(savedViewValidator, v.null()),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }

    const view = await ctx.db.get(args.viewId);
    if (!view || view.userId !== userId) {
      return null;
    }

    return view;
  },
});

export const getDefault = query({
  args: {
    organizationId: v.id("organizations"),
    module: moduleValidator,
  },
  returns: v.union(savedViewValidator, v.null()),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }

    const views = await ctx.db
      .query("savedViews")
      .withIndex("by_user_and_module", (q) =>
        q.eq("userId", userId).eq("module", args.module),
      )
      .collect();

    const defaultView = views.find(
      (v) => v.organizationId === args.organizationId && v.isDefault === true,
    );

    return defaultView ?? null;
  },
});

export const create = mutation({
  args: {
    organizationId: v.id("organizations"),
    name: v.string(),
    module: moduleValidator,
    filters: v.string(),
    isDefault: v.optional(v.boolean()),
  },
  returns: v.id("savedViews"),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    if (args.isDefault) {
      const existingViews = await ctx.db
        .query("savedViews")
        .withIndex("by_user_and_module", (q) =>
          q.eq("userId", userId).eq("module", args.module),
        )
        .collect();

      await Promise.all(
        existingViews
          .filter(
            (view) =>
              view.organizationId === args.organizationId &&
              view.isDefault === true,
          )
          .map((view) => ctx.db.patch(view._id, { isDefault: false })),
      );
    }

    const viewId = await ctx.db.insert("savedViews", {
      organizationId: args.organizationId,
      userId,
      name: args.name.trim(),
      module: args.module,
      filters: args.filters,
      isDefault: args.isDefault ?? false,
      createdAt: Date.now(),
    });

    await ctx.runMutation(internal.audit.logAction, {
      organizationId: args.organizationId,
      userId,
      action: "created_saved_view",
      entityType: "savedView",
      entityId: viewId,
      changes: { name: args.name.trim(), module: args.module },
    });

    return viewId;
  },
});

export const update = mutation({
  args: {
    viewId: v.id("savedViews"),
    name: v.optional(v.string()),
    filters: v.optional(v.string()),
    isDefault: v.optional(v.boolean()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const view = await ctx.db.get(args.viewId);
    if (!view) {
      throw new Error("View not found");
    }

    if (view.userId !== userId) {
      throw new Error("Not authorized to update this view");
    }

    if (args.isDefault === true) {
      const existingViews = await ctx.db
        .query("savedViews")
        .withIndex("by_user_and_module", (q) =>
          q.eq("userId", userId).eq("module", view.module),
        )
        .collect();

      await Promise.all(
        existingViews
          .filter(
            (existingView) =>
              existingView._id !== args.viewId &&
              existingView.organizationId === view.organizationId &&
              existingView.isDefault === true,
          )
          .map((existingView) =>
            ctx.db.patch(existingView._id, { isDefault: false }),
          ),
      );
    }

    const updates: Record<string, unknown> = {};
    if (args.name !== undefined) updates.name = args.name.trim();
    if (args.filters !== undefined) updates.filters = args.filters;
    if (args.isDefault !== undefined) updates.isDefault = args.isDefault;

    await Promise.all([
      ctx.db.patch(args.viewId, updates),
      ctx.runMutation(internal.audit.logAction, {
      organizationId: view.organizationId,
      userId,
      action: "updated_saved_view",
      entityType: "savedView",
      entityId: args.viewId,
      changes: updates,
    }),
    ]);

    return null;
  },
});

export const markUsed = mutation({
  args: {
    viewId: v.id("savedViews"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const view = await ctx.db.get(args.viewId);
    if (!view || view.userId !== userId) {
      return null;
    }

    await ctx.db.patch(args.viewId, { lastUsedAt: Date.now() });

    return null;
  },
});

export const remove = mutation({
  args: {
    viewId: v.id("savedViews"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const view = await ctx.db.get(args.viewId);
    if (!view) {
      throw new Error("View not found");
    }

    if (view.userId !== userId) {
      throw new Error("Not authorized to delete this view");
    }

    await Promise.all([
      ctx.db.delete(args.viewId),
      ctx.runMutation(internal.audit.logAction, {
        organizationId: view.organizationId,
        userId,
        action: "deleted_saved_view",
        entityType: "savedView",
        entityId: args.viewId,
        changes: { name: view.name, module: view.module },
      }),
    ]);

    return null;
  },
});
