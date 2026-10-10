"use client";

import type { api } from "@v1/backend/convex/_generated/api";
import type { FunctionReturnType } from "convex/server";
import type { ReactNode } from "react";
import { useCurrentLocale, useScopedI18n } from "@/locales/client";
import {
  formatAge,
  formatDuration,
  formatLimits,
  formatMeasurement,
  formatObservationTime,
} from "./environment-format";
import { EnvironmentPill, type EnvironmentTone } from "./environment-pill";

export type EpisodeSummary = NonNullable<
  FunctionReturnType<typeof api.environmentalMonitoring.getEpisode>
>["episode"];

const STATUS_TONES: Record<EpisodeSummary["status"], EnvironmentTone> = {
  open: "danger",
  recovered: "ok",
  resolved: "neutral",
};

export function EpisodeStatusPill({ episode }: { episode: EpisodeSummary }) {
  const t = useScopedI18n("locations.environment");
  return (
    <EnvironmentPill tone={STATUS_TONES[episode.status]}>
      {t(`episodeStatus.${episode.status}`)}
      {episode.status === "open" && episode.escalationLevel > 0
        ? ` · ${t(`escalationLevel.${episode.escalationLevel === 1 ? "hour" : "day"}`)}`
        : null}
    </EnvironmentPill>
  );
}

function limitOf(
  thresholds: EpisodeSummary["thresholds"],
  breach: EpisodeSummary["breaches"][number],
) {
  const above = breach.direction === "above";
  switch (breach.measure) {
    case "temperature":
      return above ? thresholds.temperatureMax : thresholds.temperatureMin;
    case "humidity":
      return above ? thresholds.humidityMax : thresholds.humidityMin;
    case "lightLevel":
      return thresholds.lightLevelMax;
    case "uvLevel":
      return thresholds.uvLevelMax;
  }
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1.5 text-sm text-foreground">{children}</dd>
    </div>
  );
}

/**
 * What an episode showed: when it began and ended by observation time, how
 * far readings went past which limits, how many readings it counted, and
 * whether each probe that went out of range has recovered or gone silent.
 */
export function EpisodeFacts({
  episode,
  now,
}: {
  episode: EpisodeSummary;
  now: number;
}) {
  const t = useScopedI18n("locations.environment");
  const locale = useCurrentLocale();
  const end = episode.endedAt ?? now;

  return (
    <div className="space-y-5">
      <dl className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-3">
        <Fact label={t("startedAt")}>
          {formatObservationTime(episode.startedAt, locale)}
          <span className="block text-xs text-muted-foreground">
            {formatAge(episode.startedAt, now, locale)}
          </span>
        </Fact>
        <Fact
          label={episode.status === "open" ? t("lastReading") : t("endedAt")}
        >
          {formatObservationTime(
            episode.status === "open"
              ? episode.lastObservedAt
              : (episode.endedAt ?? episode.lastObservedAt),
            locale,
          )}
          <span className="block text-xs text-muted-foreground">
            {episode.status === "open"
              ? t("openFor", {
                  duration: formatDuration(end - episode.startedAt, locale),
                })
              : t("lasted", {
                  duration: formatDuration(end - episode.startedAt, locale),
                })}
          </span>
        </Fact>
        <Fact label={t("readings")}>
          {t("readingCounts", {
            count: episode.readingCount,
            outOfRange: episode.outOfRangeCount,
            late: episode.lateReadingCount,
          })}
        </Fact>
      </dl>

      <div className="space-y-2">
        <h4 className="text-xs font-medium text-muted-foreground">
          {t("breaches")}
        </h4>
        <ul className="space-y-1 text-sm">
          {episode.breaches.map((breach) => {
            const range = episode.ranges[breach.measure];
            const extreme =
              breach.direction === "above" ? range?.max : range?.min;
            const limit = limitOf(episode.thresholds, breach);
            return (
              <li key={`${breach.measure}-${breach.direction}`}>
                {t(`breach.${breach.direction}`, {
                  measure: t(`measures.${breach.measure}`),
                  limit:
                    limit === undefined
                      ? "?"
                      : formatMeasurement(limit, breach.measure, locale),
                })}
                {extreme !== undefined ? (
                  <span className="text-muted-foreground">
                    {" · "}
                    {t(`extreme.${breach.direction}`, {
                      value: formatMeasurement(extreme, breach.measure, locale),
                    })}
                  </span>
                ) : null}
              </li>
            );
          })}
        </ul>
      </div>

      <EpisodeSources episode={episode} now={now} />

      {episode.resolution ? (
        <div className="rounded-md border border-border/60 bg-muted/20 p-3 text-sm dark:border-white/10">
          <p className="text-xs text-muted-foreground">
            {t("resolvedBy", {
              name: episode.resolution.resolvedByName ?? t("unknownStaff"),
              time: formatObservationTime(
                episode.resolution.resolvedAt,
                locale,
              ),
            })}
          </p>
          <p className="mt-1 whitespace-pre-wrap">{episode.resolution.note}</p>
        </div>
      ) : null}

      <p className="text-xs text-muted-foreground">
        {t("thresholdsAtOpening", {
          temperature:
            formatLimits(
              episode.thresholds.temperatureMin,
              episode.thresholds.temperatureMax,
              "temperature",
              locale,
            ) ?? t("notSet"),
          humidity:
            formatLimits(
              episode.thresholds.humidityMin,
              episode.thresholds.humidityMax,
              "humidity",
              locale,
            ) ?? t("notSet"),
        })}
      </p>
    </div>
  );
}

/** Each source that went out of range and where its recovery stands. */
function EpisodeSources({
  episode,
  now,
}: {
  episode: EpisodeSummary;
  now: number;
}) {
  const t = useScopedI18n("locations.environment");
  const locale = useCurrentLocale();
  const age = (timestamp: number) => formatAge(timestamp, now, locale);

  return (
    <div className="space-y-2">
      <h4 className="text-xs font-medium text-muted-foreground">
        {t("sourcesHeading")}
      </h4>
      <ul className="space-y-1.5 text-sm">
        {episode.sources.map((source) => {
          const label =
            source.probeId !== undefined
              ? t("probeLabel", {
                  device: source.deviceName ?? t("unknownDevice"),
                  probe: source.probeId,
                })
              : t("staffReadings");
          const [tone, state]: [EnvironmentTone, string] =
            source.recoveredAt !== undefined
              ? ["ok", t("sourceRecovered", { time: age(source.recoveredAt) })]
              : source.silent
                ? [
                    "warning",
                    t("sourceSilent", { time: age(source.lastObservedAt) }),
                  ]
                : source.inRangeSince !== undefined
                  ? [
                      "neutral",
                      t("sourceRecovering", { time: age(source.inRangeSince) }),
                    ]
                  : [
                      "danger",
                      t("sourceOutOfRange", {
                        time: age(source.lastObservedAt),
                      }),
                    ];
          return (
            <li
              key={source.probe ?? "staff"}
              className="flex flex-wrap items-center gap-2"
            >
              <span>{label}</span>
              <EnvironmentPill tone={tone}>{state}</EnvironmentPill>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
