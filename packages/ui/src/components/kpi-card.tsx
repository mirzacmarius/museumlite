"use client";

import type { LucideIcon } from "lucide-react";
import * as React from "react";
import { cn } from "../utils";

interface KpiCardProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  value: string | number;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
  icon?: LucideIcon;
  loading?: boolean;
  accentColor?: "indigo" | "emerald" | "amber" | "blue";
}

const KpiCard = React.forwardRef<HTMLDivElement, KpiCardProps>(
  (
    {
      title,
      value,
      change,
      changeType = "neutral",
      icon: Icon,
      loading = false,
      accentColor = "indigo",
      className,
      ...props
    },
    ref,
  ) => {
    if (loading) {
      return (
        <div
          ref={ref}
          className={cn(
            "bg-zinc-900/30 border border-zinc-800/50 rounded-lg p-3 flex items-center gap-3",
            className,
          )}
          {...props}
        >
          <div className="h-8 w-8 bg-zinc-800/50 rounded-md animate-pulse" />
          <div className="space-y-1">
            <div className="h-2 w-16 bg-zinc-800/50 rounded animate-pulse" />
            <div className="h-5 w-24 bg-zinc-800/50 rounded animate-pulse" />
          </div>
        </div>
      );
    }

    return (
      <div
        ref={ref}
        className={cn(
          "bg-zinc-900/30 border border-zinc-800/50 rounded-lg p-3 flex items-center gap-3",
          className,
        )}
        {...props}
      >
        {Icon && (
          <div
            className={cn(
              "p-2 rounded-md border",
              accentColor === "indigo" &&
                "bg-indigo-500/10 border-indigo-500/20",
              accentColor === "emerald" &&
                "bg-emerald-500/10 border-emerald-500/20",
              accentColor === "amber" && "bg-amber-500/10 border-amber-500/20",
              accentColor === "blue" && "bg-blue-500/10 border-blue-500/20",
              !accentColor && "bg-zinc-500/10 border-zinc-500/20",
            )}
          >
            <Icon
              className={cn(
                "w-4 h-4",
                accentColor === "indigo" && "text-indigo-400",
                accentColor === "emerald" && "text-emerald-400",
                accentColor === "amber" && "text-amber-400",
                accentColor === "blue" && "text-blue-400",
                !accentColor && "text-zinc-500",
              )}
            />
          </div>
        )}
        <div>
          <div className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium">
            {title}
          </div>
          <div className="text-lg font-semibold text-zinc-200">{value}</div>
        </div>
      </div>
    );
  },
);

KpiCard.displayName = "KpiCard";

export { KpiCard, type KpiCardProps };
