import type { Doc, Id, TableNames } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

/** Tables whose every document carries an `organizationId`. */
export type OrganizationScopedTable = {
  [Table in TableNames]: Doc<Table> extends {
    organizationId: Id<"organizations">;
  }
    ? Table
    : never;
}[TableNames];

/**
 * Loads `id` and refuses it unless the document belongs to `organizationId`,
 * so a write never links a record from another organization. A foreign
 * document reads exactly like a missing one.
 */
export async function requireInOrganization<
  Table extends OrganizationScopedTable,
>(
  ctx: QueryCtx | MutationCtx,
  id: Id<Table>,
  organizationId: Id<"organizations">,
  label: string,
): Promise<Doc<Table>> {
  const document = (await ctx.db.get(id)) as
    | (Doc<Table> & { organizationId: Id<"organizations"> })
    | null;
  if (!document || document.organizationId !== organizationId) {
    throw new Error(`${label} not found`);
  }
  return document;
}

/** Refuses `userId` unless they are a member of `organizationId`. */
export async function requireMemberOfOrganization(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
  organizationId: Id<"organizations">,
  label = "User",
): Promise<Doc<"userOrganizations">> {
  const membership = await ctx.db
    .query("userOrganizations")
    .withIndex("by_user_and_organization", (q) =>
      q.eq("userId", userId).eq("organizationId", organizationId),
    )
    .first();
  if (!membership) {
    throw new Error(`${label} is not a member of this organization`);
  }
  return membership;
}
