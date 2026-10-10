"use client";

import type { api } from "@v1/backend/convex/_generated/api";
import type { FunctionReturnType } from "convex/server";
import { useCurrentLocale, useScopedI18n } from "@/locales/client";
import {
  ENVIRONMENTAL_MEASURES,
  formatMeasurement,
  formatObservationTime,
} from "./environment-format";
import { EnvironmentPill } from "./environment-pill";

export type ReadingEvidence = FunctionReturnType<
  typeof api.environmentalMonitoring.listEpisodeReadings
>["page"][number];

/** Who or what took a reading: a device's probe, or a named staff member. */
export function useReadingSourceLabel() {
  const t = useScopedI18n("locations.environment");
  return (reading: ReadingEvidence) => {
    switch (reading.source) {
      case "sensor":
        return t("probeLabel", {
          device: reading.deviceName ?? t("unknownDevice"),
          probe: reading.probeId ?? "?",
        });
      case "manual":
        return reading.recordedByName
          ? t("staffReadingBy", { name: reading.recordedByName })
          : t("staffReading");
      case "imported":
        return t("importedReading");
    }
  };
}

/**
 * Readings as evidence: their values, source, when they were observed and
 * when they arrived, and whether they were outside the thresholds or late.
 */
export function EnvironmentReadingList({
  readings,
}: {
  readings: readonly ReadingEvidence[];
}) {
  const t = useScopedI18n("locations.environment");
  const locale = useCurrentLocale();
  const sourceLabel = useReadingSourceLabel();

  return (
    <ul className="divide-y divide-border/60 dark:divide-white/10">
      {readings.map((reading) => (
        <li
          key={reading._id}
          className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 py-2.5 text-xs"
        >
          <div className="flex flex-wrap items-center gap-2">
            {ENVIRONMENTAL_MEASURES.flatMap((measure) => {
              const value = reading[measure];
              return value === undefined
                ? []
                : [
                    <span
                      key={measure}
                      className="tabular-nums text-foreground"
                    >
                      {formatMeasurement(value, measure, locale)}
                    </span>,
                  ];
            })}
            {reading.outOfRange ? (
              <EnvironmentPill tone="danger">{t("outOfRange")}</EnvironmentPill>
            ) : null}
            {reading.late ? (
              <EnvironmentPill tone="warning">{t("late")}</EnvironmentPill>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-muted-foreground">
            <span>{sourceLabel(reading)}</span>
            <span>
              {t("observedAt", {
                time: formatObservationTime(reading.observedAt, locale),
              })}
            </span>
            {reading.receivedAt !== undefined ? (
              <span>
                {t("receivedAt", {
                  time: formatObservationTime(reading.receivedAt, locale),
                })}
              </span>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}
