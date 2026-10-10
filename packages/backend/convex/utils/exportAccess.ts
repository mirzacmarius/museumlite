import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { AUDIT_READ_PERMISSION } from "../auditLog";
import { requireFeatureAccess } from "./featureGates";
import { REGISTER_FEATURES, REGISTER_PERMISSIONS } from "./registerProfiles";

type ExportSource = Doc<"exportJobs">["source"];

export function requiredExportPermissions(source: ExportSource) {
  if (source.kind === "register") return REGISTER_PERMISSIONS[source.profile];
  return source.kind === "audit"
    ? ["collections.read", AUDIT_READ_PERMISSION]
    : ["collections.read"];
}

/**
 * The member permissions, then the plan features, an export source needs.
 * `requireMemberPermission` checks one permission for whoever the export
 * runs for: the caller, or the creator of a running job.
 */
export async function requireExportAccess(
  ctx: QueryCtx | MutationCtx,
  organizationId: Id<"organizations">,
  source: ExportSource,
  requireMemberPermission: (permission: string) => Promise<unknown>,
) {
  for (const permission of requiredExportPermissions(source))
    await requireMemberPermission(permission);
  if (source.kind === "audit")
    await requireFeatureAccess(ctx, organizationId, "compliance");
  if (source.kind === "register")
    for (const feature of REGISTER_FEATURES[source.profile])
      await requireFeatureAccess(ctx, organizationId, feature);
}
