"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import type { RightsStatementUri } from "@v1/backend/convex/utils/rightsStatements";
import { useQuery } from "convex/react";

export interface OrganizationRightsDefaults {
  objectRightsStatement?: RightsStatementUri;
  mediaRightsStatement?: RightsStatementUri;
}

/**
 * The statements an Organization sets for its Objects and images that have
 * none of their own. Undefined while loading; empty when it sets none.
 */
export function useOrganizationRightsDefaults(
  organizationId: Id<"organizations"> | null | undefined,
): OrganizationRightsDefaults | undefined {
  const organization = useQuery(
    api.organizations.get,
    organizationId ? { organizationId } : "skip",
  );
  if (organization === undefined) return undefined;
  return organization?.settings?.rightsDefaults ?? {};
}
