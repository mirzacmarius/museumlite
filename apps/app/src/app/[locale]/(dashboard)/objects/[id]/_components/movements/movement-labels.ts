import type { useScopedI18n } from "@/locales/client";

type MovementsT = ReturnType<typeof useScopedI18n<"locations.movements">>;

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
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(timestamp);
}
