import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";

type ReadCtx = Pick<QueryCtx, "db">;

/**
 * The Deaccessions that closed when their transfer executed. A transfer's
 * Deaccession stays approved as the record of the Object leaving, but once the
 * receiver accepts, the Object belongs to the receiver and the Deaccession no
 * longer holds it.
 */
export function executedTransferDeaccessionIds(
  moveRequests: ReadonlyArray<
    Pick<Doc<"organizationMoveRequests">, "status" | "deaccessionId">
  >,
) {
  return new Set(
    moveRequests.flatMap((request) =>
      request.status === "executed" && request.deaccessionId
        ? [request.deaccessionId]
        : [],
    ),
  );
}

/**
 * Whether a Deaccession still holds its Object: pending, or approved and not
 * closed by an executed transfer. A rejected one left the Object in the
 * collection.
 */
export async function isOpenDeaccession(
  ctx: ReadCtx,
  deaccession: Doc<"deaccessions">,
) {
  if (deaccession.status === "rejected") return false;
  if (deaccession.status === "pending" || deaccession.method !== "transfer") {
    return true;
  }
  const moveRequests = await ctx.db
    .query("organizationMoveRequests")
    .withIndex("by_collection", (q) =>
      q.eq("collectionId", deaccession.collectionId),
    )
    .collect();
  return !executedTransferDeaccessionIds(moveRequests).has(deaccession._id);
}

/** Whether the Object has an open Deaccession in this Organization. */
export async function hasOpenDeaccession(
  ctx: ReadCtx,
  organizationId: Id<"organizations">,
  collectionId: Id<"collections">,
) {
  for (const status of ["pending", "approved"] as const) {
    const deaccessions = ctx.db
      .query("deaccessions")
      .withIndex("by_organization_and_collection_and_status", (q) =>
        q
          .eq("organizationId", organizationId)
          .eq("collectionId", collectionId)
          .eq("status", status),
      );
    for await (const deaccession of deaccessions) {
      if (await isOpenDeaccession(ctx, deaccession)) return true;
    }
  }
  return false;
}
