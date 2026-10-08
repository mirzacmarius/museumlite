import type { Infer } from "convex/values";
import { v } from "convex/values";

/** How an accountable object movement was authorized. */
export const movementKindValidator = v.union(
  v.literal("direct"),
  v.literal("request"),
  v.literal("bulk_move"),
  v.literal("bulk_edit"),
  v.literal("catalog_edit"),
  v.literal("loan_dispatch"),
  v.literal("loan_return"),
  v.literal("exhibition_install"),
  v.literal("exhibition_return"),
  v.literal("transit_receipt"),
  v.literal("transit_installation"),
);
export type MovementKind = Infer<typeof movementKindValidator>;

/**
 * Reason a movement cannot proceed. Status and capacity issues can be
 * overridden by an authorized reviewer; the others cannot.
 */
export const movementIssueTypeValidator = v.union(
  v.literal("location_missing"),
  v.literal("status_closed"),
  v.literal("status_renovation"),
  v.literal("status_restricted"),
  v.literal("capacity_exceeded"),
  v.literal("source_changed"),
  v.literal("external_custody"),
  v.literal("already_at_destination"),
);
export type MovementIssueType = Infer<typeof movementIssueTypeValidator>;

export const movementIssueValidator = v.object({
  type: movementIssueTypeValidator,
  message: v.string(),
  canOverride: v.boolean(),
});
export type MovementIssue = Infer<typeof movementIssueValidator>;

export const moveRequestConflictValidator = v.object({
  detectedAt: v.number(),
  detectedBy: v.id("users"),
  observedFromLocationId: v.optional(v.id("locations")),
  issues: v.array(movementIssueValidator),
});
