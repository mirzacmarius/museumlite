import type {
  IncidentImpact,
  IncidentKind,
  IncidentSeverity,
} from "@v1/backend/convex/utils/incidentValidators";

export const INCIDENT_KINDS: readonly IncidentKind[] = [
  "damage",
  "loss",
  "theft",
  "fire",
  "water",
  "pest",
  "environmental",
  "security",
  "other",
];

export const INCIDENT_IMPACTS: readonly IncidentImpact[] = [
  "at_risk",
  "damaged",
  "missing",
  "unaffected",
];

export const INCIDENT_SEVERITIES: readonly IncidentSeverity[] = [
  "minor",
  "moderate",
  "major",
  "critical",
];

export const DATE_TIME: Intl.DateTimeFormatOptions = {
  dateStyle: "medium",
  timeStyle: "short",
};

function pad(value: number) {
  return String(value).padStart(2, "0");
}

/** A `datetime-local` value for a time, in the browser's time zone. */
export function toLocalInputValue(timestamp: number) {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** The time a `datetime-local` value names, or null when it is not a time. */
export function fromLocalInputValue(value: string) {
  const time = new Date(value).getTime();
  return value && Number.isFinite(time) ? time : null;
}
