"use client";

import type { LucideIcon } from "lucide-react";
import * as React from "react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";
import { cn } from "../utils";

function getAccentHex(color?: string): string {
  switch (color) {
    case "indigo":
      return "#6366f1";
    case "emerald":
      return "#10b981";
    case "amber":
      return "#f59e0b";
    case "blue":
      return "#3b82f6";
    default:
      return "#6b7280";
  }
}

interface KpiCardProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  value: string | number;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
  icon?: LucideIcon;
  loading?: boolean;
  accentColor?: "indigo" | "emerald" | "amber" | "blue";
  sparklineData?: number[];
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
      sparklineData,
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
        {(change || (sparklineData && sparklineData.length > 0)) && (
          <div className="mt-3 pt-3 border-t border-border/50">
            {change && (
              <p
                className={cn("text-xs", {
                  "text-emerald-400": changeType === "positive",
                  "text-rose-400": changeType === "negative",
                  "text-muted-foreground": changeType === "neutral",
                })}
              >
                {change}
              </p>
            )}
            {sparklineData && sparklineData.length > 0 && (
              <div className={cn("h-8", change && "mt-2")}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={sparklineData.map((v, i) => ({ value: v, index: i }))}
                    margin={{ top: 0, right: 0, left: 0, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient
                        id={`sparkline-gradient-${accentColor ?? "default"}`}
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="5%"
                          stopColor={getAccentHex(accentColor)}
                          stopOpacity={0.3}
                        />
                        <stop
                          offset="95%"
                          stopColor={getAccentHex(accentColor)}
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke={getAccentHex(accentColor)}
                      strokeWidth={1.5}
                      fill={`url(#sparkline-gradient-${accentColor ?? "default"})`}
                      isAnimationActive={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )}
      </div>
    );
  },
);

KpiCard.displayName = "KpiCard";

export { KpiCard, type KpiCardProps };
