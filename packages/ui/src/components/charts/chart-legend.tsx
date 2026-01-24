"use client";

import { cn } from "../../utils";

interface LegendItem {
  value: string;
  color: string;
}

interface ChartLegendProps {
  payload?: LegendItem[];
  className?: string;
  align?: "left" | "center" | "right";
}

export function ChartLegend({
  payload,
  className,
  align = "center",
}: ChartLegendProps) {
  if (!payload?.length) return null;

  return (
    <div
      className={cn(
        "flex flex-wrap gap-4 text-sm",
        {
          "justify-start": align === "left",
          "justify-center": align === "center",
          "justify-end": align === "right",
        },
        className,
      )}
    >
      {payload.map((entry, index) => (
        <div key={index} className="flex items-center gap-2">
          <div
            className="h-3 w-3 rounded-sm"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-muted-foreground">{entry.value}</span>
        </div>
      ))}
    </div>
  );
}

export const CHART_COLORS = {
  indigo: "rgb(129, 140, 248)",
  emerald: "rgb(52, 211, 153)",
  amber: "rgb(251, 191, 36)",
  rose: "rgb(251, 113, 133)",
  purple: "rgb(192, 132, 252)",
  cyan: "rgb(34, 211, 238)",
} as const;

export const CHART_COLOR_ARRAY = Object.values(CHART_COLORS);
