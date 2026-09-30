export interface OccupancyBar {
  kind: "unconfigured" | "within" | "over";
  percent: number;
  barWidthPercent: number;
}

export function occupancyBar(count: number, capacity: number): OccupancyBar {
  if (capacity <= 0) {
    return { kind: "unconfigured", percent: 0, barWidthPercent: 0 };
  }

  const percent = Math.round((count / capacity) * 100);
  return {
    kind: count > capacity ? "over" : "within",
    percent,
    barWidthPercent: Math.min(percent, 100),
  };
}
