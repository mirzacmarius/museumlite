import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import {
  type Breach,
  breachesOf,
  describeBreach,
  describeEscalation,
  describeExtremes,
  escalationLevelAfter,
  type MeasuredValues,
  mergeBreaches,
  RECOVERY_AFTER_MS,
  widenRanges,
} from "./alertEpisodePolicy";
import { dispatchNotification } from "./notificationDispatch";
import { getUserIdsWithPermission } from "./permissions";

/** Who produced a reading: a bound probe of a registered device, or staff. */
export type ReadingSource =
  | {
      kind: "probe";
      device: Doc<"environmentalDevices">;
      probe: Doc<"environmentalProbes">;
    }
  | { kind: "staff"; userId: Id<"users"> };

export interface Observation {
  location: Doc<"locations">;
  source: ReadingSource;
  /** When the values were measured, as reported by the source. */
  observedAt: number;
  /** When MuseumLite received them. */
  receivedAt: number;
  values: MeasuredValues;
  externalReadingId?: string;
  notes?: string;
}

/**
 * Stores an authenticated reading and applies it to its Location's alert
 * episode (ADR 0009). A current reading outside the thresholds opens an
 * episode when none is open, and later readings update, escalate and recover
 * it, each transition notifying the location's managers once. A late reading
 * only adds evidence to the open episode it was observed in.
 */
export async function acceptReading(
  ctx: MutationCtx,
  observation: Observation,
) {
  const { location, source } = observation;
  const breaches = breachesOf(
    location.environmentalThresholds,
    observation.values,
  );
  const late = await isLate(ctx, observation);
  const episodeId = late
    ? await addLateEvidence(ctx, observation, breaches)
    : await applyToEpisode(ctx, observation, breaches);
  const readingId = await ctx.db.insert("environmentalReadings", {
    organizationId: location.organizationId,
    locationId: location._id,
    ...observation.values,
    recordedAt: observation.observedAt,
    observedAt: observation.observedAt,
    receivedAt: observation.receivedAt,
    notes: observation.notes,
    ...(source.kind === "probe"
      ? {
          source: "sensor" as const,
          sensorId: source.device.name,
          sensorDeviceId: source.device._id,
          sensorProbeId: source.probe.probeId,
          externalReadingId: observation.externalReadingId,
        }
      : { source: "manual" as const, recordedBy: source.userId }),
    alertTriggered: breaches.length > 0,
    episodeId,
    late,
  });
  if (source.kind === "probe" && !late) {
    await ctx.db.patch(source.probe._id, { lastReadingId: readingId });
  }
  return { readingId, episodeId, breaches, late };
}

/**
 * A probe's reading is late when it was observed before the latest reading
 * already accepted from that probe. Staff readings carry the time they were
 * recorded, so they are never late.
 */
async function isLate(ctx: MutationCtx, observation: Observation) {
  const { source } = observation;
  if (source.kind !== "probe" || !source.probe.lastReadingId) return false;
  const latest = await ctx.db.get(source.probe.lastReadingId);
  return latest !== null && observation.observedAt < latest.recordedAt;
}

async function openEpisodeOf(ctx: MutationCtx, locationId: Id<"locations">) {
  return await ctx.db
    .query("alertEpisodes")
    .withIndex("by_locationId_and_status", (q) =>
      q.eq("locationId", locationId).eq("status", "open"),
    )
    .unique();
}

async function applyToEpisode(
  ctx: MutationCtx,
  observation: Observation,
  breaches: Breach[],
): Promise<Id<"alertEpisodes"> | undefined> {
  const open = await openEpisodeOf(ctx, observation.location._id);
  if (open) {
    await updateEpisode(ctx, open, observation, breaches);
    return open._id;
  }
  return breaches.length > 0
    ? await openEpisode(ctx, observation, breaches)
    : undefined;
}

/** Counts a late reading observed during the open episode, without moving it. */
async function addLateEvidence(
  ctx: MutationCtx,
  observation: Observation,
  breaches: Breach[],
) {
  const open = await openEpisodeOf(ctx, observation.location._id);
  if (!open || observation.observedAt < open.startedAt) return undefined;
  await ctx.db.patch(open._id, {
    ...withEvidence(open, observation, breaches),
    lateReadingCount: open.lateReadingCount + 1,
  });
  return open._id;
}

function withEvidence(
  episode: Doc<"alertEpisodes">,
  observation: Observation,
  breaches: Breach[],
) {
  return {
    breaches: mergeBreaches(episode.breaches, breaches),
    ranges: widenRanges(episode.ranges, observation.values),
    readingCount: episode.readingCount + 1,
    outOfRangeCount: episode.outOfRangeCount + (breaches.length > 0 ? 1 : 0),
  };
}

async function openEpisode(
  ctx: MutationCtx,
  observation: Observation,
  breaches: Breach[],
) {
  const { location } = observation;
  const episodeId = await ctx.db.insert("alertEpisodes", {
    organizationId: location.organizationId,
    locationId: location._id,
    status: "open",
    startedAt: observation.observedAt,
    lastObservedAt: observation.observedAt,
    thresholds: location.environmentalThresholds ?? {},
    breaches: mergeBreaches([], breaches),
    ranges: widenRanges({}, observation.values),
    escalationLevel: 0,
    readingCount: 1,
    outOfRangeCount: 1,
    lateReadingCount: 0,
    sources: trackSource([], observation, true),
  });
  await notifyManagers(ctx, location, episodeId, "opened", {
    title: `Environment out of range: ${location.name}`,
    message: `${describeBreaches(breaches)}.`,
  });
  return episodeId;
}

async function updateEpisode(
  ctx: MutationCtx,
  episode: Doc<"alertEpisodes">,
  observation: Observation,
  breaches: Breach[],
) {
  const { location, observedAt } = observation;
  const evidence = withEvidence(episode, observation, breaches);
  const sources = trackSource(
    episode.sources,
    observation,
    breaches.length > 0,
  );
  const lastObservedAt = Math.max(episode.lastObservedAt, observedAt);
  if (sources.every((source) => source.recoveredAt !== undefined)) {
    await ctx.db.patch(episode._id, {
      ...evidence,
      lastObservedAt,
      sources,
      status: "recovered",
      endedAt: observedAt,
    });
    await notifyManagers(ctx, location, episode._id, "recovered", {
      title: `Environment back in range: ${location.name}`,
      message: `Readings are back within the thresholds. ${describeExtremes(evidence.breaches, evidence.ranges)}.`,
    });
    return;
  }

  const level =
    breaches.length > 0
      ? escalationLevelAfter(observedAt - episode.startedAt)
      : 0;
  const escalates = level > episode.escalationLevel;
  await ctx.db.patch(episode._id, {
    ...evidence,
    lastObservedAt,
    sources,
    ...(escalates ? { escalationLevel: level, escalatedAt: observedAt } : {}),
  });
  if (escalates) {
    await notifyManagers(ctx, location, episode._id, `escalated:${level}`, {
      title: `Environment still out of range: ${location.name}`,
      message: `Out of range for over ${describeEscalation(level)}. ${describeBreaches(breaches)}.`,
    });
  }
}

/**
 * Records a current reading against the sources that went out of range. A
 * breach (re)starts its source's recovery; a probe recovers after in-range
 * readings spanning RECOVERY_AFTER_MS, and a staff spot check within the
 * thresholds recovers the staff source at once. Sources that stayed in range
 * are not tracked, so they can never recover a breach another source showed.
 */
function trackSource(
  sources: Doc<"alertEpisodes">["sources"],
  observation: Observation,
  outOfRange: boolean,
): Doc<"alertEpisodes">["sources"] {
  const { source, observedAt } = observation;
  const probe = source.kind === "probe" ? source.probe._id : undefined;
  const tracked = sources.find((entry) => entry.probe === probe);
  const others = sources.filter((entry) => entry !== tracked);
  if (outOfRange) return [...others, { probe, lastObservedAt: observedAt }];
  if (!tracked) return sources;
  if (tracked.recoveredAt !== undefined) {
    return [...others, { ...tracked, lastObservedAt: observedAt }];
  }
  const inRangeSince = tracked.inRangeSince ?? observedAt;
  const recovered =
    source.kind === "staff" || observedAt - inRangeSince >= RECOVERY_AFTER_MS;
  return [
    ...others,
    {
      probe,
      lastObservedAt: observedAt,
      inRangeSince,
      recoveredAt: recovered ? observedAt : undefined,
    },
  ];
}

function describeBreaches(breaches: Breach[]) {
  return breaches.map(describeBreach).join("; ");
}

async function notifyManagers(
  ctx: MutationCtx,
  location: Doc<"locations">,
  episodeId: Id<"alertEpisodes">,
  transition: string,
  content: { title: string; message: string },
) {
  await dispatchNotification(ctx, {
    organizationId: location.organizationId,
    type: "environmental_alert",
    recipients: await getUserIdsWithPermission(
      ctx,
      location.organizationId,
      "locations.update",
    ),
    ...content,
    related: { entityType: "alertEpisode", entityId: episodeId },
    idempotencyKey: `alert-episode:${episodeId}:${transition}`,
  });
}
