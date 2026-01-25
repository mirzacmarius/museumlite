"use client";

import { cn } from "../../utils";

interface PayloadEntry {
  value?: number | string;
  name?: string;
  color?: string;
  dataKey?: string | number;
}

interface ChartTooltipContentProps {
  active?: boolean;
  payload?: PayloadEntry[];
  label?: string;
  labelFormatter?: (label: string) => string;
  valueFormatter?: (value: number) => string;
  className?: string;
}

export function ChartTooltipContent({
  active,
  payload,
  label,
  labelFormatter,
  valueFormatter,
  className,
}: ChartTooltipContentProps) {
  if (!active || !payload?.length) return null;

  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-card px-3 py-2 shadow-xl",
        className,
      )}
    >
      {label && (
        <p className="mb-1 text-xs font-medium text-muted-foreground">
          {labelFormatter ? labelFormatter(label) : label}
        </p>
      )}
      <div className="space-y-1">
        {payload.map((entry) => (
          <div
            key={`${entry.dataKey ?? entry.name ?? entry.color ?? "item"}-${entry.value ?? "value"}`}
            className="flex items-center gap-2 text-sm"
          >
            <div
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-muted-foreground">{entry.name}:</span>
            <span className="font-medium text-foreground">
              {valueFormatter && typeof entry.value === "number"
                ? valueFormatter(entry.value)
                : entry.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
