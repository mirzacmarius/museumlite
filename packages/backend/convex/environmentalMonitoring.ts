import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { type QueryCtx, query } from "./_generated/server";
import { alertEpisodeError } from "./utils/alertEpisodeErrors";
import {
  climateThresholds,
  environmentalThresholds,
  hasNoThresholds,
  isValidClimateThresholds,
} from "./utils/alertEpisodePolicy";
import {
  alertEpisodeSummary,
  readingEvidence,
} from "./utils/alertEpisodeValidators";
import { batchLookup } from "./utils/batchLookup";
import { mutation } from "./utils/mutationBuilders";
import { requireLocationAdminPermission } from "./utils/permissions";
import { canReadRecord } from "./utils/recordAccess";

const locationCondition = v.union(
  v.literal("out_of_range"),
  v.literal("no_devices"),
);

/**
 * What staff need to judge a Location's environment: its thresholds and
 * whether its devices currently report.
 */
export const getLocationMonitoring = query({
  args: { locationId: v.id("locations"), now: v.number() },
  returns: v.union(
    v.object({
      condition: locationCondition,
      thresholds: v.union(environmentalThresholds, v.null()),
      openEpisode: v.union(alertEpisodeSummary, v.null()),
      /** The location's latest readings, newest observation first. */
      recentReadings: v.array(readingEvidence),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const location = await ctx.db.get(args.locationId);
    if (
      !location ||
      !(await canReadRecord(ctx, location.organizationId, "locations.read"))
    ) {
      return null;
    }
    const openEpisode = await ctx.db
      .query("alertEpisodes")
      .withIndex("by_locationId_and_status", (q) =>
        q.eq("locationId", location._id).eq("status", "open"),
      )
      .unique();
    const recentReadings = await ctx.db
      .query("environmentalReadings")
      .withIndex("by_location_and_time", (q) =>
        q.eq("locationId", location._id),
      )
      .order("desc")
      .take(RECENT_READING_LIMIT);
    return {
      condition: openEpisode
        ? ("out_of_range" as const)
        : ("no_devices" as const),
      thresholds: hasNoThresholds(location.environmentalThresholds)
        ? null
        : (location.environmentalThresholds ?? null),
      openEpisode: openEpisode && episodeSummary(openEpisode),
      recentReadings: await toReadingEvidence(ctx, recentReadings),
    };
  },
});

const RECENT_READING_LIMIT = 10;

async function toReadingEvidence(
  ctx: QueryCtx,
  readings: Doc<"environmentalReadings">[],
) {
  const recorders = await batchLookup(
    ctx,
    readings.flatMap((reading) =>
      reading.recordedBy ? [reading.recordedBy] : [],
    ),
    "users",
  );
  return readings.map((reading) => {
    const recorder = reading.recordedBy
      ? recorders.get(reading.recordedBy)
      : undefined;
    return {
      _id: reading._id,
      observedAt: reading.recordedAt,
      receivedAt: reading.receivedAt,
      temperature: reading.temperature,
      humidity: reading.humidity,
      lightLevel: reading.lightLevel,
      uvLevel: reading.uvLevel,
      source: reading.source,
      deviceName: reading.sensorId,
      probeId: reading.sensorProbeId,
      recordedByName: recorder?.name ?? recorder?.email,
      outOfRange: reading.alertTriggered === true,
      late: reading.late === true,
    };
  });
}

function episodeSummary({
  organizationId: _organizationId,
  locationId: _locationId,
  _creationTime: _created,
  ...episode
}: Doc<"alertEpisodes">) {
  return episode;
}

/**
 * Replaces the temperature and humidity limits readings are judged against.
 * Light and UV limits stay as they were. New limits apply to later readings;
 * an open alert episode recovers only when readings are back within them.
 */
export const setThresholds = mutation({
  args: {
    locationId: v.id("locations"),
    thresholds: climateThresholds,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const [userId, location] = await Promise.all([
      getAuthUserId(ctx),
      ctx.db.get(args.locationId),
    ] as const);
    if (!userId) throw new Error("Not authenticated");
    if (!location) throw new Error("Location not found");
    await requireLocationAdminPermission(
      ctx,
      location.organizationId,
      "locations.update",
    );
    if (!isValidClimateThresholds(args.thresholds)) {
      throw alertEpisodeError("THRESHOLDS_INVALID");
    }

    const { lightLevelMax, uvLevelMax } =
      location.environmentalThresholds ?? {};
    const thresholds = { ...args.thresholds, lightLevelMax, uvLevelMax };
    await ctx.db.patch(args.locationId, {
      environmentalThresholds: hasNoThresholds(thresholds)
        ? undefined
        : thresholds,
    });
    await ctx.runMutation(internal.audit.logAction, {
      organizationId: location.organizationId,
      userId,
      action: "set_environmental_thresholds",
      entityType: "location",
      entityId: location._id,
      changes: {
        before: location.environmentalThresholds ?? null,
        after: args.thresholds,
      },
    });
    return null;
  },
});
