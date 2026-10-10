import type { EnvironmentalMeasure } from "@v1/backend/convex/utils/alertEpisodePolicy";
import { formatDate } from "@/lib/format-date";
import { getRelativeTimeFormatter } from "@/lib/relative-time-formatters";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

type FormatLocale = "en" | "es" | "fr" | "no" | "ro";

interface LocaleFormats {
  celsius: Intl.NumberFormat;
  percent: Intl.NumberFormat;
  number: Intl.NumberFormat;
  minutes: Intl.NumberFormat;
  hours: Intl.NumberFormat;
  days: Intl.NumberFormat;
}

const CELSIUS: Intl.NumberFormatOptions = {
  style: "unit",
  unit: "celsius",
  maximumFractionDigits: 1,
};
const PERCENT: Intl.NumberFormatOptions = {
  style: "unit",
  unit: "percent",
  maximumFractionDigits: 1,
};
const NUMBER: Intl.NumberFormatOptions = { maximumFractionDigits: 1 };
const MINUTES: Intl.NumberFormatOptions = {
  style: "unit",
  unit: "minute",
  unitDisplay: "long",
};
const HOURS: Intl.NumberFormatOptions = {
  style: "unit",
  unit: "hour",
  unitDisplay: "long",
};
const DAYS: Intl.NumberFormatOptions = {
  style: "unit",
  unit: "day",
  unitDisplay: "long",
};

const FORMATS: Record<FormatLocale, LocaleFormats> = {
  en: {
    celsius: new Intl.NumberFormat("en", CELSIUS),
    percent: new Intl.NumberFormat("en", PERCENT),
    number: new Intl.NumberFormat("en", NUMBER),
    minutes: new Intl.NumberFormat("en", MINUTES),
    hours: new Intl.NumberFormat("en", HOURS),
    days: new Intl.NumberFormat("en", DAYS),
  },
  es: {
    celsius: new Intl.NumberFormat("es", CELSIUS),
    percent: new Intl.NumberFormat("es", PERCENT),
    number: new Intl.NumberFormat("es", NUMBER),
    minutes: new Intl.NumberFormat("es", MINUTES),
    hours: new Intl.NumberFormat("es", HOURS),
    days: new Intl.NumberFormat("es", DAYS),
  },
  fr: {
    celsius: new Intl.NumberFormat("fr", CELSIUS),
    percent: new Intl.NumberFormat("fr", PERCENT),
    number: new Intl.NumberFormat("fr", NUMBER),
    minutes: new Intl.NumberFormat("fr", MINUTES),
    hours: new Intl.NumberFormat("fr", HOURS),
    days: new Intl.NumberFormat("fr", DAYS),
  },
  no: {
    celsius: new Intl.NumberFormat("nb-NO", CELSIUS),
    percent: new Intl.NumberFormat("nb-NO", PERCENT),
    number: new Intl.NumberFormat("nb-NO", NUMBER),
    minutes: new Intl.NumberFormat("nb-NO", MINUTES),
    hours: new Intl.NumberFormat("nb-NO", HOURS),
    days: new Intl.NumberFormat("nb-NO", DAYS),
  },
  ro: {
    celsius: new Intl.NumberFormat("ro", CELSIUS),
    percent: new Intl.NumberFormat("ro", PERCENT),
    number: new Intl.NumberFormat("ro", NUMBER),
    minutes: new Intl.NumberFormat("ro", MINUTES),
    hours: new Intl.NumberFormat("ro", HOURS),
    days: new Intl.NumberFormat("ro", DAYS),
  },
};

function formatsFor(locale: string): LocaleFormats {
  return locale === "es" ||
    locale === "fr" ||
    locale === "no" ||
    locale === "ro"
    ? FORMATS[locale]
    : FORMATS.en;
}

/** A measured value with its unit, for example "21.4°C" or "48 %". */
export function formatMeasurement(
  value: number,
  measure: EnvironmentalMeasure,
  locale: string,
) {
  const formats = formatsFor(locale);
  switch (measure) {
    case "temperature":
      return formats.celsius.format(value);
    case "humidity":
      return formats.percent.format(value);
    case "lightLevel":
      return `${formats.number.format(value)} lx`;
    case "uvLevel":
      return formats.number.format(value);
  }
}

/** A measure's limits, for example "18°C – 22°C", "≤ 55 %" or null when unset. */
export function formatLimits(
  min: number | undefined,
  max: number | undefined,
  measure: EnvironmentalMeasure,
  locale: string,
) {
  if (min !== undefined && max !== undefined) {
    return `${formatMeasurement(min, measure, locale)} – ${formatMeasurement(max, measure, locale)}`;
  }
  if (max !== undefined) return `≤ ${formatMeasurement(max, measure, locale)}`;
  if (min !== undefined) return `≥ ${formatMeasurement(min, measure, locale)}`;
  return null;
}

/**
 * How long ago `timestamp` was at `now`, for example "5 minutes ago". `now` is
 * rounded down to the minute, so a moment after it reads as this minute.
 */
export function formatAge(timestamp: number, now: number, locale: string) {
  const formatter = getRelativeTimeFormatter(locale);
  const elapsed = Math.min(timestamp - now, 0);
  if (Math.abs(elapsed) < HOUR) {
    return formatter.format(Math.round(elapsed / MINUTE), "minute");
  }
  if (Math.abs(elapsed) < 2 * DAY) {
    return formatter.format(Math.round(elapsed / HOUR), "hour");
  }
  return formatter.format(Math.round(elapsed / DAY), "day");
}

/** A length of time, for example "45 minutes", "3 hours" or "2 days". */
export function formatDuration(milliseconds: number, locale: string) {
  const formats = formatsFor(locale);
  const [format, size]: [Intl.NumberFormat, number] =
    milliseconds < HOUR
      ? [formats.minutes, MINUTE]
      : milliseconds < 2 * DAY
        ? [formats.hours, HOUR]
        : [formats.days, DAY];
  return format.format(Math.max(0, Math.round(milliseconds / size)));
}

/** A date and time in the reader's locale, for evidence lists. */
export function formatObservationTime(timestamp: number, locale: string) {
  return formatDate(new Date(timestamp), locale, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export const ENVIRONMENTAL_MEASURES: readonly EnvironmentalMeasure[] = [
  "temperature",
  "humidity",
  "lightLevel",
  "uvLevel",
];
