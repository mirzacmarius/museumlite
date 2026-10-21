"use client";

import type { LucideIcon } from "lucide-react";
import type * as React from "react";
import { cn } from "../utils";
import { SlidingNumber } from "./sliding-number";

interface KpiCardProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  value: string | number;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
  icon?: LucideIcon;
  loading?: boolean;
  accentColor?: "indigo" | "emerald" | "amber" | "blue";
}

const KpiCard = ({
  title,
  value,
  change,
  changeType = "neutral",
  icon: Icon,
  loading = false,
  accentColor = "indigo",
  className,
  ref,
  ...props
}: KpiCardProps & React.RefAttributes<HTMLDivElement>) => {
  if (loading) {
    return (
      <div
        ref={ref}
        className={cn(
          "flex items-center gap-3 rounded-lg border border-border bg-card p-3",
          className,
        )}
        {...props}
      >
        <div className="size-8 animate-pulse rounded-md bg-muted/70" />
        <div className="space-y-1">
          <div className="h-2 w-16 animate-pulse rounded bg-muted/70" />
          <div className="h-5 w-24 animate-pulse rounded bg-muted/70" />
        </div>
      </div>
    );
  }

  return (
    <div
      ref={ref}
      className={cn(
        "flex items-center gap-3 rounded-lg border border-border bg-card p-3",
        className,
      )}
      {...props}
    >
      {Icon && (
        <div
          className={cn(
            "p-2 rounded-md border",
            accentColor === "indigo" && "bg-primary/10 border-primary/20",
            accentColor === "emerald" &&
              "bg-emerald-500/10 border-emerald-500/20",
            accentColor === "amber" && "bg-amber-500/10 border-amber-500/20",
            accentColor === "blue" && "bg-blue-500/10 border-blue-500/20",
            !accentColor && "bg-zinc-500/10 border-zinc-500/20",
          )}
        >
          <Icon
            className={cn(
              "size-4",
              accentColor === "indigo" && "text-primary",
              accentColor === "emerald" && "text-emerald-400",
              accentColor === "amber" && "text-amber-400",
              accentColor === "blue" && "text-blue-400",
              !accentColor && "text-zinc-500",
            )}
          />
        </div>
      )}
      <div>
        <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          {title}
        </div>
        <div className="text-lg font-semibold text-foreground">
          <SlidingNumber value={value} />
        </div>
      </div>
    </div>
  );
};

KpiCard.displayName = "KpiCard";

export { KpiCard, type KpiCardProps };
