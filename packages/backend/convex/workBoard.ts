import { getAuthUserId } from "@convex-dev/auth/server";
import { type GenericValidator, v } from "convex/values";
import { query } from "./_generated/server";
import {
  assignedCaseValidator,
  readAssignedCases,
  readTaskQueue,
  taskValidator,
} from "./caseTasks";
import {
  boardItemValidator,
  readAwaitingAcceptance,
} from "./conditionAssessments";
import {
  readAwaitingDecision,
  transferAwaitingDecisionValidator,
} from "./objectMoves";
import {
  claimAwaitingReviewValidator,
  readClaimsAwaitingReview,
} from "./provenance";
import {
  approvalCountsValidator,
  pendingApprovalValidator,
  readPendingApprovals,
} from "./utils/pendingApprovals";
import { getCurrentUserOrganization } from "./utils/permissions";
import { MAX_COLUMN_CARDS, WORK_COLUMN_PAGE } from "./utils/workBoardColumns";
import { workError } from "./utils/workErrors";

function column<const Key extends string, Card extends GenericValidator>(
  key: Key,
  card: Card,
) {
  return v.object({
    key: v.literal(key),
    cards: v.array(card),
    hasMore: v.boolean(),
  });
}

const columnValidator = v.union(
  column("tasks", taskValidator),
  column("approvals", pendingApprovalValidator).extend({
    /** Every approval waiting on the viewer per kind, not only the cards. */
    byType: approvalCountsValidator,
  }),
  column("conditionApprovals", boardItemValidator),
  column("transfers", transferAwaitingDecisionValidator),
  column("reviews", taskValidator),
  column("assigned", assignedCaseValidator),
  column("provenance", claimAwaitingReviewValidator),
);

const cardLimit = v.optional(v.number());

/**
 * Everything waiting on the viewer, one column per kind of work, in board
 * order. A column the viewer may not work in is left out. Each shows its first
 * cards, 20 unless the viewer loaded more, and says whether more are waiting;
 * the Overview cards count from the same columns.
 */
export const get = query({
  args: {
    organizationId: v.id("organizations"),
    /** The viewer's clock, which approval urgency is measured against. */
    now: v.number(),
    limits: v.optional(
      v.object({
        tasks: cardLimit,
        approvals: cardLimit,
        conditionApprovals: cardLimit,
        transfers: cardLimit,
        reviews: cardLimit,
        assigned: cardLimit,
        provenance: cardLimit,
      }),
    ),
  },
  returns: v.array(columnValidator),
  handler: async (ctx, args) => {
    if (!(await getAuthUserId(ctx))) throw new Error("Not authenticated");
    if (!(await getCurrentUserOrganization(ctx, args.organizationId)))
      throw new Error("Permission denied: not a member");
    const limits = {
      tasks: WORK_COLUMN_PAGE,
      approvals: WORK_COLUMN_PAGE,
      conditionApprovals: WORK_COLUMN_PAGE,
      transfers: WORK_COLUMN_PAGE,
      reviews: WORK_COLUMN_PAGE,
      assigned: WORK_COLUMN_PAGE,
      provenance: WORK_COLUMN_PAGE,
      ...args.limits,
    };
    for (const limit of Object.values(limits)) {
      if (!Number.isInteger(limit) || limit < 1 || limit > MAX_COLUMN_CARDS)
        throw workError(
          "INVALID_INPUT",
          `A column shows between 1 and ${MAX_COLUMN_CARDS} cards`,
        );
    }
    const { organizationId } = args;

    const [
      tasks,
      approvals,
      conditionApprovals,
      transfers,
      reviews,
      assigned,
      provenance,
    ] = await Promise.all([
      readTaskQueue(ctx, organizationId, "owned", limits.tasks),
      readPendingApprovals(ctx, organizationId, args.now, limits.approvals),
      readAwaitingAcceptance(ctx, organizationId, limits.conditionApprovals),
      readAwaitingDecision(ctx, organizationId, limits.transfers),
      readTaskQueue(ctx, organizationId, "review", limits.reviews),
      readAssignedCases(ctx, organizationId, limits.assigned),
      readClaimsAwaitingReview(ctx, organizationId, limits.provenance),
    ]);
    return [
      { key: "tasks" as const, ...tasks },
      { key: "approvals" as const, ...approvals },
      ...(conditionApprovals
        ? [{ key: "conditionApprovals" as const, ...conditionApprovals }]
        : []),
      ...(transfers ? [{ key: "transfers" as const, ...transfers }] : []),
      { key: "reviews" as const, ...reviews },
      { key: "assigned" as const, ...assigned },
      ...(provenance ? [{ key: "provenance" as const, ...provenance }] : []),
    ];
  },
});
