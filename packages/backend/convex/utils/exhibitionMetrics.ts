import type { Doc } from "../_generated/dataModel";

export const EXHIBITION_METRIC_DEFINITION =
  "exhibition_lifecycle_schedule_v1" as const;

export type ExhibitionSchedulePhase = "current" | "upcoming" | "past";
export type ExhibitionLifecycle = NonNullable<Doc<"exhibitions">["status"]>;

export interface ExhibitionMetricFilters {
  asOf: number;
  schedule?: ExhibitionSchedulePhase;
  lifecycle?: ExhibitionLifecycle | "unclassified";
  includeLoans?: boolean;
}

export function getExhibitionSchedulePhase(
  exhibition: Pick<Doc<"exhibitions">, "startDate" | "endDate">,
  asOf: number,
): ExhibitionSchedulePhase {
  if (exhibition.startDate > asOf) return "upcoming";
  if (exhibition.endDate !== undefined && exhibition.endDate < asOf)
    return "past";
  return "current";
}

export function getExhibitionLifecycle(
  status: string | undefined,
): ExhibitionLifecycle | "unclassified" {
  switch (status) {
    case "proposed":
    case "approved":
    case "installing":
    case "active":
    case "deinstalling":
    case "closed":
    case "rejected":
      return status;
    default:
      return "unclassified";
  }
}

export function matchesExhibitionMetric(
  exhibition: Pick<
    Doc<"exhibitions">,
    "startDate" | "endDate" | "status" | "isLoan"
  >,
  filters: ExhibitionMetricFilters,
): boolean {
  if (filters.includeLoans !== true && exhibition.isLoan === true) return false;
  if (
    filters.schedule &&
    getExhibitionSchedulePhase(exhibition, filters.asOf) !== filters.schedule
  )
    return false;
  if (filters.lifecycle) {
    const lifecycle = getExhibitionLifecycle(exhibition.status);
    if (lifecycle !== filters.lifecycle) return false;
  }
  return true;
}

export function hasExhibitionMetricContradiction(
  exhibition: Pick<Doc<"exhibitions">, "startDate" | "endDate" | "isCurrent">,
  asOf: number,
): boolean {
  return (
    exhibition.isCurrent !==
    (getExhibitionSchedulePhase(exhibition, asOf) === "current")
  );
}

export function summarizeExhibitionMetrics(
  exhibitions: Array<
    Pick<
      Doc<"exhibitions">,
      "startDate" | "endDate" | "status" | "isLoan" | "isCurrent"
    >
  >,
  asOf: number,
) {
  const lifecycleValues = [
    "proposed",
    "approved",
    "installing",
    "active",
    "deinstalling",
    "closed",
    "rejected",
  ] as const;
  const countLifecycle = (lifecycle: (typeof lifecycleValues)[number]) =>
    exhibitions.filter((exhibition) =>
      matchesExhibitionMetric(exhibition, { asOf, lifecycle }),
    ).length;
  const lifecycleCounts = {
    proposed: countLifecycle("proposed"),
    approved: countLifecycle("approved"),
    installing: countLifecycle("installing"),
    active: countLifecycle("active"),
    deinstalling: countLifecycle("deinstalling"),
    closed: countLifecycle("closed"),
    rejected: countLifecycle("rejected"),
  };
  const bySchedule = {
    current: exhibitions.filter((exhibition) =>
      matchesExhibitionMetric(exhibition, { asOf, schedule: "current" }),
    ).length,
    upcoming: exhibitions.filter((exhibition) =>
      matchesExhibitionMetric(exhibition, { asOf, schedule: "upcoming" }),
    ).length,
    past: exhibitions.filter((exhibition) =>
      matchesExhibitionMetric(exhibition, { asOf, schedule: "past" }),
    ).length,
  };
  const unclassified = exhibitions.filter((exhibition) =>
    matchesExhibitionMetric(exhibition, { asOf, lifecycle: "unclassified" }),
  ).length;
  const excludedLoans = exhibitions.filter(
    (exhibition) => exhibition.isLoan === true,
  ).length;
  const legacyContradictions = exhibitions.filter(
    (exhibition) =>
      exhibition.isLoan !== true &&
      hasExhibitionMetricContradiction(exhibition, asOf),
  ).length;

  return {
    ...lifecycleCounts,
    unclassified,
    excludedLoans,
    legacyContradictions,
    bySchedule,
  };
}
