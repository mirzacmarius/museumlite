import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { query } from "./_generated/server";
import { mutation } from "./utils/mutationBuilders";
import {
  getUserPermissions as getUserPerms,
  hasPermission,
  requirePermission,
} from "./utils/permissions";
import { getRolePresentation } from "./utils/systemRoles";

/**
 * Create a custom role
 */
export const createRole = mutation({
  args: {
    organizationId: v.id("organizations"),
    name: v.string(),
    description: v.optional(v.string()),
    permissionIds: v.array(v.id("permissions")),
  },
  returns: v.id("roles"),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Check permission
    const [, , existing] = await Promise.all([
      requirePermission(
        ctx,
        args.organizationId,
        "organization.manage_settings",
      ),
      requirePermission(ctx, args.organizationId, "users.manage_roles"),
      ctx.db
        .query("roles")
        .withIndex("by_organization_and_name", (q) =>
          q.eq("organizationId", args.organizationId).eq("name", args.name),
        )
        .first(),
    ] as const);

    if (existing) {
      throw new Error("Role name already exists");
    }

    // Create role
    const roleId = await ctx.db.insert("roles", {
      organizationId: args.organizationId,
      name: args.name,
      description: args.description,
      isSystemRole: false,
    });

    await Promise.all([
      ...args.permissionIds.map((permissionId) =>
        ctx.db.insert("rolePermissions", {
          roleId,
          permissionId,
        }),
      ),
      ctx.runMutation(internal.audit.logAction, {
        organizationId: args.organizationId,
        userId,
        action: "created_role",
        entityType: "role",
        entityId: roleId,
        changes: {
          name: args.name,
          permissionCount: args.permissionIds.length,
        },
      }),
    ] as const);

    return roleId;
  },
});

/**
 * Update role permissions
 */
export const updateRole = mutation({
  args: {
    roleId: v.id("roles"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    permissionIds: v.optional(v.array(v.id("permissions"))),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const [userId, role] = await Promise.all([
      getAuthUserId(ctx),
      ctx.db.get(args.roleId),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    if (!role) {
      throw new Error("Role not found");
    }

    if (role.isSystemRole) {
      throw new Error("Cannot modify system roles");
    }

    await Promise.all([
      requirePermission(
        ctx,
        role.organizationId,
        "organization.manage_settings",
      ),
      requirePermission(ctx, role.organizationId, "users.manage_roles"),
    ]);

    // Update role details
    const updates: {
      name?: string;
      description?: string;
    } = {};

    if (args.name !== undefined) {
      const nextName = args.name;
      // Check if new name conflicts
      const existing = await ctx.db
        .query("roles")
        .withIndex("by_organization_and_name", (q) =>
          q.eq("organizationId", role.organizationId).eq("name", nextName),
        )
        .first();

      if (existing && existing._id !== args.roleId) {
        throw new Error("Role name already exists");
      }
      updates.name = nextName;
    }

    if (args.description !== undefined) {
      updates.description = args.description;
    }

    // Update permissions if provided
    if (args.permissionIds !== undefined) {
      const [, existingPermissions] = await Promise.all([
        Object.keys(updates).length > 0
          ? ctx.db.patch(args.roleId, updates)
          : Promise.resolve(),
        ctx.db
          .query("rolePermissions")
          .withIndex("by_role", (q) => q.eq("roleId", args.roleId))
          .collect(),
      ] as const);

      await Promise.all([
        ...existingPermissions.map((rp) => ctx.db.delete(rp._id)),
        ...args.permissionIds.map((permissionId) =>
          ctx.db.insert("rolePermissions", {
            roleId: args.roleId,
            permissionId,
          }),
        ),
      ]);
    } else if (Object.keys(updates).length > 0) {
      await ctx.db.patch(args.roleId, updates);
    }

    await ctx.runMutation(internal.audit.logAction, {
      organizationId: role.organizationId,
      userId,
      action: "updated_role",
      entityType: "role",
      entityId: args.roleId,
      changes: {
        name: args.name ?? role.name,
        permissionCount: args.permissionIds?.length,
      },
    });

    return null;
  },
});

/**
 * Delete a custom role
 */
export const deleteRole = mutation({
  args: {
    roleId: v.id("roles"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const [userId, role] = await Promise.all([
      getAuthUserId(ctx),
      ctx.db.get(args.roleId),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    if (!role) {
      throw new Error("Role not found");
    }

    if (role.isSystemRole) {
      throw new Error("Cannot delete system roles");
    }

    const [, , usersWithRole] = await Promise.all([
      requirePermission(
        ctx,
        role.organizationId,
        "organization.manage_settings",
      ),
      requirePermission(ctx, role.organizationId, "users.manage_roles"),
      ctx.db
        .query("userOrganizations")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", role.organizationId),
        )
        .filter((q) => q.eq(q.field("roleId"), args.roleId))
        .first(),
    ] as const);

    if (usersWithRole) {
      throw new Error("Cannot delete role that is assigned to users");
    }

    // Remove all role permissions
    const rolePermissions = await ctx.db
      .query("rolePermissions")
      .withIndex("by_role", (q) => q.eq("roleId", args.roleId))
      .collect();
    await Promise.all([
      Promise.all(rolePermissions.map((rp) => ctx.db.delete(rp._id))),
      ctx.db.delete(args.roleId),
      ctx.runMutation(internal.audit.logAction, {
        organizationId: role.organizationId,
        userId,
        action: "deleted_role",
        entityType: "role",
        entityId: args.roleId,
        changes: {
          name: role.name,
        },
      }),
    ] as const);

    return null;
  },
});

/**
 * List all roles for an organization
 */
export const listRoles = query({
  args: {
    organizationId: v.id("organizations"),
  },
  returns: v.array(
    v.object({
      _id: v.id("roles"),
      name: v.string(),
      description: v.optional(v.string()),
      isSystemRole: v.boolean(),
      permissions: v.array(
        v.object({
          _id: v.id("permissions"),
          _creationTime: v.number(),
          name: v.string(),
          description: v.optional(v.string()),
          category: v.union(
            v.literal("collections"),
            v.literal("loans"),
            v.literal("locations"),
            v.literal("sites"),
            v.literal("media"),
            v.literal("users"),
            v.literal("organization"),
            v.literal("accounts"),
          ),
        }),
      ),
    }),
  ),
  handler: async (ctx, args) => {
    const roles = await ctx.db
      .query("roles")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .collect();

    const rolesWithPermissions = await Promise.all(
      roles.map(async (role) => {
        const presentation = getRolePresentation(role);
        const rolePermissions = await ctx.db
          .query("rolePermissions")
          .withIndex("by_role", (q) => q.eq("roleId", role._id))
          .collect();

        const permissions = await Promise.all(
          rolePermissions.map(async (rp) => {
            const perm = await ctx.db.get(rp.permissionId);
            return perm;
          }),
        );

        return {
          _id: role._id,
          name: presentation.name,
          description: presentation.description,
          isSystemRole: role.isSystemRole,
          permissions: permissions.filter(
            (p): p is NonNullable<typeof p> => p !== null,
          ),
        };
      }),
    );

    return rolesWithPermissions;
  },
});

/**
 * Get a single role with permissions
 */
export const getRole = query({
  args: {
    roleId: v.id("roles"),
  },
  returns: v.union(
    v.object({
      _id: v.id("roles"),
      name: v.string(),
      description: v.optional(v.string()),
      isSystemRole: v.boolean(),
      permissions: v.array(
        v.object({
          _id: v.id("permissions"),
          _creationTime: v.number(),
          name: v.string(),
          description: v.optional(v.string()),
          category: v.union(
            v.literal("collections"),
            v.literal("loans"),
            v.literal("locations"),
            v.literal("sites"),
            v.literal("media"),
            v.literal("users"),
            v.literal("organization"),
            v.literal("accounts"),
          ),
        }),
      ),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const role = await ctx.db.get(args.roleId);
    if (!role) {
      return null;
    }

    const presentation = getRolePresentation(role);
    const rolePermissions = await ctx.db
      .query("rolePermissions")
      .withIndex("by_role", (q) => q.eq("roleId", args.roleId))
      .collect();

    const permissions = await Promise.all(
      rolePermissions.map(async (rp) => {
        const perm = await ctx.db.get(rp.permissionId);
        return perm;
      }),
    );

    return {
      _id: role._id,
      name: presentation.name,
      description: presentation.description,
      isSystemRole: role.isSystemRole,
      permissions: permissions.filter(
        (p): p is NonNullable<typeof p> => p !== null,
      ),
    };
  },
});

/**
 * List all available permissions
 */
export const listPermissions = query({
  args: {
    category: v.optional(
      v.union(
        v.literal("collections"),
        v.literal("loans"),
        v.literal("locations"),
        v.literal("sites"),
        v.literal("media"),
        v.literal("users"),
        v.literal("organization"),
      ),
    ),
  },
  returns: v.array(
    v.object({
      _id: v.id("permissions"),
      _creationTime: v.number(),
      name: v.string(),
      description: v.optional(v.string()),
      category: v.union(
        v.literal("collections"),
        v.literal("loans"),
        v.literal("locations"),
        v.literal("sites"),
        v.literal("media"),
        v.literal("users"),
        v.literal("organization"),
        v.literal("accounts"),
      ),
    }),
  ),
  handler: async (ctx, args) => {
    const permissions = args.category
      ? await ctx.db
          .query("permissions")
          .withIndex("by_category", (q) => q.eq("category", args.category!))
          .collect()
      : await ctx.db.query("permissions").collect();
    return permissions;
  },
});

/**
 * Check if user has permission
 */
export const checkPermission = query({
  args: {
    organizationId: v.id("organizations"),
    permissionName: v.string(),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    return await hasPermission(ctx, args.organizationId, args.permissionName);
  },
});

/**
 * Get all permissions for current user in organization
 */
export const getUserPermissions = query({
  args: {
    organizationId: v.id("organizations"),
  },
  returns: v.array(v.string()),
  handler: async (ctx, args) => {
    return await getUserPerms(ctx, args.organizationId);
  },
});
