export type ExhibitionScheduleStatus = "past" | "current" | "upcoming";

export type ExhibitionScheduleFilter = "all" | "past" | "current" | "upcoming";

interface ExhibitionScheduleDates {
  startDate: number;
  endDate?: number;
}

export function getExhibitionScheduleStatus(
  exhibition: ExhibitionScheduleDates,
  now: number | undefined,
): ExhibitionScheduleStatus | undefined {
  if (now === undefined) {
    return undefined;
  }

  if (exhibition.endDate !== undefined && exhibition.endDate < now) {
    return "past";
  }

  if (exhibition.startDate > now) {
    return "upcoming";
  }

  return "current";
}

export function matchesScheduleFilter(
  status: ExhibitionScheduleStatus | undefined,
  filter: ExhibitionScheduleFilter,
): boolean {
  if (filter === "all") {
    return true;
  }

  return status === filter;
}
