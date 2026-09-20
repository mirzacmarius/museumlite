import "server-only";

import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { fetchQuery } from "convex/nextjs";
import { notFound } from "next/navigation";

export async function getCurrentOrganizationPermissions() {
  const token = await convexAuthNextjsToken();
  const [organizations, activeOrganizationPreference] = await Promise.all([
    fetchQuery(api.organizations.listUserOrganizations, {}, { token }),
    fetchQuery(
      api.userPreferences.get,
      { key: "organization.activeOrgId" },
      {
        token,
      },
    ),
  ]);

  if (organizations.length === 0) {
    return null;
  }

  const preferredOrganizationId =
    activeOrganizationPreference as Id<"organizations"> | null;
  const currentOrganization = preferredOrganizationId
    ? organizations.find(
        (organization) => organization._id === preferredOrganizationId,
      )
    : undefined;
  const organization = currentOrganization ?? organizations[0];

  if (!organization) {
    return null;
  }

  return fetchQuery(
    api.roles.getUserPermissions,
    { organizationId: organization._id },
    { token },
  );
}

export async function requireCurrentOrganizationPermission(permission: string) {
  const permissions = await getCurrentOrganizationPermissions();
  if (!permissions?.includes(permission)) {
    notFound();
  }
}
