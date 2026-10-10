import { v } from "convex/values";
import { environmentalThresholds } from "./alertEpisodePolicy";

export const environmentalMeasure = v.union(
  v.literal("temperature"),
  v.literal("humidity"),
  v.literal("lightLevel"),
  v.literal("uvLevel"),
);

/** A measure that went past one of its limits during an episode. */
export const episodeBreach = v.object({
  measure: environmentalMeasure,
  direction: v.union(v.literal("above"), v.literal("below")),
});

const observedRange = v.object({ min: v.number(), max: v.number() });

/** The lowest and highest value of each measure among an episode's readings. */
export const observedRanges = v.object({
  temperature: v.optional(observedRange),
  humidity: v.optional(observedRange),
  lightLevel: v.optional(observedRange),
  uvLevel: v.optional(observedRange),
});

export const alertEpisodeStatus = v.union(
  v.literal("open"),
  v.literal("recovered"),
  v.literal("resolved"),
);

/**
 * One sustained breach of a Location's thresholds (ADR 0009). Times named
 * `...At` without a note are observation times reported with the readings.
 */
export const alertEpisodeFields = {
  organizationId: v.id("organizations"),
  locationId: v.id("locations"),
  status: alertEpisodeStatus,
  /** Observation time of the reading that opened the episode. */
  startedAt: v.number(),
  /** Latest observation time of a current reading applied to the episode. */
  lastObservedAt: v.number(),
  /** The thresholds in force when the episode opened. */
  thresholds: environmentalThresholds,
  breaches: v.array(episodeBreach),
  ranges: observedRanges,
  /** Levels reached by readings still outside the thresholds (0 to 2). */
  escalationLevel: v.number(),
  /** Observation time of the reading that reached the current level. */
  escalatedAt: v.optional(v.number()),
  readingCount: v.number(),
  outOfRangeCount: v.number(),
  /** Readings that arrived after a later one from the same probe. */
  lateReadingCount: v.number(),
};

/** An episode as staff see it, without its tenant and location keys. */
export const alertEpisodeSummary = v
  .object(alertEpisodeFields)
  .omit("organizationId", "locationId")
  .extend({ _id: v.id("alertEpisodes") });

/** One reading as evidence: what was measured, by what, observed and received when. */
export const readingEvidence = v.object({
  _id: v.id("environmentalReadings"),
  observedAt: v.number(),
  receivedAt: v.optional(v.number()),
  temperature: v.optional(v.number()),
  humidity: v.optional(v.number()),
  lightLevel: v.optional(v.number()),
  uvLevel: v.optional(v.number()),
  source: v.union(
    v.literal("manual"),
    v.literal("sensor"),
    v.literal("imported"),
  ),
  /** The device's name when the reading arrived, and its probe. */
  deviceName: v.optional(v.string()),
  probeId: v.optional(v.string()),
  /** The staff member who recorded a manual reading. */
  recordedByName: v.optional(v.string()),
  outOfRange: v.boolean(),
  late: v.boolean(),
});
