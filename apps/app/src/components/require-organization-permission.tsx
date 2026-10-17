import "server-only";

import { Suspense } from "react";
import { requireCurrentOrganizationPermission } from "@/lib/organization-permissions";

/**
 * Server-side permission check that streams beside the page instead of
 * wrapping it, so the page stays in the prefetched shell. A missing
 * permission swaps the segment for the not-found page.
 */
export function RequireOrganizationPermission({
  permission,
}: {
  permission: string;
}) {
  return (
    <Suspense fallback={null}>
      <PermissionCheck permission={permission} />
    </Suspense>
  );
}

async function PermissionCheck({ permission }: { permission: string }) {
  await requireCurrentOrganizationPermission(permission);
  return null;
}
