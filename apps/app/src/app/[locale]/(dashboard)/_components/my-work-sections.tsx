"use client";

import type { ReactNode } from "react";

export const CARD_GRID_CLASS_NAME =
  "grid grid-cols-[repeat(auto-fill,minmax(15rem,1fr))] gap-2";

export const CARD_CLASS_NAME =
  "flex h-full min-w-0 items-start gap-2.5 rounded-lg border border-border bg-card px-3 py-2.5 transition-colors hover:bg-muted/50";

export function WorkSection({
  icon,
  title,
  badge,
  action,
  children,
}: {
  icon: ReactNode;
  title: string;
  badge?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="min-w-0 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          {icon}
          <h2 className="truncate text-sm font-medium uppercase tracking-widest text-muted-foreground">
            {title}
          </h2>
          {badge}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
