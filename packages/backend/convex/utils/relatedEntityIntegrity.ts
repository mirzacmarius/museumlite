import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

export async function getRelatedEntityOrganization(
  ctx: MutationCtx | QueryCtx,
  relatedEntityType: "loan" | "exhibition" | "acquisition" | "item",
  relatedEntityId: string,
): Promise<Id<"organizations"> | null> {
  const tables =
    relatedEntityType === "loan"
      ? (["loans"] as const)
      : relatedEntityType === "exhibition"
        ? (["exhibitions"] as const)
        : relatedEntityType === "acquisition"
          ? (["libraryAcquisitionRequests", "accessions"] as const)
          : (["collections", "libraryItems"] as const);
  for (const table of tables) {
    const id = ctx.db.normalizeId(table, relatedEntityId);
    if (!id) continue;
    const record = await ctx.db.get(id);
    if (record) return record.organizationId;
  }
  return null;
}
