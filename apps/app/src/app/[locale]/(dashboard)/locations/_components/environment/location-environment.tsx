"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import {
  RECOVERY_AFTER_MS,
  SILENT_AFTER_MS,
} from "@v1/backend/convex/utils/alertEpisodePolicy";
import { Button } from "@v1/ui/button";
import { Skeleton } from "@v1/ui/skeleton";
import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { ChevronRight, Pencil, Thermometer } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import {
  MultiPermissionGate,
  PermissionGate,
} from "@/components/permission-gate";
import { useCurrentMinute } from "@/hooks/use-current-minute";
import { useCurrentLocale, useScopedI18n } from "@/locales/client";
import {
  formatAge,
  formatDuration,
  formatLimits,
  formatMeasurement,
  formatObservationTime,
} from "./environment-format";
import { EnvironmentPill, type EnvironmentTone } from "./environment-pill";
import { EnvironmentReadingList } from "./environment-readings";
import { EnvironmentThresholdsDialog } from "./environment-thresholds-dialog";
import {
  EpisodeFacts,
  EpisodeStatusPill,
  type EpisodeSummary,
} from "./episode-facts";
import { ResolveEpisodeDialog } from "./resolve-episode-dialog";

type LocationMonitoring = NonNullable<
  FunctionReturnType<typeof api.environmentalMonitoring.getLocationMonitoring>
>;
type MonitoredProbe = LocationMonitoring["probes"][number];

const HOUR = 60 * 60_000;

const CONDITION_TONES: Record<
  LocationMonitoring["condition"],
  EnvironmentTone
> = {
  out_of_range: "danger",
  silent: "warning",
  awaiting_readings: "warning",
  no_thresholds: "neutral",
  in_range: "ok",
  no_devices: "neutral",
};

const PROBE_TONES: Record<MonitoredProbe["status"], EnvironmentTone> = {
  reporting: "ok",
  silent: "warning",
  awaiting_first_reading: "neutral",
  revoked: "neutral",
};

/**
 * A location's environment as evidence: its condition, never "in range" for
 * a probe that went silent, the open alert episode, recent episodes and the
 * latest readings with when they were observed and received.
 */
export function LocationEnvironment({
  locationId,
}: {
  locationId: Id<"locations">;
}) {
  const t = useScopedI18n("locations.environment");
  const now = useCurrentMinute();
  const monitoring = useQuery(
    api.environmentalMonitoring.getLocationMonitoring,
    now === null ? "skip" : { locationId, now },
  );
  const [editingThresholds, setEditingThresholds] = useState(false);

  return (
    <section
      className="mt-8 border-t border-border/60 pt-5 dark:border-white/10"
      aria-labelledby="location-environment-heading"
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2
          id="location-environment-heading"
          className="flex items-center gap-2 text-xs font-medium"
        >
          <Thermometer
            className="size-4 text-muted-foreground"
            aria-hidden="true"
          />
          {t("title")}
          {monitoring ? (
            <EnvironmentPill tone={CONDITION_TONES[monitoring.condition]}>
              {t(`conditions.${monitoring.condition}`)}
            </EnvironmentPill>
          ) : null}
        </h2>
        {monitoring ? (
          <MultiPermissionGate
            permissions={["locations.update", "organization.manage_settings"]}
            mode="all"
          >
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setEditingThresholds(true)}
            >
              <Pencil className="mr-2 size-3.5" aria-hidden="true" />
              {t("editThresholds")}
            </Button>
          </MultiPermissionGate>
        ) : null}
      </div>

      {monitoring === undefined || now === null ? (
        <Skeleton className="h-40 w-full" />
      ) : monitoring === null ? null : (
        <div className="space-y-6">
          <p className="text-sm text-muted-foreground">
            {t(`conditionDetails.${monitoring.condition}`, {
              hours: SILENT_AFTER_MS / HOUR,
            })}
          </p>
          <ThresholdSummary thresholds={monitoring.thresholds} />
          {monitoring.openEpisode ? (
            <OpenEpisode episode={monitoring.openEpisode} now={now} />
          ) : null}
          <ProbeList probes={monitoring.probes} now={now} />
          <RecentEpisodes episodes={monitoring.recentEpisodes} now={now} />
          <div className="space-y-2">
            <h3 className="text-xs font-medium text-muted-foreground">
              {t("recentReadings")}
            </h3>
            {monitoring.recentReadings.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("noReadings")}</p>
            ) : (
              <EnvironmentReadingList readings={monitoring.recentReadings} />
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {t("policy", {
              minutes: RECOVERY_AFTER_MS / 60_000,
              hours: SILENT_AFTER_MS / HOUR,
            })}
          </p>
          <EnvironmentThresholdsDialog
            locationId={locationId}
            thresholds={monitoring.thresholds}
            open={editingThresholds}
            onOpenChange={setEditingThresholds}
          />
        </div>
      )}
    </section>
  );
}

function ThresholdSummary({
  thresholds,
}: {
  thresholds: LocationMonitoring["thresholds"];
}) {
  const t = useScopedI18n("locations.environment");
  const locale = useCurrentLocale();
  const temperature = formatLimits(
    thresholds?.temperatureMin,
    thresholds?.temperatureMax,
    "temperature",
    locale,
  );
  const humidity = formatLimits(
    thresholds?.humidityMin,
    thresholds?.humidityMax,
    "humidity",
    locale,
  );

  return (
    <dl className="grid grid-cols-1 gap-x-5 gap-y-3 sm:grid-cols-2">
      <div>
        <dt className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
          {t("measures.temperature")}
        </dt>
        <dd className="mt-1.5 text-sm tabular-nums">
          {temperature ?? t("notSet")}
        </dd>
      </div>
      <div>
        <dt className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
          {t("measures.humidity")}
        </dt>
        <dd className="mt-1.5 text-sm tabular-nums">
          {humidity ?? t("notSet")}
        </dd>
      </div>
    </dl>
  );
}

function OpenEpisode({
  episode,
  now,
}: {
  episode: EpisodeSummary;
  now: number;
}) {
  const t = useScopedI18n("locations.environment");
  const locale = useCurrentLocale();
  const [resolving, setResolving] = useState(false);

  return (
    <article
      aria-labelledby="open-episode-heading"
      className="space-y-4 rounded-lg border border-red-500/30 bg-red-500/5 p-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h3
            id="open-episode-heading"
            className="flex flex-wrap items-center gap-2 text-sm font-medium"
          >
            {t("openEpisode")}
            <EpisodeStatusPill episode={episode} />
          </h3>
          <p className="text-xs text-muted-foreground">
            {t("outOfRangeSince", {
              time: formatObservationTime(episode.startedAt, locale),
              duration: formatDuration(now - episode.startedAt, locale),
            })}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <PermissionGate permission="locations.update">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setResolving(true)}
            >
              {t("resolve")}
            </Button>
          </PermissionGate>
          <Button type="button" variant="outline" size="sm" asChild>
            <Link href={`/locations/episodes/${episode._id}`}>
              {t("viewEvidence")}
              <ChevronRight className="ml-1 size-3.5" aria-hidden="true" />
            </Link>
          </Button>
        </div>
      </div>
      <EpisodeFacts episode={episode} now={now} />
      <ResolveEpisodeDialog
        episodeId={episode._id}
        open={resolving}
        onOpenChange={setResolving}
      />
    </article>
  );
}

function ProbeList({
  probes,
  now,
}: {
  probes: LocationMonitoring["probes"];
  now: number;
}) {
  const t = useScopedI18n("locations.environment");
  const locale = useCurrentLocale();

  return (
    <div className="space-y-2">
      <h3 className="text-xs font-medium text-muted-foreground">
        {t("probes")}
      </h3>
      {probes.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("noProbes")}</p>
      ) : (
        <ul className="divide-y divide-border/60 rounded-lg border border-border/60 dark:divide-white/10 dark:border-white/10">
          {probes.map((probe) => (
            <li key={probe._id} className="space-y-1.5 p-3 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm text-foreground">
                  {t("probeLabel", {
                    device: probe.deviceName,
                    probe: probe.probeId,
                  })}
                </span>
                <EnvironmentPill tone={PROBE_TONES[probe.status]}>
                  {t(`probeStatus.${probe.status}`)}
                </EnvironmentPill>
              </div>
              {probe.latest ? (
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-muted-foreground">
                  {probe.latest.temperature !== undefined ? (
                    <span className="tabular-nums text-foreground">
                      {formatMeasurement(
                        probe.latest.temperature,
                        "temperature",
                        locale,
                      )}
                    </span>
                  ) : null}
                  {probe.latest.humidity !== undefined ? (
                    <span className="tabular-nums text-foreground">
                      {formatMeasurement(
                        probe.latest.humidity,
                        "humidity",
                        locale,
                      )}
                    </span>
                  ) : null}
                  <span>
                    {t("observedAt", {
                      time: formatAge(probe.latest.observedAt, now, locale),
                    })}
                  </span>
                  {probe.latest.receivedAt !== undefined ? (
                    <span>
                      {t("receivedAt", {
                        time: formatAge(probe.latest.receivedAt, now, locale),
                      })}
                    </span>
                  ) : null}
                </div>
              ) : (
                <p className="text-muted-foreground">{t("noReadingYet")}</p>
              )}
              <p className="text-muted-foreground">
                {probe.deviceLastRequestAt !== undefined
                  ? t("deviceLastRequest", {
                      time: formatAge(probe.deviceLastRequestAt, now, locale),
                    })
                  : t("deviceNoRequests")}
                {probe.deviceLastError ? (
                  <span className="text-destructive">
                    {" · "}
                    {t("deviceLastError", { error: probe.deviceLastError })}
                  </span>
                ) : null}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function RecentEpisodes({
  episodes,
  now,
}: {
  episodes: readonly EpisodeSummary[];
  now: number;
}) {
  const t = useScopedI18n("locations.environment");
  const locale = useCurrentLocale();

  return (
    <div className="space-y-2">
      <h3 className="text-xs font-medium text-muted-foreground">
        {t("recentEpisodes")}
      </h3>
      {episodes.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("noEpisodes")}</p>
      ) : (
        <ul className="divide-y divide-border/60 rounded-lg border border-border/60 dark:divide-white/10 dark:border-white/10">
          {episodes.map((episode) => (
            <li key={episode._id}>
              <Link
                href={`/locations/episodes/${episode._id}`}
                className="flex flex-wrap items-center justify-between gap-2 p-3 text-xs hover:bg-muted/30 focus-visible:outline focus-visible:outline-ring"
              >
                <span className="flex flex-wrap items-center gap-2">
                  <EpisodeStatusPill episode={episode} />
                  <span className="text-foreground">
                    {formatObservationTime(episode.startedAt, locale)}
                  </span>
                </span>
                <span className="text-muted-foreground">
                  {t("lasted", {
                    duration: formatDuration(
                      (episode.endedAt ?? now) - episode.startedAt,
                      locale,
                    ),
                  })}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
