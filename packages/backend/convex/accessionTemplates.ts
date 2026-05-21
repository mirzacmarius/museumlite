import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { mutation, query } from "./_generated/server";
import { accessionParser } from "./utils/accessionNumberParser";
import { requirePermission } from "./utils/permissions";

/**
 * List all custom templates for an organization
 */
export const list = query({
  args: {
    organizationId: v.id("organizations"),
  },
  returns: v.array(
    v.object({
      _id: v.id("accessionTemplates"),
      _creationTime: v.number(),
      organizationId: v.id("organizations"),
      name: v.string(),
      template: v.string(),
      description: v.optional(v.string()),
      isDefault: v.boolean(),
      createdBy: v.id("users"),
      createdAt: v.number(),
      usageCount: v.optional(v.number()),
      lastUsedAt: v.optional(v.number()),
    }),
  ),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("accessionTemplates")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .order("desc")
      .collect();
  },
});

/**
 * Create a new custom template
 */
export const create = mutation({
  args: {
    organizationId: v.id("organizations"),
    name: v.string(),
    template: v.string(),
    description: v.optional(v.string()),
  },
  returns: v.id("accessionTemplates"),
  handler: async (ctx, args) => {
    const [userId] = await Promise.all([
      getAuthUserId(ctx),
      requirePermission(
        ctx,
        args.organizationId,
        "organization.manage_settings",
      ),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Validate template
    const org = await ctx.db.get(args.organizationId);
    if (!org) {
      throw new Error("Organization not found");
    }

    const validation = accessionParser.validate(args.template, org.slug);
    if (!validation.isValid) {
      throw new Error(`Invalid template: ${validation.error}`);
    }

    // Check if template already exists
    const existing = await ctx.db
      .query("accessionTemplates")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .filter((q) => q.eq(q.field("template"), args.template))
      .first();

    if (existing) {
      throw new Error("Template already exists");
    }

    const templateId = await ctx.db.insert("accessionTemplates", {
      organizationId: args.organizationId,
      name: args.name,
      template: args.template,
      description: args.description,
      isDefault: false,
      createdBy: userId,
      createdAt: Date.now(),
      usageCount: 0,
    });

    await ctx.runMutation(internal.audit.logAction, {
      organizationId: args.organizationId,
      userId,
      action: "created_accession_template",
      entityType: "accessionTemplate",
      entityId: templateId,
      changes: {
        name: args.name,
        template: args.template,
        description: args.description,
      },
    });

    return templateId;
  },
});

/**
 * Update a custom template
 */
export const update = mutation({
  args: {
    templateId: v.id("accessionTemplates"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    template: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const [userId, template] = await Promise.all([
      getAuthUserId(ctx),
      ctx.db.get(args.templateId),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    if (!template) {
      throw new Error("Template not found");
    }

    await requirePermission(
      ctx,
      template.organizationId,
      "organization.manage_settings",
    );

    // Validate new template if provided
    if (args.template) {
      const org = await ctx.db.get(template.organizationId);
      if (!org) {
        throw new Error("Organization not found");
      }

      const validation = accessionParser.validate(args.template, org.slug);
      if (!validation.isValid) {
        throw new Error(`Invalid template: ${validation.error}`);
      }
    }

    const updates: {
      name?: string;
      description?: string;
      template?: string;
    } = {};

    if (args.name !== undefined) {
      updates.name = args.name;
    }

    if (args.description !== undefined) {
      updates.description = args.description;
    }

    if (args.template !== undefined) {
      updates.template = args.template;
    }

    await Promise.all([
      ctx.db.patch(args.templateId, updates),
      ctx.runMutation(internal.audit.logAction, {
        organizationId: template.organizationId,
        userId,
        action: "updated_accession_template",
        entityType: "accessionTemplate",
        entityId: args.templateId,
        changes: {
          name: args.name,
          description: args.description,
          template: args.template,
        },
      }),
    ]);

    return null;
  },
});

/**
 * Delete a custom template
 */
export const remove = mutation({
  args: {
    templateId: v.id("accessionTemplates"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const [userId, template] = await Promise.all([
      getAuthUserId(ctx),
      ctx.db.get(args.templateId),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    if (!template) {
      throw new Error("Template not found");
    }
    await Promise.all([
      requirePermission(
        ctx,
        template.organizationId,
        "organization.manage_settings",
      ),
      ctx.db.delete(args.templateId),
      ctx.runMutation(internal.audit.logAction, {
        organizationId: template.organizationId,
        userId,
        action: "deleted_accession_template",
        entityType: "accessionTemplate",
        entityId: args.templateId,
        changes: {
          name: template.name,
          template: template.template,
        },
      }),
    ] as const);

    return null;
  },
});

/**
 * Set a template as default for the organization
 */
export const setDefault = mutation({
  args: {
    templateId: v.id("accessionTemplates"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const [userId, template] = await Promise.all([
      getAuthUserId(ctx),
      ctx.db.get(args.templateId),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    if (!template) {
      throw new Error("Template not found");
    }

    const [, allTemplates] = await Promise.all([
      requirePermission(
        ctx,
        template.organizationId,
        "organization.manage_settings",
      ),
      ctx.db
        .query("accessionTemplates")
        .withIndex("by_organization_and_default", (q) =>
          q.eq("organizationId", template.organizationId).eq("isDefault", true),
        )
        .collect(),
    ] as const);

    await Promise.all([
      ...allTemplates.map((t) => ctx.db.patch(t._id, { isDefault: false })),
      ctx.db.patch(args.templateId, { isDefault: true }),
      ctx.runMutation(internal.audit.logAction, {
        organizationId: template.organizationId,
        userId,
        action: "set_default_accession_template",
        entityType: "accessionTemplate",
        entityId: args.templateId,
        changes: {
          name: template.name,
          template: template.template,
        },
      }),
    ] as const);

    return null;
  },
});

/**
 * Increment usage counter for a template
 */
export const incrementUsage = mutation({
  args: {
    templateId: v.id("accessionTemplates"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const template = await ctx.db.get(args.templateId);
    if (!template) {
      return null;
    }

    await ctx.db.patch(args.templateId, {
      usageCount: (template.usageCount ?? 0) + 1,
      lastUsedAt: Date.now(),
    });

    return null;
  },
});
