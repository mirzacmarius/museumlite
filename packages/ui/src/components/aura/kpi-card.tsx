import type { LucideIcon } from "lucide-react";
import * as React from "react";
import { cn } from "../../utils";

interface AuraKpiCardProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  value: string | number;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
  icon?: LucideIcon;
  loading?: boolean;
}

const AuraKpiCard = React.forwardRef<HTMLDivElement, AuraKpiCardProps>(
  (
    {
      title,
      value,
      change,
      changeType = "neutral",
      icon: Icon,
      loading = false,
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
            "bg-zinc-900/40 border border-zinc-800/60 rounded-xl p-4",
            className,
          )}
          {...props}
        >
          <div className="flex items-start justify-between">
            <div className="space-y-2 w-full">
              <div className="h-4 w-24 bg-zinc-800/50 rounded animate-pulse" />
              <div className="h-8 w-32 bg-zinc-800/50 rounded animate-pulse" />
            </div>
            <div className="p-2 bg-zinc-800/50 rounded-lg">
              <div className="h-4 w-4 bg-zinc-700/50 rounded animate-pulse" />
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-zinc-800/50">
            <div className="h-4 w-36 bg-zinc-800/50 rounded animate-pulse" />
          </div>
        </div>
      );
    }

    return (
      <div
        ref={ref}
        className={cn(
          "bg-zinc-900/40 border border-zinc-800/60 rounded-xl p-4",
          className,
        )}
        {...props}
      >
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-xs text-zinc-500 font-medium">{title}</p>
            <p className="text-2xl font-semibold text-zinc-100">{value}</p>
          </div>
          {Icon && (
            <div className="p-2 bg-zinc-800/50 rounded-lg">
              <Icon className="h-4 w-4 text-zinc-400" />
            </div>
          )}
        </div>
        {change && (
          <div className="mt-3 pt-3 border-t border-zinc-800/50">
            <p
              className={cn("text-xs", {
                "text-emerald-400": changeType === "positive",
                "text-rose-400": changeType === "negative",
                "text-zinc-500": changeType === "neutral",
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

AuraKpiCard.displayName = "AuraKpiCard";

export { AuraKpiCard, type AuraKpiCardProps };
