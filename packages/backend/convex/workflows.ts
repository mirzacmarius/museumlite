import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { requirePermission } from "./utils/permissions";

const workflowTypeValidator = v.union(
  v.literal("accession"),
  v.literal("deaccession"),
  v.literal("loan"),
  v.literal("acquisition"),
  v.literal("exhibition"),
  v.literal("conservation"),
);

const stepValidator = v.object({
  stepNumber: v.number(),
  roleId: v.id("roles"),
  name: v.string(),
});

export const list = query({
  args: {
    organizationId: v.id("organizations"),
  },
  returns: v.array(
    v.object({
      _id: v.id("workflowConfigs"),
      _creationTime: v.number(),
      workflowType: workflowTypeValidator,
      steps: v.array(stepValidator),
      canInitiateRoles: v.array(v.id("roles")),
    }),
  ),
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.organizationId, "settings.read");

    const configs = await ctx.db
      .query("workflowConfigs")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .collect();

    return configs.map((config) => ({
      _id: config._id,
      _creationTime: config._creationTime,
      workflowType: config.workflowType,
      steps: config.steps,
      canInitiateRoles: config.canInitiateRoles,
    }));
  },
});

export const get = query({
  args: {
    organizationId: v.id("organizations"),
    workflowType: workflowTypeValidator,
  },
  returns: v.union(
    v.object({
      _id: v.id("workflowConfigs"),
      _creationTime: v.number(),
      workflowType: workflowTypeValidator,
      steps: v.array(stepValidator),
      canInitiateRoles: v.array(v.id("roles")),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.organizationId, "settings.read");

    const config = await ctx.db
      .query("workflowConfigs")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .filter((q) => q.eq(q.field("workflowType"), args.workflowType))
      .unique();

    if (!config) {
      return null;
    }

    return {
      _id: config._id,
      _creationTime: config._creationTime,
      workflowType: config.workflowType,
      steps: config.steps,
      canInitiateRoles: config.canInitiateRoles,
    };
  },
});

export const upsert = mutation({
  args: {
    organizationId: v.id("organizations"),
    workflowType: workflowTypeValidator,
    steps: v.array(stepValidator),
    canInitiateRoles: v.array(v.id("roles")),
  },
  returns: v.id("workflowConfigs"),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    await requirePermission(ctx, args.organizationId, "settings.update");

    const existing = await ctx.db
      .query("workflowConfigs")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .filter((q) => q.eq(q.field("workflowType"), args.workflowType))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        steps: args.steps,
        canInitiateRoles: args.canInitiateRoles,
      });
      return existing._id;
    }

    const configId = await ctx.db.insert("workflowConfigs", {
      organizationId: args.organizationId,
      workflowType: args.workflowType,
      steps: args.steps,
      canInitiateRoles: args.canInitiateRoles,
    });

    return configId;
  },
});

export const remove = mutation({
  args: {
    id: v.id("workflowConfigs"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const config = await ctx.db.get(args.id);
    if (!config) {
      throw new Error("Workflow config not found");
    }

    await requirePermission(ctx, config.organizationId, "settings.update");

    await ctx.db.delete(args.id);
    return null;
  },
});
