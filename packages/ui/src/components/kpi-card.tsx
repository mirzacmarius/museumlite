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
      accentColor,
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
            "bg-card/40 border border-border/60 rounded-xl p-4",
            className,
          )}
          {...props}
        >
          <div className="flex items-start justify-between">
            <div className="space-y-2 w-full">
              <div className="h-4 w-24 bg-muted/50 rounded animate-pulse" />
              <div className="h-8 w-32 bg-muted/50 rounded animate-pulse" />
            </div>
            <div className="p-2 bg-muted/50 rounded-lg">
              <div className="h-4 w-4 bg-muted/30 rounded animate-pulse" />
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-border/50">
            <div className="h-4 w-36 bg-muted/50 rounded animate-pulse" />
          </div>
        </div>
      );
    }

    return (
      <div
        ref={ref}
        className={cn(
          "bg-card/40 border border-border/60 rounded-xl p-4",
          className,
        )}
        {...props}
      >
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground font-medium">{title}</p>
            <p className="text-2xl font-semibold text-foreground">{value}</p>
          </div>
          {Icon && (
            <div
              className={cn(
                "p-2 rounded-lg",
                accentColor === "indigo" &&
                  "bg-indigo-500/10 border border-indigo-500/20",
                accentColor === "emerald" &&
                  "bg-emerald-500/10 border border-emerald-500/20",
                accentColor === "amber" &&
                  "bg-amber-500/10 border border-amber-500/20",
                accentColor === "blue" &&
                  "bg-blue-500/10 border border-blue-500/20",
                !accentColor && "bg-muted/50",
              )}
            >
              <Icon
                className={cn(
                  "h-4 w-4",
                  accentColor === "indigo" && "text-indigo-400",
                  accentColor === "emerald" && "text-emerald-400",
                  accentColor === "amber" && "text-amber-400",
                  accentColor === "blue" && "text-blue-400",
                  !accentColor && "text-muted-foreground",
                )}
              />
            </div>
          )}
        </div>
        {change && (
          <div className="mt-3 pt-3 border-t border-border/50">
            <p
              className={cn("text-xs", {
                "text-emerald-400": changeType === "positive",
                "text-rose-400": changeType === "negative",
                "text-muted-foreground": changeType === "neutral",
              })}
            >
              {change}
            </p>
          </div>
        )}
      </div>
    );
  },
);

KpiCard.displayName = "KpiCard";

export { KpiCard, type KpiCardProps };
