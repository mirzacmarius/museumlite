import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { NOTIFICATION_TYPES } from "./notifications";
import { requirePermission } from "./utils/permissions";

const workflowTypeValidator = v.union(
  v.literal("accession"),
  v.literal("deaccession"),
  v.literal("loan"),
  v.literal("acquisition"),
  v.literal("exhibition"),
  v.literal("conservation"),
);

export const list = query({
  args: {
    organizationId: v.id("organizations"),
  },
  returns: v.array(
    v.object({
      _id: v.id("workflowSlaConfigs"),
      workflowType: workflowTypeValidator,
      slaDays: v.number(),
      warningDays: v.optional(v.number()),
      escalateToRoleId: v.optional(v.id("roles")),
      isActive: v.optional(v.boolean()),
    }),
  ),
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.organizationId, "settings.read");

    const configs = await ctx.db
      .query("workflowSlaConfigs")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .collect();

    return configs.map((c) => ({
      _id: c._id,
      workflowType: c.workflowType,
      slaDays: c.slaDays,
      warningDays: c.warningDays,
      escalateToRoleId: c.escalateToRoleId,
      isActive: c.isActive,
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
      _id: v.id("workflowSlaConfigs"),
      workflowType: workflowTypeValidator,
      slaDays: v.number(),
      warningDays: v.optional(v.number()),
      escalateToRoleId: v.optional(v.id("roles")),
      isActive: v.optional(v.boolean()),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.organizationId, "settings.read");

    const config = await ctx.db
      .query("workflowSlaConfigs")
      .withIndex("by_organization_and_type", (q) =>
        q
          .eq("organizationId", args.organizationId)
          .eq("workflowType", args.workflowType),
      )
      .unique();

    if (!config) return null;

    return {
      _id: config._id,
      workflowType: config.workflowType,
      slaDays: config.slaDays,
      warningDays: config.warningDays,
      escalateToRoleId: config.escalateToRoleId,
      isActive: config.isActive,
    };
  },
});

export const upsert = mutation({
  args: {
    organizationId: v.id("organizations"),
    workflowType: workflowTypeValidator,
    slaDays: v.number(),
    warningDays: v.optional(v.number()),
    escalateToRoleId: v.optional(v.id("roles")),
    isActive: v.optional(v.boolean()),
  },
  returns: v.id("workflowSlaConfigs"),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    await requirePermission(ctx, args.organizationId, "settings.update");

    const existing = await ctx.db
      .query("workflowSlaConfigs")
      .withIndex("by_organization_and_type", (q) =>
        q
          .eq("organizationId", args.organizationId)
          .eq("workflowType", args.workflowType),
      )
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        slaDays: args.slaDays,
        warningDays: args.warningDays,
        escalateToRoleId: args.escalateToRoleId,
        isActive: args.isActive,
        updatedAt: Date.now(),
      });

      await ctx.runMutation(internal.audit.logAction, {
        organizationId: args.organizationId,
        userId,
        action: "updated_workflow_sla_config",
        entityType: "workflowSlaConfig",
        entityId: existing._id,
        changes: {
          workflowType: args.workflowType,
          slaDays: args.slaDays,
          warningDays: args.warningDays,
          isActive: args.isActive,
        },
      });

      return existing._id;
    }

    const configId = await ctx.db.insert("workflowSlaConfigs", {
      organizationId: args.organizationId,
      workflowType: args.workflowType,
      slaDays: args.slaDays,
      warningDays: args.warningDays,
      escalateToRoleId: args.escalateToRoleId,
      isActive: args.isActive ?? true,
      createdBy: userId,
      createdAt: Date.now(),
    });

    await ctx.runMutation(internal.audit.logAction, {
      organizationId: args.organizationId,
      userId,
      action: "created_workflow_sla_config",
      entityType: "workflowSlaConfig",
      entityId: configId,
      changes: {
        workflowType: args.workflowType,
        slaDays: args.slaDays,
        warningDays: args.warningDays,
        isActive: args.isActive ?? true,
      },
    });

    return configId;
  },
});

export const remove = mutation({
  args: {
    id: v.id("workflowSlaConfigs"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const config = await ctx.db.get(args.id);
    if (!config) {
      throw new Error("SLA config not found");
    }

    await requirePermission(ctx, config.organizationId, "settings.update");

    await ctx.db.delete(args.id);

    await ctx.runMutation(internal.audit.logAction, {
      organizationId: config.organizationId,
      userId,
      action: "deleted_workflow_sla_config",
      entityType: "workflowSlaConfig",
      entityId: args.id,
      changes: {
        workflowType: config.workflowType,
        slaDays: config.slaDays,
      },
    });

    return null;
  },
});

export const getOrganizationsWithSlaConfigs = internalQuery({
  args: {},
  returns: v.array(v.id("organizations")),
  handler: async (ctx) => {
    const configs = await ctx.db.query("workflowSlaConfigs").collect();
    const orgIds = new Set(configs.map((c) => c.organizationId));
    return Array.from(orgIds);
  },
});

export const checkAllOrganizationsSla = internalMutation({
  args: {},
  returns: v.object({
    organizationsChecked: v.number(),
    totalBreaches: v.number(),
    totalWarnings: v.number(),
  }),
  handler: async (
    ctx,
  ): Promise<{
    organizationsChecked: number;
    totalBreaches: number;
    totalWarnings: number;
  }> => {
    const orgIds: Array<Id<"organizations">> = await ctx.runQuery(
      internal.workflowSla.getOrganizationsWithSlaConfigs,
      {},
    );

    let totalBreaches = 0;
    let totalWarnings = 0;

    for (const orgId of orgIds) {
      const result = await ctx.runMutation(
        internal.workflowSla.checkSlaBreaches,
        { organizationId: orgId },
      );
      totalBreaches += result.breachesFound;
      totalWarnings += result.warningsSent;
    }

    return {
      organizationsChecked: orgIds.length,
      totalBreaches,
      totalWarnings,
    };
  },
});

export const checkSlaBreaches = internalMutation({
  args: {
    organizationId: v.id("organizations"),
  },
  returns: v.object({
    breachesFound: v.number(),
    warningsSent: v.number(),
  }),
  handler: async (ctx, args) => {
    const slaConfigs = await ctx.db
      .query("workflowSlaConfigs")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .filter((q) => q.neq(q.field("isActive"), false))
      .collect();

    if (slaConfigs.length === 0) {
      return { breachesFound: 0, warningsSent: 0 };
    }

    let breachesFound = 0;
    let warningsSent = 0;
    const now = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;

    const workflowQueries: Array<{
      type: string;
      items: Array<{ id: string; createdAt: number }>;
    }> = [];

    for (const config of slaConfigs) {
      const slaDueThreshold = now - config.slaDays * oneDayMs;
      const warningThreshold = config.warningDays
        ? now - (config.slaDays - config.warningDays) * oneDayMs
        : null;

      let items: Array<{ id: string; createdAt: number }> = [];

      if (config.workflowType === "accession") {
        const pending = await ctx.db
          .query("accessions")
          .withIndex("by_organization_and_status", (q) =>
            q.eq("organizationId", args.organizationId).eq("status", "pending"),
          )
          .collect();
        items = pending.map((p) => ({ id: p._id, createdAt: p.dateReceived }));
      } else if (config.workflowType === "deaccession") {
        const pending = await ctx.db
          .query("deaccessions")
          .withIndex("by_organization_and_status", (q) =>
            q.eq("organizationId", args.organizationId).eq("status", "pending"),
          )
          .collect();
        items = pending.map((p) => ({
          id: p._id,
          createdAt: p.dateDeaccessioned,
        }));
      } else if (config.workflowType === "loan") {
        const pending = await ctx.db
          .query("loans")
          .withIndex("by_organization_and_status", (q) =>
            q.eq("organizationId", args.organizationId).eq("status", "pending"),
          )
          .collect();
        items = pending.map((p) => ({ id: p._id, createdAt: p.startDate }));
      } else if (config.workflowType === "exhibition") {
        const pending = await ctx.db
          .query("exhibitions")
          .withIndex("by_organization_and_status", (q) =>
            q
              .eq("organizationId", args.organizationId)
              .eq("status", "proposed"),
          )
          .collect();
        items = pending.map((p) => ({ id: p._id, createdAt: p.startDate }));
      } else if (config.workflowType === "conservation") {
        const pending = await ctx.db
          .query("conservationTreatments")
          .withIndex("by_organization_and_status", (q) =>
            q
              .eq("organizationId", args.organizationId)
              .eq("status", "proposed"),
          )
          .collect();
        items = pending.map((p) => ({ id: p._id, createdAt: p.performedAt }));
      }

      for (const item of items) {
        if (item.createdAt < slaDueThreshold) {
          breachesFound++;
          if (config.escalateToRoleId) {
            await ctx.runMutation(
              internal.notifications.notifyUsersWithPermission,
              {
                organizationId: args.organizationId,
                permission: `${config.workflowType}s.approve`,
                type: `sla_breach_${config.workflowType}`,
                title: `SLA Breach: ${config.workflowType} pending over ${config.slaDays} days`,
                message: `A ${config.workflowType} has exceeded its SLA of ${config.slaDays} days and requires immediate attention.`,
                relatedEntityType: config.workflowType,
                relatedEntityId: item.id,
              },
            );
          }
        } else if (warningThreshold && item.createdAt < warningThreshold) {
          warningsSent++;
          await ctx.runMutation(
            internal.notifications.notifyUsersWithPermission,
            {
              organizationId: args.organizationId,
              permission: `${config.workflowType}s.approve`,
              type: `sla_warning_${config.workflowType}`,
              title: `SLA Warning: ${config.workflowType} due in ${config.warningDays} days`,
              message: `A ${config.workflowType} is approaching its SLA deadline. Please review soon.`,
              relatedEntityType: config.workflowType,
              relatedEntityId: item.id,
            },
          );
        }
      }
    }

    return { breachesFound, warningsSent };
  },
});
