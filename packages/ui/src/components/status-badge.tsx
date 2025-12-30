import { type VariantProps, cva } from "class-variance-authority";
import type { LucideIcon } from "lucide-react";
import type * as React from "react";
import { cn } from "../utils";

const statusBadgeTones = {
  amber: {
    badge: "border-amber-500/30",
    icon: "text-amber-400",
    text: "text-amber-200",
  },
  rose: {
    badge: "border-rose-500/30",
    icon: "text-rose-400",
    text: "text-rose-200",
  },
  cyan: {
    badge: "border-cyan-500/30",
    icon: "text-cyan-400",
    text: "text-cyan-200",
  },
  purple: {
    badge: "border-purple-500/30",
    icon: "text-purple-400",
    text: "text-purple-200",
  },
  indigo: {
    badge: "border-indigo-500/30",
    icon: "text-indigo-400",
    text: "text-indigo-200",
  },
  blue: {
    badge: "border-blue-500/30",
    icon: "text-blue-400",
    text: "text-blue-200",
  },
  emerald: {
    badge: "border-emerald-500/30",
    icon: "text-emerald-400",
    text: "text-emerald-200",
  },
  zinc: {
    badge: "border-zinc-700",
    icon: "text-zinc-400",
    text: "text-zinc-400",
  },
} as const;

type StatusBadgeTone = keyof typeof statusBadgeTones;

const statusBadgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-md border bg-zinc-950/90 px-2 py-1 shadow-sm backdrop-blur-md",
  {
    variants: {
      tone: {
        amber: statusBadgeTones.amber.badge,
        rose: statusBadgeTones.rose.badge,
        cyan: statusBadgeTones.cyan.badge,
        purple: statusBadgeTones.purple.badge,
        indigo: statusBadgeTones.indigo.badge,
        blue: statusBadgeTones.blue.badge,
        emerald: statusBadgeTones.emerald.badge,
        zinc: statusBadgeTones.zinc.badge,
      },
    },
    defaultVariants: {
      tone: "zinc",
    },
  },
);

interface StatusBadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof statusBadgeVariants> {
  icon?: LucideIcon;
  label: string;
}

function StatusBadge({
  className,
  tone = "zinc",
  icon: Icon,
  label,
  ...props
}: StatusBadgeProps) {
  const toneStyles = statusBadgeTones[tone ?? "zinc"];

  return (
    <div className={cn(statusBadgeVariants({ tone }), className)} {...props}>
      {Icon && <Icon className={cn("h-3 w-3", toneStyles.icon)} />}
      <span className={cn("text-[10px] font-medium", toneStyles.text)}>
        {label}
      </span>
    </div>
  );
}

export { StatusBadge, statusBadgeVariants, statusBadgeTones };
export type { StatusBadgeProps, StatusBadgeTone };
