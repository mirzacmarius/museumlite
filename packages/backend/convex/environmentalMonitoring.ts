import { getAuthUserId } from "@convex-dev/auth/server";
import {
  paginationOptsValidator,
  paginationResultValidator,
} from "convex/server";
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
  locationCondition,
  probeStatus,
  SILENT_AFTER_MS,
} from "./utils/alertEpisodePolicy";
import {
  alertEpisodeSummary,
  locationCondition as locationConditionValidator,
  monitoredProbe,
  readingEvidence,
} from "./utils/alertEpisodeValidators";
import { batchLookup } from "./utils/batchLookup";
import { mutation } from "./utils/mutationBuilders";
import {
  requireLocationAdminPermission,
  requirePermission,
} from "./utils/permissions";
import { canReadRecord } from "./utils/recordAccess";

const PROBE_LIMIT = 50;
const RECENT_EPISODE_LIMIT = 5;
const RECENT_READING_LIMIT = 10;

/**
 * What staff need to judge a Location's environment at `now`: its condition,
 * thresholds, bound probes with their latest readings and health, the open
 * alert episode, recent episodes and the latest readings as evidence.
 */
export const getLocationMonitoring = query({
  args: { locationId: v.id("locations"), now: v.number() },
  returns: v.union(
    v.object({
      condition: locationConditionValidator,
      thresholds: v.union(environmentalThresholds, v.null()),
      probes: v.array(monitoredProbe),
      openEpisode: v.union(alertEpisodeSummary, v.null()),
      /** The location's latest ended episodes, newest first. */
      recentEpisodes: v.array(alertEpisodeSummary),
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
    const [bindings, openEpisode, latestEpisodes, recentReadings] =
      await Promise.all([
        ctx.db
          .query("environmentalProbes")
          .withIndex("by_location", (q) => q.eq("locationId", location._id))
          .take(PROBE_LIMIT),
        ctx.db
          .query("alertEpisodes")
          .withIndex("by_locationId_and_status", (q) =>
            q.eq("locationId", location._id).eq("status", "open"),
          )
          .unique(),
        ctx.db
          .query("alertEpisodes")
          .withIndex("by_locationId_and_startedAt", (q) =>
            q.eq("locationId", location._id),
          )
          .order("desc")
          .take(RECENT_EPISODE_LIMIT + 1),
        ctx.db
          .query("environmentalReadings")
          .withIndex("by_location_and_time", (q) =>
            q.eq("locationId", location._id),
          )
          .order("desc")
          .take(RECENT_READING_LIMIT),
      ] as const);
    const probes = await monitoredProbes(
      ctx,
      bindings.filter(
        (binding) =>
          binding.isActive &&
          binding.organizationId === location.organizationId,
      ),
      args.now,
    );
    const endedEpisodes = latestEpisodes
      .filter((episode) => episode.status !== "open")
      .slice(0, RECENT_EPISODE_LIMIT);
    const summaries = await summarizeEpisodes(
      ctx,
      openEpisode ? [openEpisode, ...endedEpisodes] : endedEpisodes,
      args.now,
    );
    const thresholdsSet = !hasNoThresholds(location.environmentalThresholds);
    return {
      condition: locationCondition({
        episodeOpen: openEpisode !== null,
        probeStatuses: probes.map((probe) => probe.status),
        thresholdsSet,
      }),
      thresholds: thresholdsSet
        ? (location.environmentalThresholds ?? null)
        : null,
      probes,
      openEpisode:
        summaries.find((summary) => summary.status === "open") ?? null,
      recentEpisodes: summaries.filter((summary) => summary.status !== "open"),
      recentReadings: await toReadingEvidence(ctx, recentReadings),
    };
  },
});

async function monitoredProbes(
  ctx: QueryCtx,
  bindings: Doc<"environmentalProbes">[],
  now: number,
) {
  const [devices, latestReadings] = await Promise.all([
    batchLookup(
      ctx,
      bindings.map((binding) => binding.deviceId),
      "environmentalDevices",
    ),
    batchLookup(
      ctx,
      bindings.flatMap((binding) =>
        binding.lastReadingId ? [binding.lastReadingId] : [],
      ),
      "environmentalReadings",
    ),
  ] as const);
  const evidence = new Map(
    (await toReadingEvidence(ctx, [...latestReadings.values()])).map(
      (reading) => [reading._id, reading],
    ),
  );
  return bindings.flatMap((binding) => {
    const device = devices.get(binding.deviceId);
    if (!device) return [];
    const latest = binding.lastReadingId
      ? (evidence.get(binding.lastReadingId) ?? null)
      : null;
    return [
      {
        _id: binding._id,
        probeId: binding.probeId,
        deviceName: device.name,
        status: probeStatus(
          {
            deviceRevoked: device.status === "revoked",
            boundAt: binding.boundAt,
            latestObservedAt: latest?.observedAt,
          },
          now,
        ),
        latest,
        deviceLastRequestAt: device.lastSeenAt,
        deviceLastError: device.lastError,
        deviceLastErrorAt: device.lastErrorAt,
      },
    ];
  });
}

/** Episodes for staff, with each tracked probe named and checked for silence. */
async function summarizeEpisodes(
  ctx: QueryCtx,
  episodes: Doc<"alertEpisodes">[],
  now: number,
) {
  const probes = await batchLookup(
    ctx,
    episodes.flatMap((episode) =>
      episode.sources.flatMap((source) => (source.probe ? [source.probe] : [])),
    ),
    "environmentalProbes",
  );
  const [devices, resolvers] = await Promise.all([
    batchLookup(
      ctx,
      [...probes.values()].map((probe) => probe.deviceId),
      "environmentalDevices",
    ),
    batchLookup(
      ctx,
      episodes.flatMap((episode) =>
        episode.resolution ? [episode.resolution.userId] : [],
      ),
      "users",
    ),
  ] as const);
  return episodes.map(
    ({
      organizationId: _organizationId,
      locationId: _locationId,
      _creationTime: _created,
      sources,
      resolution,
      ...episode
    }) => ({
      ...episode,
      resolution: resolution && {
        note: resolution.note,
        resolvedAt: resolution.resolvedAt,
        resolvedByName: displayName(resolvers.get(resolution.userId)),
      },
      sources: sources.map((source) => {
        const probe = source.probe ? probes.get(source.probe) : undefined;
        return {
          ...source,
          probeId: probe?.probeId,
          deviceName: probe ? devices.get(probe.deviceId)?.name : undefined,
          silent:
            episode.status === "open" &&
            source.probe !== undefined &&
            now - source.lastObservedAt > SILENT_AFTER_MS,
        };
      }),
    }),
  );
}

function displayName(user: Doc<"users"> | undefined) {
  return user?.name ?? user?.email;
}

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
      recordedByName: displayName(recorder),
      outOfRange: reading.alertTriggered === true,
      late: reading.late === true,
    };
  });
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
    if (!isValidClimateThresholds(args.thresholds)) {
      throw alertEpisodeError("THRESHOLDS_INVALID");
    }
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

/**
 * One episode and its location, for its evidence page. Malformed or foreign
 * identifiers read as missing.
 */
export const getEpisode = query({
  args: { episodeId: v.string(), now: v.number() },
  returns: v.union(
    v.object({
      episode: alertEpisodeSummary,
      location: v.object({ _id: v.id("locations"), name: v.string() }),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const episode = await readableEpisode(ctx, args.episodeId);
    const location = episode && (await ctx.db.get(episode.locationId));
    if (!episode || !location) return null;
    const [summary] = await summarizeEpisodes(ctx, [episode], args.now);
    return summary
      ? {
          episode: summary,
          location: { _id: location._id, name: location.name },
        }
      : null;
  },
});

/** The readings an episode counted, newest observation first. */
export const listEpisodeReadings = query({
  args: { episodeId: v.string(), paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(readingEvidence),
  handler: async (ctx, args) => {
    const episode = await readableEpisode(ctx, args.episodeId);
    if (!episode) return { page: [], isDone: true, continueCursor: "" };
    const result = await ctx.db
      .query("environmentalReadings")
      .withIndex("by_episodeId_and_recordedAt", (q) =>
        q.eq("episodeId", episode._id),
      )
      .order("desc")
      .paginate(args.paginationOpts);
    return { ...result, page: await toReadingEvidence(ctx, result.page) };
  },
});

async function readableEpisode(ctx: QueryCtx, episodeId: string) {
  const id = ctx.db.normalizeId("alertEpisodes", episodeId);
  const episode = id ? await ctx.db.get(id) : null;
  return episode &&
    (await canReadRecord(ctx, episode.organizationId, "locations.read"))
    ? episode
    : null;
}

const RESOLUTION_NOTE_MAX_LENGTH = 1000;

/**
 * Closes an open episode on a manager's judgement, for example when its probe
 * was moved or retired and conditions were checked another way. The note is
 * kept with the episode. A later reading outside the thresholds opens a new
 * episode.
 */
export const resolveEpisode = mutation({
  args: { episodeId: v.id("alertEpisodes"), note: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const [userId, episode] = await Promise.all([
      getAuthUserId(ctx),
      ctx.db.get(args.episodeId),
    ] as const);
    if (!userId) throw new Error("Not authenticated");
    if (!episode) throw new Error("Alert episode not found");
    await requirePermission(ctx, episode.organizationId, "locations.update");
    const note = args.note.trim();
    if (!note || note.length > RESOLUTION_NOTE_MAX_LENGTH) {
      throw alertEpisodeError("RESOLUTION_NOTE_INVALID");
    }
    if (episode.status !== "open") throw alertEpisodeError("EPISODE_NOT_OPEN");

    const resolvedAt = Date.now();
    await ctx.db.patch(episode._id, {
      status: "resolved",
      endedAt: resolvedAt,
      resolution: { userId, note, resolvedAt },
    });
    await ctx.runMutation(internal.audit.logAction, {
      organizationId: episode.organizationId,
      userId,
      action: "resolved_alert_episode",
      entityType: "alertEpisode",
      entityId: episode._id,
      changes: { locationId: episode.locationId, note },
    });
    return null;
  },
});
