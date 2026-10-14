import { v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { accessionStatusValidator } from "./accessionReview";
import { batchLookup } from "./batchLookup";

export const accessionListItemValidator = v.object({
  _id: v.id("accessions"),
  accessionNumber: v.string(),
  dateReceived: v.number(),
  source: v.string(),
  draftTitle: v.optional(v.string()),
  method: v.union(
    v.literal("purchase"),
    v.literal("gift"),
    v.literal("loan"),
    v.literal("transfer"),
    v.literal("donation"),
    v.literal("other"),
    v.literal("bequest"),
  ),
  status: accessionStatusValidator,
  workflowStep: v.optional(v.number()),
  approvedAt: v.optional(v.number()),
  assignedTo: v.optional(v.id("users")),
  assigneeName: v.optional(v.string()),
});

export async function toAccessionListItems(
  ctx: QueryCtx,
  page: Doc<"accessions">[],
) {
  const usersMap = await batchLookup(
    ctx,
    page.flatMap((item) => (item.assignedTo ? [item.assignedTo] : [])),
    "users",
  );
  return page.map((item) => {
    const assignee = item.assignedTo
      ? usersMap.get(item.assignedTo)
      : undefined;
    return {
      _id: item._id,
      accessionNumber: item.accessionNumber,
      dateReceived: item.dateReceived,
      source: item.source,
      draftTitle: item.draftObjectData?.title,
      method: item.method,
      status: item.status,
      workflowStep: item.workflowStep,
      approvedAt: item.approvedAt,
      assignedTo: item.assignedTo,
      assigneeName: assignee?.name || assignee?.email || undefined,
    };
  });
}
