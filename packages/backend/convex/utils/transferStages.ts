import { type Infer, v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { hasPermission } from "./permissions";

/**
 * Where a transfer to another Organization stands, worked out from what is
 * stored each time it is read, so old rows need no migration (ADR 0020).
 * Every transfer query returns it and every transfer decision checks it.
 */
export const TRANSFER_STAGES = [
  "waiting_for_sender",
  "waiting_for_receiver",
  "received",
  "declined",
  "cancelled",
] as const;

export type TransferStage = (typeof TRANSFER_STAGES)[number];

export const transferStageValidator = v.union(
  ...TRANSFER_STAGES.map((stage) => v.literal(stage)),
);

/** What staff can do with a transfer, each for one side of it. */
export const TRANSFER_ACTIONS = [
  "approve",
  "accept",
  "decline",
  "cancel",
] as const;

export type TransferAction = (typeof TRANSFER_ACTIONS)[number];

export const transferViewerActionValidator = v.object({
  action: v.union(...TRANSFER_ACTIONS.map((action) => v.literal(action))),
  /** The Organization the action is taken for: the sender or the receiver. */
  organizationId: v.id("organizations"),
  /**
   * Whether the decision keeps the viewer's review notes. A requester
   * cancelling their own request is not reviewing it and leaves none.
   */
  takesNotes: v.boolean(),
});

export type TransferViewerAction = Infer<typeof transferViewerActionValidator>;

/** How a finished transfer ended: when, by which side, and its notes. */
export const transferDecisionValidator = v.object({
  decidedAt: v.number(),
  decidedBy: v.union(v.literal("sender"), v.literal("receiver")),
  notes: v.optional(v.string()),
});

export type TransferDecision = Infer<typeof transferDecisionValidator>;

type StagedRequest = Pick<
  Doc<"organizationMoveRequests">,
  "status" | "approvedSourceLocationId"
>;

/**
 * Whether the sender has to approve again before the receiver can decide.
 * `approved_for_transfer` rows, and `awaiting_acceptance` rows approved
 * before the sender's Location was recorded, predate the receiver's decision
 * and the Location check it relies on.
 */
export function awaitsSenderReapproval(request: StagedRequest) {
  return (
    request.status === "approved_for_transfer" ||
    (request.status === "awaiting_acceptance" &&
      request.approvedSourceLocationId === undefined)
  );
}

/** The transfer's stage; legacy `pending` rows wait for the sender. */
export function transferStage(request: StagedRequest): TransferStage {
  switch (request.status) {
    case "pending":
    case "pending_source_approval":
    case "approved_for_transfer":
      return "waiting_for_sender";
    case "awaiting_acceptance":
      return awaitsSenderReapproval(request)
        ? "waiting_for_sender"
        : "waiting_for_receiver";
    case "executed":
      return "received";
    case "rejected":
      return "declined";
    case "cancelled":
      return "cancelled";
  }
}

/** Whether someone still has to decide the transfer. */
export function isOpenTransfer(request: StagedRequest) {
  const stage = transferStage(request);
  return stage === "waiting_for_sender" || stage === "waiting_for_receiver";
}

type ReviewedRequest = StagedRequest &
  Pick<
    Doc<"organizationMoveRequests">,
    | "deaccessionId"
    | "executedAt"
    | "reviewedAt"
    | "reviewNotes"
    | "sourceReviewedAt"
    | "sourceReviewNotes"
    | "targetReviewedAt"
    | "targetReviewNotes"
  >;

/**
 * Whether the receiving Organization has had the transfer: the sender
 * approved it. One the sender declined or cancelled before approving never
 * reached the receiver; one the sender cancelled after approving did, and
 * its approval made the transfer's Removal.
 */
export function reachedReceiver(request: ReviewedRequest) {
  switch (transferStage(request)) {
    case "waiting_for_sender":
      return false;
    case "waiting_for_receiver":
    case "received":
      return true;
    case "declined":
      return request.targetReviewedAt !== undefined;
    case "cancelled":
      return request.deaccessionId !== undefined;
  }
}

/**
 * Whether `sourceReviewedAt` records the sender's approval, not a decline or
 * a cancel before approval: the transfer reached the receiver, or waits for
 * the sender to approve it again.
 */
export function approvedBySender(request: ReviewedRequest) {
  return reachedReceiver(request) || awaitsSenderReapproval(request);
}

/**
 * How the transfer ended: the receiver accepted or declined it, or the
 * sender declined or cancelled it. Undefined while it is open.
 */
export function transferDecision(
  request: ReviewedRequest,
): TransferDecision | undefined {
  switch (transferStage(request)) {
    case "waiting_for_sender":
    case "waiting_for_receiver":
      return undefined;
    case "received":
      return {
        decidedAt:
          request.executedAt ??
          request.targetReviewedAt ??
          request.reviewedAt ??
          0,
        decidedBy: "receiver",
        notes: request.targetReviewNotes,
      };
    case "declined":
      return request.targetReviewedAt !== undefined
        ? {
            decidedAt: request.targetReviewedAt,
            decidedBy: "receiver",
            notes: request.targetReviewNotes,
          }
        : {
            decidedAt: request.sourceReviewedAt ?? request.reviewedAt ?? 0,
            decidedBy: "sender",
            notes: request.sourceReviewNotes,
          };
    case "cancelled":
      return {
        decidedAt: request.reviewedAt ?? request.sourceReviewedAt ?? 0,
        decidedBy: "sender",
        notes: request.reviewNotes,
      };
  }
}

/**
 * What the viewer may do with the transfer now, each action for the
 * Organization it acts for. It follows the viewer's memberships in the sender
 * and the receiver, not the Organization they have selected, so an
 * administrator of both sees both sides' actions. Decisions stay with each
 * side's administrators; the requester may also cancel their own request
 * while it waits for the sender, and the sender's administrators may cancel
 * until the receiver decides (ADR 0020). The sender stops a transfer by
 * cancelling it: declining is the receiver's.
 */
export async function transferActionsFor(
  ctx: QueryCtx,
  request: Doc<"organizationMoveRequests">,
  userId: Id<"users">,
): Promise<TransferViewerAction[]> {
  const stage = transferStage(request);
  if (stage !== "waiting_for_sender" && stage !== "waiting_for_receiver") {
    return [];
  }
  const sender = request.sourceOrganizationId;
  const receiver = request.targetOrganizationId;
  const [senderAdmin, receiverAdmin] = await Promise.all([
    hasPermission(ctx, sender, "organization.manage_settings"),
    stage === "waiting_for_receiver"
      ? hasPermission(ctx, receiver, "organization.manage_settings")
      : false,
  ] as const);

  const actions: TransferViewerAction[] = [];
  if (stage === "waiting_for_sender") {
    if (senderAdmin) {
      actions.push({
        action: "approve",
        organizationId: sender,
        takesNotes: true,
      });
    }
    if (senderAdmin || request.requestedBy === userId) {
      actions.push({
        action: "cancel",
        organizationId: sender,
        takesNotes: senderAdmin,
      });
    }
    return actions;
  }
  if (receiverAdmin) {
    actions.push(
      { action: "accept", organizationId: receiver, takesNotes: true },
      { action: "decline", organizationId: receiver, takesNotes: true },
    );
  }
  if (senderAdmin) {
    actions.push({
      action: "cancel",
      organizationId: sender,
      takesNotes: true,
    });
  }
  return actions;
}
