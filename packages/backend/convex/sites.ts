import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { requireFeatureAccess } from "./utils/featureGates";
import { requirePermission } from "./utils/permissions";

/**
 * Create site
 */
export const create = mutation({
  args: {
    organizationId: v.id("organizations"),
    name: v.string(),
    description: v.optional(v.string()),
    address: v.optional(v.string()),
    isPrimary: v.optional(v.boolean()),
  },
  returns: v.id("sites"),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    await Promise.all([
      requireFeatureAccess(ctx, args.organizationId, "public_portal"),
      requirePermission(ctx, args.organizationId, "sites.create"),
    ]);
    const organization = await ctx.db.get(args.organizationId);
    if (!organization) {
      throw new Error("Organization not found");
    }

    // If marking as primary, unset any existing primary site
    if (args.isPrimary) {
      const existingPrimary = await ctx.db
        .query("sites")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", args.organizationId),
        )
        .filter((q) => q.eq(q.field("isPrimary"), true))
        .first();

      if (existingPrimary) {
        await ctx.db.patch(existingPrimary._id, { isPrimary: false });
      }
    }

    const siteId = await ctx.db.insert("sites", {
      organizationId: args.organizationId,
      name: args.name,
      description: args.description,
      address: args.address,
      isActive: true,
      isPrimary: args.isPrimary ?? false,
    });

    return siteId;
  },
});

/**
 * Get site by ID
 */
export const get = query({
  args: {
    siteId: v.id("sites"),
  },
  returns: v.union(
    v.object({
      _id: v.id("sites"),
      organizationId: v.id("organizations"),
      name: v.string(),
      description: v.optional(v.string()),
      address: v.optional(v.string()),
      isActive: v.boolean(),
      isPrimary: v.boolean(),
      _creationTime: v.number(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const site = await ctx.db.get(args.siteId);
    if (!site) {
      return null;
    }

    await requireFeatureAccess(ctx, site.organizationId, "public_portal");

    // Check permission
    await requirePermission(ctx, site.organizationId, "sites.read");

    return site;
  },
});

/**
 * List all sites for an organization
 */
export const list = query({
  args: {
    organizationId: v.id("organizations"),
    activeOnly: v.optional(v.boolean()),
  },
  returns: v.array(
    v.object({
      _id: v.id("sites"),
      organizationId: v.id("organizations"),
      name: v.string(),
      description: v.optional(v.string()),
      address: v.optional(v.string()),
      isActive: v.boolean(),
      isPrimary: v.boolean(),
      _creationTime: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    await requireFeatureAccess(ctx, args.organizationId, "public_portal");

    // Check permission
    await requirePermission(ctx, args.organizationId, "sites.read");

    let query = ctx.db
      .query("sites")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      );

    // Filter by active status if requested
    if (args.activeOnly) {
      query = query.filter((q) => q.eq(q.field("isActive"), true));
    }

    const sites = await query.collect();

    // Sort by primary first, then by name
    return sites.sort((a, b) => {
      if (a.isPrimary && !b.isPrimary) return -1;
      if (!a.isPrimary && b.isPrimary) return 1;
      return a.name.localeCompare(b.name);
    });
  },
});

/**
 * Update site
 */
export const update = mutation({
  args: {
    siteId: v.id("sites"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    address: v.optional(v.string()),
    isPrimary: v.optional(v.boolean()),
  },
  returns: v.id("sites"),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Get the site to verify it exists and get organizationId
    const site = await ctx.db.get(args.siteId);
    if (!site) {
      throw new Error("Site not found");
    }

    await requireFeatureAccess(ctx, site.organizationId, "public_portal");

    // Check permission
    await requirePermission(ctx, site.organizationId, "sites.update");

    // If marking as primary, unset any existing primary site
    if (args.isPrimary) {
      const existingPrimary = await ctx.db
        .query("sites")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", site.organizationId),
        )
        .filter((q) => q.eq(q.field("isPrimary"), true))
        .first();

      if (existingPrimary && existingPrimary._id !== args.siteId) {
        await ctx.db.patch(existingPrimary._id, { isPrimary: false });
      }
    }

    // Build update object with only provided fields
    const updates: {
      name?: string;
      description?: string;
      address?: string;
      isPrimary?: boolean;
    } = {};

    if (args.name !== undefined) updates.name = args.name;
    if (args.description !== undefined) updates.description = args.description;
    if (args.address !== undefined) updates.address = args.address;
    if (args.isPrimary !== undefined) updates.isPrimary = args.isPrimary;

    await ctx.db.patch(args.siteId, updates);

    return args.siteId;
  },
});

/**
 * Archive site (soft delete)
 */
export const archive = mutation({
  args: {
    siteId: v.id("sites"),
  },
  returns: v.id("sites"),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Get the site to verify it exists and get organizationId
    const site = await ctx.db.get(args.siteId);
    if (!site) {
      throw new Error("Site not found");
    }

    if (site.isPrimary) {
      throw new Error("Cannot archive the primary site");
    }

    await Promise.all([
      requireFeatureAccess(ctx, site.organizationId, "public_portal"),
      requirePermission(
ctx, site.organizationId, "sites.delete"
    ),
    ]);

    // TODO: Add validation for active locations once siteId is added to locations table
    // This will be implemented in a later subtask (subtask-3-1)

    await ctx.db.patch(args.siteId, { isActive: false });

    return args.siteId;
  },
});

/**
 * Grant user access to a site
 */
export const grantUserSiteAccess = mutation({
  args: {
    siteId: v.id("sites"),
    userId: v.id("users"),
  },
  returns: v.id("userSites"),
  handler: async (ctx, args) => {
    const currentUserId = await getAuthUserId(ctx);
    if (!currentUserId) {
      throw new Error("Not authenticated");
    }

    // Get the site to verify it exists and get organizationId
    const site = await ctx.db.get(args.siteId);
    if (!site) {
      throw new Error("Site not found");
    }
    await Promise.all([
      requireFeatureAccess(ctx, site.organizationId, "public_portal"),
      requirePermission(ctx, site.organizationId, "sites.update"),
    ]);
    const user = await ctx.db.get(args.userId);
    if (!user) {
      throw new Error("User not found");
    }

    // Verify the user is a member of the organization
    const membership = await ctx.db
      .query("userOrganizations")
      .withIndex("by_user_and_organization", (q) =>
        q.eq("userId", args.userId).eq("organizationId", site.organizationId),
      )
      .first();

    if (!membership) {
      throw new Error("User is not a member of this organization");
    }

    // Check if user-site assignment already exists
    const existing = await ctx.db
      .query("userSites")
      .withIndex("by_user_and_site", (q) =>
        q.eq("userId", args.userId).eq("siteId", args.siteId),
      )
      .first();

    if (existing) {
      // Update existing assignment
      await ctx.db.patch(existing._id, { canAccess: true });
      return existing._id;
    }

    // Create new user-site assignment
    const userSiteId = await ctx.db.insert("userSites", {
      userId: args.userId,
      siteId: args.siteId,
      canAccess: true,
    });

    return userSiteId;
  },
});

/**
 * Revoke user access to a site
 */
export const revokeUserSiteAccess = mutation({
  args: {
    siteId: v.id("sites"),
    userId: v.id("users"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const currentUserId = await getAuthUserId(ctx);
    if (!currentUserId) {
      throw new Error("Not authenticated");
    }

    // Get the site to verify it exists and get organizationId
    const site = await ctx.db.get(args.siteId);
    if (!site) {
      throw new Error("Site not found");
    }
    await Promise.all([
      requireFeatureAccess(ctx, site.organizationId, "public_portal"),
      requirePermission(ctx, site.organizationId, "sites.update"),
    ]);
    const userSite = await ctx.db
      .query("userSites")
      .withIndex("by_user_and_site", (q) =>
        q.eq("userId", args.userId).eq("siteId", args.siteId),
      )
      .first();

    if (!userSite) {
      // No assignment exists, nothing to do
      return null;
    }

    // Set canAccess to false
    await ctx.db.patch(userSite._id, { canAccess: false });

    return null;
  },
});
