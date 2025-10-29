import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

/**
 * Create new organization
 */
export const create = mutation({
  args: {
    name: v.string(),
    slug: v.string(),
    type: v.union(
      v.literal("museum"),
      v.literal("gallery"),
      v.literal("library"),
      v.literal("collector"),
    ),
    settings: v.optional(
      v.object({
        accessionNumberFormat: v.optional(v.string()),
        autoGenerateAccessionNumbers: v.optional(v.boolean()),
        locationTypes: v.optional(v.array(v.string())),
        enableDetailedConditionReports: v.optional(v.boolean()),
      }),
    ),
  },
  returns: v.id("organizations"),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Check if slug is unique
    const existing = await ctx.db
      .query("organizations")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();

    if (existing) {
      throw new Error("Organization slug already exists");
    }

    // Create organization
    const organizationId = await ctx.db.insert("organizations", {
      name: args.name,
      slug: args.slug,
      type: args.type,
      settings: args.settings,
      subscriptionTier: "free",
    });

    // Create default roles for the organization
    await ctx.runMutation(internal.organizations.createDefaultRoles, {
      organizationId,
    });

    // Add creator as admin
    const adminRole = await ctx.db
      .query("roles")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", organizationId),
      )
      .filter((q) =>
        q.and(
          q.eq(q.field("name"), "admin"),
          q.eq(q.field("isSystemRole"), true),
        ),
      )
      .first();

    if (adminRole) {
      await ctx.db.insert("userOrganizations", {
        userId,
        organizationId,
        roleId: adminRole._id,
        joinedAt: Date.now(),
      });
    }

    return organizationId;
  },
});

/**
 * Get organization by ID
 */
export const get = query({
  args: {
    organizationId: v.id("organizations"),
  },
  returns: v.union(
    v.object({
      _id: v.id("organizations"),
      name: v.string(),
      slug: v.string(),
      type: v.union(
        v.literal("museum"),
        v.literal("gallery"),
        v.literal("library"),
        v.literal("collector"),
      ),
      settings: v.optional(
        v.object({
          accessionNumberFormat: v.optional(v.string()),
          autoGenerateAccessionNumbers: v.optional(v.boolean()),
          locationTypes: v.optional(v.array(v.string())),
          enableDetailedConditionReports: v.optional(v.boolean()),
        }),
      ),
      subscriptionTier: v.optional(
        v.union(
          v.literal("free"),
          v.literal("pro"),
          v.literal("enterprise"),
        ),
      ),
      _creationTime: v.number(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const org = await ctx.db.get(args.organizationId);
    return org;
  },
});

/**
 * Get organization by slug
 */
export const getBySlug = query({
  args: {
    slug: v.string(),
  },
  returns: v.union(
    v.object({
      _id: v.id("organizations"),
      name: v.string(),
      slug: v.string(),
      type: v.union(
        v.literal("museum"),
        v.literal("gallery"),
        v.literal("library"),
        v.literal("collector"),
      ),
      settings: v.optional(
        v.object({
          accessionNumberFormat: v.optional(v.string()),
          autoGenerateAccessionNumbers: v.optional(v.boolean()),
          locationTypes: v.optional(v.array(v.string())),
          enableDetailedConditionReports: v.optional(v.boolean()),
        }),
      ),
      subscriptionTier: v.optional(
        v.union(
          v.literal("free"),
          v.literal("pro"),
          v.literal("enterprise"),
        ),
      ),
      _creationTime: v.number(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const org = await ctx.db
      .query("organizations")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();
    return org ?? null;
  },
});

/**
 * Update organization settings
 */
export const update = mutation({
  args: {
    organizationId: v.id("organizations"),
    name: v.optional(v.string()),
    settings: v.optional(
      v.object({
        accessionNumberFormat: v.optional(v.string()),
        autoGenerateAccessionNumbers: v.optional(v.boolean()),
        locationTypes: v.optional(v.array(v.string())),
        enableDetailedConditionReports: v.optional(v.boolean()),
      }),
    ),
    subscriptionTier: v.optional(
      v.union(
        v.literal("free"),
        v.literal("pro"),
        v.literal("enterprise"),
      ),
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Check permission
    const { requirePermission } = await import("./utils/permissions");
    await requirePermission(ctx, args.organizationId, "organization.manage_settings");

    const updates: {
      name?: string;
      settings?: {
        accessionNumberFormat?: string;
        autoGenerateAccessionNumbers?: boolean;
        locationTypes?: string[];
        enableDetailedConditionReports?: boolean;
      };
      subscriptionTier?: "free" | "pro" | "enterprise";
    } = {};

    if (args.name !== undefined) {
      updates.name = args.name;
    }
    if (args.settings !== undefined) {
      updates.settings = args.settings;
    }
    if (args.subscriptionTier !== undefined) {
      updates.subscriptionTier = args.subscriptionTier;
    }

    await ctx.db.patch(args.organizationId, updates);
    return null;
  },
});

/**
 * Get organization settings
 */
export const getSettings = query({
  args: {
    organizationId: v.id("organizations"),
  },
  returns: v.union(
    v.object({
      accessionNumberFormat: v.optional(v.string()),
      autoGenerateAccessionNumbers: v.optional(v.boolean()),
      locationTypes: v.optional(v.array(v.string())),
      enableDetailedConditionReports: v.optional(v.boolean()),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const org = await ctx.db.get(args.organizationId);
    return org?.settings ?? null;
  },
});

/**
 * Update workflow configuration
 */
export const updateWorkflowConfig = mutation({
  args: {
    organizationId: v.id("organizations"),
    workflowType: v.union(v.literal("accession"), v.literal("deaccession")),
    steps: v.array(
      v.object({
        stepNumber: v.number(),
        roleId: v.id("roles"),
        name: v.string(),
      }),
    ),
    canInitiateRoles: v.array(v.id("roles")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Check permission
    const { requirePermission } = await import("./utils/permissions");
    await requirePermission(ctx, args.organizationId, "organization.manage_settings");

    // Check if workflow config exists
    const existing = await ctx.db
      .query("workflowConfigs")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .filter((q) => q.eq(q.field("workflowType"), args.workflowType))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        steps: args.steps,
        canInitiateRoles: args.canInitiateRoles,
      });
    } else {
      await ctx.db.insert("workflowConfigs", {
        organizationId: args.organizationId,
        workflowType: args.workflowType,
        steps: args.steps,
        canInitiateRoles: args.canInitiateRoles,
      });
    }

    return null;
  },
});

/**
 * Update accession number format
 */
export const updateAccessionNumberFormat = mutation({
  args: {
    organizationId: v.id("organizations"),
    format: v.string(),
    autoGenerate: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Check permission
    const { requirePermission } = await import("./utils/permissions");
    await requirePermission(ctx, args.organizationId, "organization.manage_settings");

    const org = await ctx.db.get(args.organizationId);
    if (!org) {
      throw new Error("Organization not found");
    }

    await ctx.db.patch(args.organizationId, {
      settings: {
        ...org.settings,
        accessionNumberFormat: args.format,
        autoGenerateAccessionNumbers: args.autoGenerate,
      },
    });

    return null;
  },
});

/**
 * List user's organizations
 */
export const listUserOrganizations = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("organizations"),
      name: v.string(),
      slug: v.string(),
      type: v.union(
        v.literal("museum"),
        v.literal("gallery"),
        v.literal("library"),
        v.literal("collector"),
      ),
      role: v.object({
        _id: v.id("roles"),
        name: v.string(),
        description: v.optional(v.string()),
        isSystemRole: v.boolean(),
      }),
      _creationTime: v.number(),
    }),
  ),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }

    const userOrganizations = await ctx.db
      .query("userOrganizations")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const organizations = await Promise.all(
      userOrganizations.map(async (uo) => {
        const org = await ctx.db.get(uo.organizationId);
        const role = await ctx.db.get(uo.roleId);
        if (!org || !role) {
          return null;
        }
        return {
          _id: org._id,
          name: org.name,
          slug: org.slug,
          type: org.type,
          role: {
            _id: role._id,
            name: role.name,
            description: role.description,
            isSystemRole: role.isSystemRole,
          },
          _creationTime: org._creationTime,
        };
      }),
    );

    return organizations.filter(
      (org): org is NonNullable<typeof org> => org !== null,
    );
  },
});

/**
 * Invite user to organization
 */
export const inviteUser = mutation({
  args: {
    organizationId: v.id("organizations"),
    email: v.string(),
    roleId: v.id("roles"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Check permission
    const { requirePermission } = await import("./utils/permissions");
    await requirePermission(ctx, args.organizationId, "users.invite");

    // Find user by email
    const user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", args.email))
      .first();

    if (!user) {
      // TODO: Send invitation email
      throw new Error("User not found. Email invitation not yet implemented.");
    }

    // Check if user is already in organization
    const existing = await ctx.db
      .query("userOrganizations")
      .withIndex("by_user_and_organization", (q) =>
        q.eq("userId", user._id).eq("organizationId", args.organizationId),
      )
      .first();

    if (existing) {
      throw new Error("User is already in this organization");
    }

    // Add user to organization
    await ctx.db.insert("userOrganizations", {
      userId: user._id,
      organizationId: args.organizationId,
      roleId: args.roleId,
      invitedBy: userId,
      joinedAt: Date.now(),
    });

    return null;
  },
});

/**
 * Remove user from organization
 */
export const removeUser = mutation({
  args: {
    organizationId: v.id("organizations"),
    userId: v.id("users"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const currentUserId = await getAuthUserId(ctx);
    if (!currentUserId) {
      throw new Error("Not authenticated");
    }

    // Check permission
    const { requirePermission } = await import("./utils/permissions");
    await requirePermission(ctx, args.organizationId, "users.remove");

    // Find user organization
    const userOrganization = await ctx.db
      .query("userOrganizations")
      .withIndex("by_user_and_organization", (q) =>
        q.eq("userId", args.userId).eq("organizationId", args.organizationId),
      )
      .first();

    if (!userOrganization) {
      throw new Error("User is not in this organization");
    }

    await ctx.db.delete(userOrganization._id);
    return null;
  },
});

/**
 * Update user's role in organization
 */
export const updateUserRole = mutation({
  args: {
    organizationId: v.id("organizations"),
    userId: v.id("users"),
    roleId: v.id("roles"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const currentUserId = await getAuthUserId(ctx);
    if (!currentUserId) {
      throw new Error("Not authenticated");
    }

    // Check permission
    const { requirePermission } = await import("./utils/permissions");
    await requirePermission(ctx, args.organizationId, "users.manage_roles");

    // Find user organization
    const userOrganization = await ctx.db
      .query("userOrganizations")
      .withIndex("by_user_and_organization", (q) =>
        q.eq("userId", args.userId).eq("organizationId", args.organizationId),
      )
      .first();

    if (!userOrganization) {
      throw new Error("User is not in this organization");
    }

    await ctx.db.patch(userOrganization._id, {
      roleId: args.roleId,
    });

    return null;
  },
});

/**
 * Internal: Create default roles for a new organization
 */
export const createDefaultRoles = internalMutation({
  args: {
    organizationId: v.id("organizations"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Create system roles
    const adminRole = await ctx.db.insert("roles", {
      organizationId: args.organizationId,
      name: "admin",
      description: "Full organization access",
      isSystemRole: true,
    });

    const curatorRole = await ctx.db.insert("roles", {
      organizationId: args.organizationId,
      name: "curator",
      description: "Collection management and accession/deaccession approval",
      isSystemRole: true,
    });

    const registrarRole = await ctx.db.insert("roles", {
      organizationId: args.organizationId,
      name: "registrar",
      description: "Accession/deaccession workflows, location management, loans",
      isSystemRole: true,
    });

    const catalogerRole = await ctx.db.insert("roles", {
      organizationId: args.organizationId,
      name: "cataloger",
      description: "Object cataloging and media management",
      isSystemRole: true,
    });

    const viewerRole = await ctx.db.insert("roles", {
      organizationId: args.organizationId,
      name: "viewer",
      description: "Read-only access",
      isSystemRole: true,
    });

    // Create default permissions (if they don't exist)
    const permissionNames = [
      // Collections
      "collections.create",
      "collections.read",
      "collections.update",
      "collections.delete",
      "collections.approve_accession",
      "collections.approve_deaccession",
      // Loans
      "loans.create",
      "loans.read",
      "loans.update",
      "loans.delete",
      "loans.approve",
      // Locations
      "locations.create",
      "locations.read",
      "locations.update",
      "locations.delete",
      // Media
      "media.upload",
      "media.read",
      "media.delete",
      // Users
      "users.invite",
      "users.manage_roles",
      "users.remove",
      // Organization
      "organization.manage_settings",
      "organization.view_analytics",
    ];

    const permissionMap = new Map<string, Id<"permissions">>();

    for (const permName of permissionNames) {
      const [category, name] = permName.split(".");
      const existing = await ctx.db
        .query("permissions")
        .withIndex("by_category", (q) =>
          q.eq("category", category as any),
        )
        .filter((q) => q.eq(q.field("name"), permName))
        .first();

      let permId: Id<"permissions">;
      if (existing) {
        permId = existing._id;
      } else {
        permId = await ctx.db.insert("permissions", {
          name: permName,
          description: `Permission: ${permName}`,
          category: category as any,
        });
      }
      permissionMap.set(permName, permId);
    }

    // Assign permissions to roles
    // Admin: all permissions
    for (const permId of permissionMap.values()) {
      await ctx.db.insert("rolePermissions", {
        roleId: adminRole,
        permissionId: permId,
      });
    }

    // Curator: collections + media + locations
    const curatorPerms = [
      "collections.create",
      "collections.read",
      "collections.update",
      "collections.approve_accession",
      "collections.approve_deaccession",
      "media.upload",
      "media.read",
      "media.delete",
      "locations.create",
      "locations.read",
      "locations.update",
      "locations.delete",
    ];
    for (const permName of curatorPerms) {
      const permId = permissionMap.get(permName);
      if (permId) {
        await ctx.db.insert("rolePermissions", {
          roleId: curatorRole,
          permissionId: permId,
        });
      }
    }

    // Registrar: workflows + locations + loans
    const registrarPerms = [
      "collections.create",
      "collections.read",
      "collections.update",
      "collections.approve_accession",
      "collections.approve_deaccession",
      "loans.create",
      "loans.read",
      "loans.update",
      "loans.delete",
      "loans.approve",
      "locations.create",
      "locations.read",
      "locations.update",
      "locations.delete",
      "media.read",
    ];
    for (const permName of registrarPerms) {
      const permId = permissionMap.get(permName);
      if (permId) {
        await ctx.db.insert("rolePermissions", {
          roleId: registrarRole,
          permissionId: permId,
        });
      }
    }

    // Cataloger: collections + media
    const catalogerPerms = [
      "collections.create",
      "collections.read",
      "collections.update",
      "media.upload",
      "media.read",
      "media.delete",
      "locations.read",
    ];
    for (const permName of catalogerPerms) {
      const permId = permissionMap.get(permName);
      if (permId) {
        await ctx.db.insert("rolePermissions", {
          roleId: catalogerRole,
          permissionId: permId,
        });
      }
    }

    // Viewer: read-only
    const viewerPerms = [
      "collections.read",
      "loans.read",
      "locations.read",
      "media.read",
    ];
    for (const permName of viewerPerms) {
      const permId = permissionMap.get(permName);
      if (permId) {
        await ctx.db.insert("rolePermissions", {
          roleId: viewerRole,
          permissionId: permId,
        });
      }
    }

    return null;
  },
});

