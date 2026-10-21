import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";

type ReadCtx = Pick<QueryCtx, "db">;

const MAX_TRANSFER_REQUESTS_PER_OBJECT = 100;

/**
 * Every transfer request of one Object, sent or received. More than the limit
 * fails visibly instead of deciding from part of them.
 */
export async function transferRequestsOf(
  ctx: ReadCtx,
  collectionId: Id<"collections">,
) {
  const requests = await ctx.db
    .query("organizationMoveRequests")
    .withIndex("by_collection", (q) => q.eq("collectionId", collectionId))
    .take(MAX_TRANSFER_REQUESTS_PER_OBJECT + 1);
  if (requests.length > MAX_TRANSFER_REQUESTS_PER_OBJECT) {
    throw new ConvexError(
      `An object supports at most ${MAX_TRANSFER_REQUESTS_PER_OBJECT} transfer requests.`,
    );
  }
  return requests;
}

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
 * collection. `closedByTransfer` holds the Deaccessions executed transfers
 * closed.
 */
export function holdsObject(
  deaccession: Pick<Doc<"deaccessions">, "_id" | "status" | "method">,
  closedByTransfer: ReadonlySet<Id<"deaccessions">>,
) {
  if (deaccession.status === "rejected") return false;
  return (
    deaccession.status === "pending" ||
    deaccession.method !== "transfer" ||
    !closedByTransfer.has(deaccession._id)
  );
}

/** Whether one Deaccession still holds its Object; see `holdsObject`. */
export async function isOpenDeaccession(
  ctx: ReadCtx,
  deaccession: Doc<"deaccessions">,
) {
  const closedByTransfer =
    deaccession.status === "approved" && deaccession.method === "transfer"
      ? executedTransferDeaccessionIds(
          await transferRequestsOf(ctx, deaccession.collectionId),
        )
      : new Set<Id<"deaccessions">>();
  return holdsObject(deaccession, closedByTransfer);
}

/** Whether the Object has an open Deaccession in this Organization. */
export async function hasOpenDeaccession(
  ctx: ReadCtx,
  organizationId: Id<"organizations">,
  collectionId: Id<"collections">,
) {
  const byStatus = (status: "pending" | "approved") =>
    ctx.db
      .query("deaccessions")
      .withIndex("by_organization_and_collection_and_status", (q) =>
        q
          .eq("organizationId", organizationId)
          .eq("collectionId", collectionId)
          .eq("status", status),
      );
  if ((await byStatus("pending").first()) !== null) return true;
  let closedByTransfer: Set<Id<"deaccessions">> | undefined;
  for await (const deaccession of byStatus("approved")) {
    if (deaccession.method === "transfer") {
      closedByTransfer ??= executedTransferDeaccessionIds(
        await transferRequestsOf(ctx, collectionId),
      );
    }
    if (holdsObject(deaccession, closedByTransfer ?? new Set())) return true;
  }
  return false;
}

/**
 * The approved Deaccession of a transfer that has not executed: while it
 * holds the Object, no other Removal or Withdrawal starts (ADR 0019).
 */
export async function findOpenTransferDeaccession(
  ctx: ReadCtx,
  organizationId: Id<"organizations">,
  collectionId: Id<"collections">,
) {
  let closedByTransfer: Set<Id<"deaccessions">> | undefined;
  const approved = ctx.db
    .query("deaccessions")
    .withIndex("by_organization_and_collection_and_status", (q) =>
      q
        .eq("organizationId", organizationId)
        .eq("collectionId", collectionId)
        .eq("status", "approved"),
    );
  for await (const deaccession of approved) {
    if (deaccession.method !== "transfer") continue;
    closedByTransfer ??= executedTransferDeaccessionIds(
      await transferRequestsOf(ctx, collectionId),
    );
    if (holdsObject(deaccession, closedByTransfer)) return deaccession;
  }
  return null;
}

/**
 * The Objects of an Organization with an open Deaccession, reading its
 * executed transfers once rather than once per Deaccession.
 */
export async function openDeaccessionCollectionIds(
  ctx: ReadCtx,
  organizationId: Id<"organizations">,
) {
  const executedTransfers = await ctx.db
    .query("organizationMoveRequests")
    .withIndex("by_source_organization_and_status", (q) =>
      q.eq("sourceOrganizationId", organizationId).eq("status", "executed"),
    )
    .collect();
  const closedByTransfer = executedTransferDeaccessionIds(executedTransfers);
  const collectionIds = new Set<Id<"collections">>();
  for (const status of ["pending", "approved"] as const) {
    const deaccessions = ctx.db
      .query("deaccessions")
      .withIndex("by_organization_and_status", (q) =>
        q.eq("organizationId", organizationId).eq("status", status),
      );
    for await (const deaccession of deaccessions) {
      if (holdsObject(deaccession, closedByTransfer)) {
        collectionIds.add(deaccession.collectionId);
      }
    }
  }
  return collectionIds;
}
