import * as React from "react";
import { cn } from "../utils";

export type Status = "pending" | "active" | "completed" | "overdue" | "draft";
export type StatusSize = "sm" | "md";
export type StatusVariant = "solid" | "outline";

export interface StatusBadgeProps
  extends React.HTMLAttributes<HTMLSpanElement> {
  status: Status;
  size?: StatusSize;
  variant?: StatusVariant;
  showDot?: boolean;
}

const statusConfig: Record<
  Status,
  {
    solid: string;
    outline: string;
    dot: string;
  }
> = {
  pending: {
    solid:
      "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
    outline: "border-amber-500 text-amber-600 dark:text-amber-400",
    dot: "bg-amber-500",
  },
  active: {
    solid:
      "bg-emerald-500/10 text-emerald-500 dark:text-emerald-400 border-emerald-500/20",
    outline: "border-emerald-500 text-emerald-500 dark:text-emerald-400",
    dot: "bg-emerald-500",
  },
  completed: {
    solid: "bg-primary/10 text-primary dark:text-primary border-primary/20",
    outline: "border-primary text-primary dark:text-primary",
    dot: "bg-primary",
  },
  overdue: {
    solid: "bg-rose-500/10 text-rose-500 dark:text-rose-400 border-rose-500/20",
    outline: "border-rose-500 text-rose-500 dark:text-rose-400",
    dot: "bg-rose-500",
  },
  draft: {
    solid: "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20",
    outline: "border-zinc-500 text-zinc-600 dark:text-zinc-400",
    dot: "bg-zinc-500",
  },
};

const sizeConfig: Record<StatusSize, string> = {
  sm: "text-[10px] px-1.5 py-0.5",
  md: "text-xs px-2 py-1",
};

const StatusBadge = React.forwardRef<HTMLSpanElement, StatusBadgeProps>(
  (
    {
      status,
      size = "md",
      variant = "solid",
      showDot = false,
      className,
      children,
      ...props
    },
    ref,
  ) => {
    const config = statusConfig[status];

    return (
      <span
        ref={ref}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full font-medium border transition-colors",
          sizeConfig[size],
          variant === "solid" && config.solid,
          variant === "outline" && cn("bg-transparent", config.outline),
          className,
        )}
        {...props}
      >
        {showDot && (
          <span className={cn("size-1.5 rounded-full", config.dot)} />
        )}
        {children}
      </span>
    );
  },
);

StatusBadge.displayName = "StatusBadge";

export { StatusBadge };
