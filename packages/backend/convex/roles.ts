import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import {
  hasPermission,
  getUserPermissions as getUserPerms,
  requirePermission,
} from "./utils/permissions";

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
    await requirePermission(ctx, args.organizationId, "users.manage_roles");

    // Check if role name already exists for this organization
    const existing = await ctx.db
      .query("roles")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .filter((q) => q.eq(q.field("name"), args.name))
      .first();

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

    // Assign permissions
    for (const permissionId of args.permissionIds) {
      await ctx.db.insert("rolePermissions", {
        roleId,
        permissionId,
      });
    }

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
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const role = await ctx.db.get(args.roleId);
    if (!role) {
      throw new Error("Role not found");
    }

    // Check permission
    const { requirePermission } = await import("./utils/permissions");
    await requirePermission(ctx, role.organizationId, "users.manage_roles");

    // Cannot modify system roles
    if (role.isSystemRole) {
      throw new Error("Cannot modify system roles");
    }

    // Update role details
    const updates: {
      name?: string;
      description?: string;
    } = {};

    if (args.name !== undefined) {
      // Check if new name conflicts
      const existing = await ctx.db
        .query("roles")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", role.organizationId),
        )
        .filter((q) => q.eq(q.field("name"), args.name))
        .first();

      if (existing && existing._id !== args.roleId) {
        throw new Error("Role name already exists");
      }
      updates.name = args.name;
    }

    if (args.description !== undefined) {
      updates.description = args.description;
    }

    if (Object.keys(updates).length > 0) {
      await ctx.db.patch(args.roleId, updates);
    }

    // Update permissions if provided
    if (args.permissionIds !== undefined) {
      // Remove existing permissions
      const existingPermissions = await ctx.db
        .query("rolePermissions")
        .withIndex("by_role", (q) => q.eq("roleId", args.roleId))
        .collect();

      for (const rp of existingPermissions) {
        await ctx.db.delete(rp._id);
      }

      // Add new permissions
      for (const permissionId of args.permissionIds) {
        await ctx.db.insert("rolePermissions", {
          roleId: args.roleId,
          permissionId,
        });
      }
    }

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
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const role = await ctx.db.get(args.roleId);
    if (!role) {
      throw new Error("Role not found");
    }

    // Check permission
    const { requirePermission } = await import("./utils/permissions");
    await requirePermission(ctx, role.organizationId, "users.manage_roles");

    // Cannot delete system roles
    if (role.isSystemRole) {
      throw new Error("Cannot delete system roles");
    }

    // Check if role is in use
    const usersWithRole = await ctx.db
      .query("userOrganizations")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", role.organizationId),
      )
      .filter((q) => q.eq(q.field("roleId"), args.roleId))
      .first();

    if (usersWithRole) {
      throw new Error("Cannot delete role that is assigned to users");
    }

    // Remove all role permissions
    const rolePermissions = await ctx.db
      .query("rolePermissions")
      .withIndex("by_role", (q) => q.eq("roleId", args.roleId))
      .collect();

    for (const rp of rolePermissions) {
      await ctx.db.delete(rp._id);
    }

    // Delete role
    await ctx.db.delete(args.roleId);

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
            v.literal("media"),
            v.literal("users"),
            v.literal("organization"),
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
          name: role.name,
          description: role.description,
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
            v.literal("media"),
            v.literal("users"),
            v.literal("organization"),
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
      name: role.name,
      description: role.description,
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
        v.literal("media"),
        v.literal("users"),
        v.literal("organization"),
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
