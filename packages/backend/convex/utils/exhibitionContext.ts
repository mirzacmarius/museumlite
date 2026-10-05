import { getAuthUserId } from "@convex-dev/auth/server";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { requireExhibitionAccess } from "./exhibitionAccess";
import { requirePermission } from "./permissions";

export async function requireAuthenticatedExhibitionUserId(
  ctx: MutationCtx | QueryCtx,
) {
  const userId = await getAuthUserId(ctx);
  if (!userId) {
    throw new Error("Not authenticated");
  }

  return userId;
}

export async function requireExhibitionUpdatePermission(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
) {
  await Promise.all([
    requireExhibitionAccess(ctx, organizationId),
    requirePermission(ctx, organizationId, "collections.update"),
  ]);
}

export async function requireExhibitionReadPermission(
  ctx: QueryCtx,
  organizationId: Id<"organizations">,
) {
  await Promise.all([
    requireExhibitionAccess(ctx, organizationId),
    requirePermission(ctx, organizationId, "collections.read"),
  ]);
}

export async function loadExhibitionMutationContext(
  ctx: MutationCtx,
  exhibitionId: Id<"exhibitions">,
) {
  const [userId, exhibition] = await Promise.all([
    requireAuthenticatedExhibitionUserId(ctx),
    ctx.db.get(exhibitionId),
  ] as const);

  if (!exhibition) {
    throw new Error("Exhibition not found");
  }

  await requireExhibitionUpdatePermission(ctx, exhibition.organizationId);

  return { userId, exhibition };
}

export async function loadExhibitionObjectMutationContext(
  ctx: MutationCtx,
  exhibitionObjectId: Id<"exhibitionObjects">,
) {
  const [userId, exhibitionObject] = await Promise.all([
    requireAuthenticatedExhibitionUserId(ctx),
    ctx.db.get(exhibitionObjectId),
  ] as const);

  if (!exhibitionObject) {
    throw new Error("Exhibition object not found");
  }

  const exhibition = await ctx.db.get(exhibitionObject.exhibitionId);
  if (!exhibition) {
    throw new Error("Exhibition not found");
  }

  if (exhibitionObject.organizationId !== exhibition.organizationId)
    throw new Error("Exhibition object belongs to a different organization");
  await requireExhibitionUpdatePermission(ctx, exhibition.organizationId);

  return { userId, exhibitionObject, exhibition };
}
