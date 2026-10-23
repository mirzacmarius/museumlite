import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { isOpenTransfer } from "./transferStages";
import { workflowApprovalError } from "./workflowApprovalErrors";

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

type HoldingFields = Pick<
  Doc<"deaccessions">,
  "_id" | "status" | "method" | "targetCollectionStatus"
>;

/** A Withdrawal (Remove item) hides the Object instead of disposing of it. */
function isWithdrawal(deaccession: HoldingFields) {
  return (
    deaccession.targetCollectionStatus === "archived" ||
    deaccession.targetCollectionStatus === "deleted"
  );
}

/** Whether `holdsObject` needs the Object's status to decide. */
function needsObjectStatus(deaccession: HoldingFields) {
  return deaccession.status === "approved" && isWithdrawal(deaccession);
}

/**
 * Whether a Deaccession still holds its Object: pending, or approved and not
 * closed. A rejected one left the Object in the collection. An approved
 * Removal closes when its transfer executes (`closedByTransfer` holds those),
 * and an approved Withdrawal closes when its Object is restored, so it holds
 * only while the Object is still withdrawn.
 */
export function holdsObject(
  deaccession: HoldingFields,
  closedByTransfer: ReadonlySet<Id<"deaccessions">>,
  objectStatus: Doc<"collections">["status"] | undefined,
) {
  if (deaccession.status === "rejected") return false;
  if (deaccession.status === "pending") return true;
  if (isWithdrawal(deaccession)) {
    return (
      objectStatus === undefined ||
      objectStatus === "archived" ||
      objectStatus === "deleted"
    );
  }
  return (
    deaccession.method !== "transfer" || !closedByTransfer.has(deaccession._id)
  );
}

async function objectStatusFor(
  ctx: ReadCtx,
  deaccession: HoldingFields & Pick<Doc<"deaccessions">, "collectionId">,
) {
  if (!needsObjectStatus(deaccession)) return undefined;
  return (await ctx.db.get(deaccession.collectionId))?.status;
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
  return holdsObject(
    deaccession,
    closedByTransfer,
    await objectStatusFor(ctx, deaccession),
  );
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
    if (
      holdsObject(
        deaccession,
        closedByTransfer ?? new Set(),
        await objectStatusFor(ctx, deaccession),
      )
    )
      return true;
  }
  return false;
}

/**
 * The approved Removal of an open transfer from this Organization, which its
 * sender's approval made: while it holds the Object, no other Removal or
 * Withdrawal starts (ADR 0019). A Deaccession with method transfer that no
 * open transfer made holds nothing here.
 */
export async function findOpenTransferDeaccession(
  ctx: ReadCtx,
  organizationId: Id<"organizations">,
  collectionId: Id<"collections">,
) {
  for (const request of await transferRequestsOf(ctx, collectionId)) {
    if (
      request.sourceOrganizationId !== organizationId ||
      request.deaccessionId === undefined ||
      !isOpenTransfer(request)
    ) {
      continue;
    }
    const deaccession = await ctx.db.get(request.deaccessionId);
    if (deaccession?.status === "approved") return deaccession;
  }
  return null;
}

/**
 * Refuses to withdraw or delete an Object that an open transfer holds: the
 * receiver could no longer accept it (ADR 0019).
 */
export async function assertNotInTransfer(
  ctx: ReadCtx,
  collection: Pick<Doc<"collections">, "_id" | "organizationId">,
  status: Doc<"collections">["status"],
) {
  if (status !== "archived" && status !== "deleted") return;
  if (
    await findOpenTransferDeaccession(
      ctx,
      collection.organizationId,
      collection._id,
    )
  ) {
    throw workflowApprovalError(
      "OBJECT_IN_TRANSFER",
      "Cannot withdraw an object that is being transferred to another organization",
    );
  }
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
      if (
        holdsObject(
          deaccession,
          closedByTransfer,
          await objectStatusFor(ctx, deaccession),
        )
      ) {
        collectionIds.add(deaccession.collectionId);
      }
    }
  }
  return collectionIds;
}
