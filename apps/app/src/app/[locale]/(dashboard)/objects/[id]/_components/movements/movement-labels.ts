import type { useCurrentLocale, useScopedI18n } from "@/locales/client";

type MovementsT = ReturnType<typeof useScopedI18n<"locations.movements">>;
type AppLocale = ReturnType<typeof useCurrentLocale>;

const MOVEMENT_ISSUE_TYPES = [
  "location_missing",
  "status_closed",
  "status_renovation",
  "status_restricted",
  "capacity_exceeded",
  "source_changed",
  "external_custody",
  "already_at_destination",
] as const;
type MovementIssueType = (typeof MOVEMENT_ISSUE_TYPES)[number];

function isMovementIssueType(type: string): type is MovementIssueType {
  return (MOVEMENT_ISSUE_TYPES as readonly string[]).includes(type);
}

/** Localized text for a backend movement issue, falling back to its message. */
export function movementIssueLabel(
  t: MovementsT,
  issue: { type: string; message: string },
) {
  return isMovementIssueType(issue.type)
    ? t(`issues.${issue.type}`)
    : issue.message;
}

export function formatMovementTime(locale: string, timestamp: number) {
  const supportedLocale = isAppLocale(locale) ? locale : "en";
  return movementTimeFormatters[supportedLocale].format(timestamp);
}

const APP_LOCALES = ["en", "fr", "es", "no", "ro"] as const;
const movementTimeFormatters: Record<AppLocale, Intl.DateTimeFormat> = {
  en: new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }),
  fr: new Intl.DateTimeFormat("fr", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }),
  es: new Intl.DateTimeFormat("es", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }),
  no: new Intl.DateTimeFormat("no", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }),
  ro: new Intl.DateTimeFormat("ro", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }),
};

function isAppLocale(locale: string): locale is AppLocale {
  return (APP_LOCALES as readonly string[]).includes(locale);
}
