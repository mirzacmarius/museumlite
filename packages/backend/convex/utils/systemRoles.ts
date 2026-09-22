import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

/** Display name shown in Role Management and role pickers. */
export const COLLECTION_MANAGER_ROLE_NAME = "Collection Manager";

/** Previous system-role slug. Lookups still accept it until the rename migration runs. */
export const LEGACY_REGISTRAR_ROLE_NAME = "registrar";

export const COLLECTION_MANAGER_ROLE_DESCRIPTION =
  "Collection managers (also known as the registrar) are tasked with the care, inventory, and maintenance, Accession/deaccession workflows, location management, loans of the museum object collection.";

type OrgCtx = QueryCtx | MutationCtx;

export function isCollectionManagerRoleName(name: string): boolean {
  return (
    name === COLLECTION_MANAGER_ROLE_NAME || name === LEGACY_REGISTRAR_ROLE_NAME
  );
}

export async function findCollectionManagerRole(
  ctx: OrgCtx,
  organizationId: Id<"organizations">,
) {
  const currentRole = await ctx.db
    .query("roles")
    .withIndex("by_organization_and_name", (q) =>
      q
        .eq("organizationId", organizationId)
        .eq("name", COLLECTION_MANAGER_ROLE_NAME),
    )
    .first();
  if (currentRole?.isSystemRole) {
    return currentRole;
  }

  const legacyRole = await ctx.db
    .query("roles")
    .withIndex("by_organization_and_name", (q) =>
      q
        .eq("organizationId", organizationId)
        .eq("name", LEGACY_REGISTRAR_ROLE_NAME),
    )
    .first();
  if (legacyRole?.isSystemRole) {
    return legacyRole;
  }

  return null;
}
