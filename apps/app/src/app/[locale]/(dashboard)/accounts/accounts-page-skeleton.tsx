"use client";

import { cn } from "@v1/ui/utils";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

const ACCOUNT_GRID =
  "md:grid-cols-[minmax(0,1.4fr)_minmax(0,0.7fr)_minmax(0,1fr)_auto]";
const PATRON_GRID =
  "md:grid-cols-[minmax(0,1.3fr)_minmax(0,0.7fr)_minmax(0,1.1fr)_auto_auto]";

function range(count: number) {
  return Array.from({ length: count }, (_, index) => index);
}

function AccountsListSkeleton({
  isPatronView,
  rowCount = 8,
}: {
  isPatronView: boolean;
  rowCount?: number;
}) {
  const gridClass = isPatronView ? PATRON_GRID : ACCOUNT_GRID;
  const columnCount = isPatronView ? 4 : 3;

  return (
    <div className="overflow-hidden rounded-xl border border-border/60 dark:border-white/10 dark:bg-zinc-900/40">
      <div className="flex items-center justify-between gap-3 border-b border-border/60 px-4 py-2.5 dark:border-white/10">
        <div className="h-2.5 w-16 rounded bg-muted/60" />
        <div className="h-2.5 w-6 rounded bg-muted/40" />
      </div>

      <div
        className={cn(
          "hidden gap-4 border-b border-border/60 px-4 py-2 md:grid dark:border-white/10",
          gridClass,
        )}
      >
        {range(columnCount).map((key) => (
          <div key={key} className="h-2.5 w-14 rounded bg-muted/50" />
        ))}
        <div className="h-2.5 w-4 justify-self-end rounded bg-muted/40" />
      </div>

      <div className="divide-y divide-border/60 dark:divide-white/10">
        {range(rowCount).map((key) => (
          <div
            key={key}
            className={cn(
              "grid items-center gap-3 px-4 py-3.5 md:gap-4",
              gridClass,
            )}
          >
            <div className="flex min-w-0 items-center gap-3">
              <div className="size-9 shrink-0 rounded-md bg-muted/60" />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="h-3.5 w-36 max-w-full rounded bg-muted/70" />
                <div className="h-2.5 w-24 rounded bg-muted/40 md:hidden" />
              </div>
            </div>
            <div className="hidden h-3 w-24 rounded bg-muted/50 md:block" />
            <div className="hidden space-y-1.5 md:block">
              <div className="h-3 w-44 max-w-full rounded bg-muted/50" />
              <div className="h-2.5 w-28 rounded bg-muted/40" />
            </div>
            {isPatronView ? (
              <div className="h-5 w-16 rounded border border-border/60 bg-muted/40 dark:border-white/10" />
            ) : (
              <div className="h-5 w-16 rounded border border-border/60 bg-muted/40 md:hidden dark:border-white/10" />
            )}
            <div className="ml-auto hidden size-3.5 rounded bg-muted/40 md:block" />
          </div>
        ))}
      </div>
    </div>
  );
}

function AccountsPageSkeletonContent({
  isPatronView,
}: {
  isPatronView: boolean;
}) {
  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-y-auto bg-background p-4 sm:p-6">
      <section className="border-b border-border/60 pb-6 dark:border-white/10">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <div className="h-6 w-40 rounded bg-muted/70" />
            <div className="h-4 w-72 max-w-full rounded bg-muted/50" />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="h-8 w-28 rounded-md bg-muted/50" />
            <div className="h-8 w-28 rounded-md bg-muted/50" />
            <div className="h-8 w-28 rounded-md bg-muted/60" />
          </div>
        </div>
      </section>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="h-9 min-w-0 flex-1 rounded-md border border-border/60 bg-muted/40 sm:max-w-md dark:border-white/10" />
        {!isPatronView ? (
          <div className="h-9 w-full rounded-md border border-border/60 bg-muted/40 sm:w-[180px] dark:border-white/10" />
        ) : null}
      </div>

      <div className="mt-5 min-h-0 flex-1">
        <AccountsListSkeleton isPatronView={isPatronView} />
      </div>
    </div>
  );
}

function AccountsPageSkeletonFromSearchParams() {
  const searchParams = useSearchParams();
  const isPatronView = searchParams.get("type") === "patron";
  return <AccountsPageSkeletonContent isPatronView={isPatronView} />;
}

export function AccountsPageSkeleton({
  isPatronView,
}: {
  isPatronView?: boolean;
} = {}) {
  if (isPatronView !== undefined)
    return <AccountsPageSkeletonContent isPatronView={isPatronView} />;

  return (
    <Suspense fallback={<AccountsPageSkeletonContent isPatronView={false} />}>
      <AccountsPageSkeletonFromSearchParams />
    </Suspense>
  );
}

export { AccountsListSkeleton };
