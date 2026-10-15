import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { SUPER_ADMIN_ROLE_NAME } from "./superAdmins";
import {
  ADMIN_ROLE_NAME,
  COLLECTION_MANAGER_ROLE_NAME,
  CURATOR_ROLE_NAME,
  SYSTEM_ROLE_DEFINITIONS,
} from "./systemRoles";

function superAdminAndRecognizedNames(roleNames: readonly string[]) {
  return new Set([
    SUPER_ADMIN_ROLE_NAME,
    ...SYSTEM_ROLE_DEFINITIONS.flatMap((definition) =>
      roleNames.includes(definition.name) ? definition.recognizedNames : [],
    ),
  ]);
}

export const REVIEWER_SYSTEM_ROLE_NAMES: ReadonlySet<string> =
  superAdminAndRecognizedNames([
    ADMIN_ROLE_NAME,
    CURATOR_ROLE_NAME,
    COLLECTION_MANAGER_ROLE_NAME,
  ]);

export const VALUATION_SYSTEM_ROLE_NAMES: ReadonlySet<string> =
  superAdminAndRecognizedNames([ADMIN_ROLE_NAME, COLLECTION_MANAGER_ROLE_NAME]);

/**
 * Creates a collections permission if missing and grants it to one
 * organization's matching system roles. Safe to run more than once; custom
 * roles are never changed.
 */
export async function grantPermissionToSystemRoles(
  ctx: MutationCtx,
  input: {
    organizationId: Id<"organizations">;
    name: string;
    description: string;
    roleNames: ReadonlySet<string>;
  },
) {
  const organization = await ctx.db.get(input.organizationId);
  if (!organization) throw new Error("Organization not found");
  const collectionPermissions = await ctx.db
    .query("permissions")
    .withIndex("by_category", (q) => q.eq("category", "collections"))
    .take(100);
  const existing = collectionPermissions.find(
    (permission) => permission.name === input.name,
  );
  const permissionId =
    existing?._id ??
    (await ctx.db.insert("permissions", {
      name: input.name,
      category: "collections",
      description: input.description,
    }));
  const roles = await ctx.db
    .query("roles")
    .withIndex("by_organization", (q) =>
      q.eq("organizationId", input.organizationId),
    )
    .take(101);
  if (roles.length > 100)
    throw new Error(
      "Too many roles; migrate this organization in smaller batches",
    );
  for (const role of roles) {
    if (!role.isSystemRole || !input.roleNames.has(role.name)) continue;
    const grants = await ctx.db
      .query("rolePermissions")
      .withIndex("by_role", (q) => q.eq("roleId", role._id))
      .take(101);
    if (grants.length > 100)
      throw new Error("Too many grants; migrate this role in smaller batches");
    if (!grants.some((grant) => grant.permissionId === permissionId)) {
      await ctx.db.insert("rolePermissions", {
        roleId: role._id,
        permissionId,
      });
    }
  }
}
