import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

export const ADMIN_ROLE_NAME = "Administrator";
export const LEGACY_ADMIN_ROLE_NAME = "admin";
export const ADMIN_ROLE_DESCRIPTION =
  "Administrators have full access to organization settings, users, roles, collections, loans, locations, sites, media, accounts, analytics, and approval workflows.";

export const CURATOR_ROLE_NAME = "Curator";
export const LEGACY_CURATOR_ROLE_NAME = "curator";
export const CURATOR_ROLE_DESCRIPTION =
  "Curators create and update collection records, approve accession, deaccession, and conservation workflows, manage collection media and locations, and view sites and accounts.";

/** Display name shown in Role Management and role pickers. */
export const COLLECTION_MANAGER_ROLE_NAME = "Collection Manager";

/** Previous system-role slug. Lookups still accept it until the rename migration runs. */
export const LEGACY_REGISTRAR_ROLE_NAME = "registrar";

export const COLLECTION_MANAGER_ROLE_DESCRIPTION =
  "Collection managers (also known as the registrar) are tasked with the care, inventory, and maintenance, Accession/deaccession workflows, location management, loans of the museum object collection.";

export const CATALOGER_ROLE_NAME = "Cataloger";
export const LEGACY_CATALOGER_ROLE_NAME = "cataloger";
export const CATALOGER_ROLE_DESCRIPTION =
  "Catalogers create and update collection records, manage collection media, and view locations, sites, and accounts.";

export const VIEWER_ROLE_NAME = "Viewer";
export const LEGACY_VIEWER_ROLE_NAME = "viewer";
export const VIEWER_ROLE_DESCRIPTION =
  "Viewers have read-only access to collections, loans, locations, sites, media, and accounts.";

export interface SystemRoleDefinition {
  recognizedNames: string[];
  name: string;
  description: string;
}

export const SYSTEM_ROLE_DEFINITIONS: SystemRoleDefinition[] = [
  {
    recognizedNames: [LEGACY_ADMIN_ROLE_NAME, ADMIN_ROLE_NAME],
    name: ADMIN_ROLE_NAME,
    description: ADMIN_ROLE_DESCRIPTION,
  },
  {
    recognizedNames: [LEGACY_CURATOR_ROLE_NAME, CURATOR_ROLE_NAME],
    name: CURATOR_ROLE_NAME,
    description: CURATOR_ROLE_DESCRIPTION,
  },
  {
    recognizedNames: [LEGACY_REGISTRAR_ROLE_NAME, COLLECTION_MANAGER_ROLE_NAME],
    name: COLLECTION_MANAGER_ROLE_NAME,
    description: COLLECTION_MANAGER_ROLE_DESCRIPTION,
  },
  {
    recognizedNames: [LEGACY_CATALOGER_ROLE_NAME, CATALOGER_ROLE_NAME],
    name: CATALOGER_ROLE_NAME,
    description: CATALOGER_ROLE_DESCRIPTION,
  },
  {
    recognizedNames: [LEGACY_VIEWER_ROLE_NAME, VIEWER_ROLE_NAME],
    name: VIEWER_ROLE_NAME,
    description: VIEWER_ROLE_DESCRIPTION,
  },
];

interface RolePresentationSource {
  name: string;
  description?: string;
  isSystemRole: boolean;
}

interface RolePresentation {
  name: string;
  description?: string;
}

type OrgCtx = QueryCtx | MutationCtx;

export function getRolePresentation(
  role: RolePresentationSource,
): RolePresentation {
  if (!role.isSystemRole) {
    return { name: role.name, description: role.description };
  }

  const definition = SYSTEM_ROLE_DEFINITIONS.find(({ recognizedNames }) =>
    recognizedNames.includes(role.name),
  );

  return definition
    ? { name: definition.name, description: definition.description }
    : { name: role.name, description: role.description };
}

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
