import { cn } from "@v1/ui/utils";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";

export interface OverviewPillProps {
  href: string;
  title: string;
  value: string;
  icon: LucideIcon;
  accentClassName: string;
}

/** A count and its label as a compact link on Overview. */
export function OverviewPill({
  href,
  title,
  value,
  icon: Icon,
  accentClassName,
}: OverviewPillProps) {
  return (
    <Link
      href={href}
      className="flex min-w-0 items-center gap-2 rounded-md border border-border bg-card px-2.5 py-1.5 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Icon
        className={cn("size-3.5 shrink-0", accentClassName)}
        aria-hidden="true"
      />
      <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
        {value}
      </span>{" "}
      <span className="truncate text-xs text-muted-foreground">{title}</span>
    </Link>
  );
}
