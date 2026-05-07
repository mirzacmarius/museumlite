import { getAuthUserId } from "@convex-dev/auth/server";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { requireModuleEnabled } from "./featureGates";
import type { ModuleId } from "./featurePolicy";
import { requirePermission } from "./permissions";

type AuthorizationCtx = QueryCtx | MutationCtx;

interface OrganizationAuthorizationArgs {
  organizationId: Id<"organizations">;
  moduleId?: ModuleId;
  permission: string;
}

export async function requireAuthenticatedUser(ctx: AuthorizationCtx) {
  const userId = await getAuthUserId(ctx);
  if (!userId) {
    throw new Error("Not authenticated");
  }

  return userId;
}

export async function requireAuthorizedOrganization(
  ctx: AuthorizationCtx,
  { moduleId, organizationId, permission }: OrganizationAuthorizationArgs,
) {
  if (moduleId) {
    await requireModuleEnabled(ctx, organizationId, moduleId);
  }

  await requirePermission(ctx, organizationId, permission);
}

export async function requireAuthenticatedOrganization(
  ctx: AuthorizationCtx,
  args: OrganizationAuthorizationArgs,
) {
  const userId = await requireAuthenticatedUser(ctx);
  await requireAuthorizedOrganization(ctx, args);

  return {
    organizationId: args.organizationId,
    userId,
  };
}
