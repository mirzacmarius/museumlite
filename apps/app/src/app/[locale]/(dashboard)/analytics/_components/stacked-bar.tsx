"use client";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@v1/ui/tooltip";
import { cn } from "@v1/ui/utils";

interface StackedBarProps {
  data: {
    label: string;
    value: number;
    color: string;
  }[];
  className?: string;
  total?: number;
  height?: string;
}

export function StackedBar({
  data,
  className,
  total: totalOverride,
  height = "h-2",
}: StackedBarProps) {
  const total =
    totalOverride ?? data.reduce((acc, item) => acc + item.value, 0);

  if (total === 0) {
    return (
      <div
        className={cn(
          "w-full bg-muted rounded-full overflow-hidden",
          height,
          className,
        )}
      />
    );
  }

  return (
    <div
      className={cn(
        "flex w-full overflow-hidden rounded-full",
        height,
        className,
      )}
    >
      <TooltipProvider delayDuration={0}>
        {data.map((item) => {
          if (item.value === 0) return null;
          const percentage = (item.value / total) * 100;
          return (
            <Tooltip key={item.label}>
              <TooltipTrigger asChild>
                <div
                  style={{ width: `${percentage}%` }}
                  className={cn(
                    "h-full transition-all duration-500 first:rounded-l-full last:rounded-r-full hover:brightness-110",
                    item.color,
                  )}
                />
              </TooltipTrigger>
              <TooltipContent>
                <div className="flex flex-col gap-1">
                  <span className="font-semibold text-xs">{item.label}</span>
                  <span className="text-xs text-muted-foreground">
                    {item.value.toLocaleString()} ({percentage.toFixed(1)}%)
                  </span>
                </div>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </TooltipProvider>
    </div>
  );
}
