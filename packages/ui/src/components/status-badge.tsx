import { type VariantProps, cva } from "class-variance-authority";
import type { LucideIcon } from "lucide-react";
import type * as React from "react";

import { cn } from "../utils";

const statusBadgeVariants = cva(
  "inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-medium backdrop-blur-md shadow-sm",
  {
    variants: {
      variant: {
        amber: "bg-zinc-950/90 border border-amber-500/30 text-amber-200",
        rose: "bg-zinc-950/90 border border-rose-500/30 text-rose-200",
        cyan: "bg-zinc-950/90 border border-cyan-500/30 text-cyan-200",
        purple: "bg-zinc-950/90 border border-purple-500/30 text-purple-200",
        emerald: "bg-zinc-950/90 border border-emerald-500/30 text-emerald-200",
        indigo: "bg-zinc-950/90 border border-indigo-500/30 text-indigo-200",
        blue: "bg-zinc-950/90 border border-blue-500/30 text-blue-200",
        zinc: "bg-zinc-950/90 border border-zinc-700 text-zinc-400",
      },
    },
    defaultVariants: {
      variant: "zinc",
    },
  },
);

const iconColorMap = {
  amber: "text-amber-400",
  rose: "text-rose-400",
  cyan: "text-cyan-400",
  purple: "text-purple-400",
  emerald: "text-emerald-400",
  indigo: "text-indigo-400",
  blue: "text-blue-400",
  zinc: "text-zinc-400",
} as const;

export interface StatusBadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof statusBadgeVariants> {
  icon?: LucideIcon;
}

function StatusBadge({
  className,
  variant = "zinc",
  icon: Icon,
  children,
  ...props
}: StatusBadgeProps) {
  return (
    <div className={cn(statusBadgeVariants({ variant }), className)} {...props}>
      {Icon && (
        <Icon className={cn("h-3 w-3", iconColorMap[variant ?? "zinc"])} />
      )}
      <span>{children}</span>
    </div>
  );
}

export { StatusBadge, statusBadgeVariants };
