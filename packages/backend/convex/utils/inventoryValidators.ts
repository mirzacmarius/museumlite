import type { Infer } from "convex/values";
import { v } from "convex/values";

export const inventorySessionStatusValidator = v.union(
  v.literal("scanning"),
  v.literal("reviewing"),
  v.literal("reconciled"),
  v.literal("cancelled"),
);
export type InventorySessionStatus = Infer<
  typeof inventorySessionStatusValidator
>;

/**
 * A session compares the objects recorded in one Location (and optionally
 * everything below it) with what staff observe there. The scope's Locations
 * and the expected objects are snapshots taken when the session starts.
 */
export const inventorySessionFields = {
  organizationId: v.id("organizations"),
  name: v.string(),
  scopeLocationId: v.id("locations"),
  includeSublocations: v.boolean(),
  scopeLocationIds: v.array(v.id("locations")),
  status: inventorySessionStatusValidator,
  expectedCount: v.number(),
  /** Expected objects observed at least once (anywhere in scope). */
  observedExpectedCount: v.number(),
  observationCount: v.number(),
  openExceptionCount: v.number(),
  exceptionCount: v.number(),
  startedBy: v.id("users"),
  startedAt: v.number(),
  finishedBy: v.optional(v.id("users")),
  finishedAt: v.optional(v.number()),
  reconciledAt: v.optional(v.number()),
  cancelledBy: v.optional(v.id("users")),
  cancelledAt: v.optional(v.number()),
  cancelReason: v.optional(v.string()),
};

export const inventoryExpectedObjectFields = {
  organizationId: v.id("organizations"),
  sessionId: v.id("inventorySessions"),
  collectionId: v.id("collections"),
  /** Where the record placed the object when the session started. */
  expectedLocationId: v.id("locations"),
  firstObservationId: v.optional(v.id("inventoryObservations")),
};

export const inventoryCaptureMethodValidator = v.union(
  v.literal("scan"),
  v.literal("manual"),
);

/** How an observation compares with the session's expectation. */
export const inventoryObservationOutcomeValidator = v.union(
  v.literal("expected"),
  v.literal("misplaced"),
  v.literal("unexpected"),
  v.literal("unknown"),
  v.literal("repeat"),
);
export type InventoryObservationOutcome = Infer<
  typeof inventoryObservationOutcomeValidator
>;

/**
 * Evidence that someone saw (or failed to identify) a label at a place and
 * time. Never a movement: the object's record is not changed.
 */
export const inventoryObservationFields = {
  organizationId: v.id("organizations"),
  sessionId: v.id("inventorySessions"),
  /** Client-chosen identity of one scan; a retry with it records nothing. */
  clientObservationId: v.string(),
  scannedValue: v.string(),
  method: inventoryCaptureMethodValidator,
  observedLocationId: v.id("locations"),
  observedBy: v.id("users"),
  observedAt: v.number(),
  note: v.optional(v.string()),
  collectionId: v.optional(v.id("collections")),
  /** The object's recorded location when it was observed. */
  recordedLocationId: v.optional(v.id("locations")),
  outcome: inventoryObservationOutcomeValidator,
};

export const inventoryExceptionKindValidator = v.union(
  v.literal("missing"),
  v.literal("misplaced"),
  v.literal("unexpected"),
  v.literal("unknown_label"),
);
export type InventoryExceptionKind = Infer<
  typeof inventoryExceptionKindValidator
>;

export const inventoryExceptionStatusValidator = v.union(
  v.literal("open"),
  v.literal("accepted"),
  v.literal("resolved"),
);

export const inventoryExceptionResolutionValidator = v.union(
  v.object({
    kind: v.literal("moved"),
    movementId: v.id("locationHistory"),
  }),
  /** The record already showed the observed location; nothing moved. */
  v.object({ kind: v.literal("location_confirmed") }),
  v.object({ kind: v.literal("accepted"), reason: v.string() }),
);
export type InventoryExceptionResolution = Infer<
  typeof inventoryExceptionResolutionValidator
>;

export const inventoryExceptionFields = {
  organizationId: v.id("organizations"),
  sessionId: v.id("inventorySessions"),
  kind: inventoryExceptionKindValidator,
  status: inventoryExceptionStatusValidator,
  /** Accession number or scanned value when detected, for task lists. */
  label: v.string(),
  collectionId: v.optional(v.id("collections")),
  scannedValue: v.optional(v.string()),
  /** Where the record placed the object (expected or at observation). */
  recordedLocationId: v.optional(v.id("locations")),
  observedLocationId: v.optional(v.id("locations")),
  observationId: v.optional(v.id("inventoryObservations")),
  detectedAt: v.number(),
  resolution: v.optional(inventoryExceptionResolutionValidator),
  resolvedBy: v.optional(v.id("users")),
  resolvedAt: v.optional(v.number()),
};
