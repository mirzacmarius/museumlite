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

/**
 * A source that was out of range during an episode, and its recovery: the
 * first in-range observation since its last breach, and when it recovered.
 */
export const episodeSource = v.object({
  /** The reporting probe; absent for staff readings. */
  probe: v.optional(v.id("environmentalProbes")),
  lastObservedAt: v.number(),
  inRangeSince: v.optional(v.number()),
  recoveredAt: v.optional(v.number()),
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
  /** Observation time of the recovering reading, or when staff resolved it. */
  endedAt: v.optional(v.number()),
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
  /** Every source that went out of range must recover before the episode. */
  sources: v.array(episodeSource),
};

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

/** A tracked source with the device and probe names, and whether it is silent. */
export const episodeSourceView = episodeSource.extend({
  deviceName: v.optional(v.string()),
  probeId: v.optional(v.string()),
  silent: v.boolean(),
});

/** An episode as staff see it, without its tenant and location keys. */
export const alertEpisodeSummary = v
  .object(alertEpisodeFields)
  .omit("organizationId", "locationId", "sources")
  .extend({
    _id: v.id("alertEpisodes"),
    sources: v.array(episodeSourceView),
  });

export const probeStatus = v.union(
  v.literal("reporting"),
  v.literal("silent"),
  v.literal("awaiting_first_reading"),
  v.literal("revoked"),
);

/** A probe bound to a location, with its latest reading and device health. */
export const monitoredProbe = v.object({
  _id: v.id("environmentalProbes"),
  probeId: v.string(),
  deviceName: v.string(),
  status: probeStatus,
  latest: v.union(readingEvidence, v.null()),
  /** Last authenticated request from the device, accepted or not. */
  deviceLastRequestAt: v.optional(v.number()),
  deviceLastError: v.optional(v.string()),
  deviceLastErrorAt: v.optional(v.number()),
});

export const locationCondition = v.union(
  v.literal("out_of_range"),
  v.literal("silent"),
  v.literal("awaiting_readings"),
  v.literal("no_thresholds"),
  v.literal("in_range"),
  v.literal("no_devices"),
);
