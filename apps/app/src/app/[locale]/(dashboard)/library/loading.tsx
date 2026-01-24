"use client";

import { SkeletonStats } from "@v1/ui/skeleton-variants";

export default function LibraryDashboardLoading() {
  return (
    <div className="flex h-full w-full bg-background px-6">
      <div className="z-10 mx-auto flex h-full w-full max-w-screen-xl gap-6 flex-col py-6">
        <div className="flex w-full flex-col rounded-lg border border-border bg-card p-6">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 animate-pulse rounded-lg bg-muted/60" />
            <div className="flex flex-col gap-2">
              <div className="h-7 w-40 animate-pulse rounded bg-muted/60" />
              <div className="h-4 w-64 animate-pulse rounded bg-muted/40" />
            </div>
          </div>
        </div>

        <SkeletonStats count={4} />

        <div className="flex w-full flex-col rounded-lg border border-border bg-card">
          <div className="border-b border-border p-6">
            <div className="h-6 w-32 animate-pulse rounded bg-muted/60" />
            <div className="mt-2 h-4 w-56 animate-pulse rounded bg-muted/40" />
          </div>
          <div className="grid grid-cols-1 gap-4 p-6 sm:grid-cols-2 lg:grid-cols-3">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="flex items-start gap-4 rounded-lg border border-border p-4"
              >
                <div className="h-10 w-10 animate-pulse rounded-lg bg-muted/60" />
                <div className="flex-1">
                  <div className="h-4 w-24 animate-pulse rounded bg-muted/60" />
                  <div className="mt-2 h-3 w-32 animate-pulse rounded bg-muted/40" />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex w-full flex-col rounded-lg border border-border bg-card">
          <div className="border-b border-border p-6">
            <div className="h-6 w-28 animate-pulse rounded bg-muted/60" />
            <div className="mt-2 h-4 w-48 animate-pulse rounded bg-muted/40" />
          </div>
          <div className="grid grid-cols-1 gap-4 p-6 sm:grid-cols-2 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <div key={i}>
                <div className="h-3 w-24 animate-pulse rounded bg-muted/40" />
                <div className="mt-2 h-5 w-16 animate-pulse rounded bg-muted/60" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
