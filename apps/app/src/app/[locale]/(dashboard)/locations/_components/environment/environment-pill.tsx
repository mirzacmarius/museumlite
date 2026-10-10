import { cn } from "@v1/ui/utils";
import type { ReactNode } from "react";

export type EnvironmentTone = "danger" | "warning" | "ok" | "neutral";

const TONES: Record<EnvironmentTone, string> = {
  danger: "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300",
  warning:
    "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  ok: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  neutral:
    "border-border bg-muted/40 text-muted-foreground dark:border-white/10",
};

/** A small status label in the location page's badge style. */
export function EnvironmentPill({
  tone,
  children,
}: {
  tone: EnvironmentTone;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded border px-2 py-0.5 text-[11px] font-medium",
        TONES[tone],
      )}
    >
      <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
      {children}
    </span>
  );
}
