"use client";

import { SkeletonTimeline } from "@v1/ui/skeleton-variants";

export default function ActivityLoading() {
  return (
    <div className="flex h-full w-full bg-background px-6 py-8">
      <div className="z-10 mx-auto flex h-full w-full max-w-screen-xl gap-12">
        <div className="flex w-64 flex-shrink-0 flex-col space-y-6">
          <div className="space-y-4">
            <div className="h-5 w-20 animate-pulse rounded bg-muted/60" />

            <div className="space-y-2">
              <div className="h-4 w-24 animate-pulse rounded bg-muted/50" />
              <div className="h-10 w-full animate-pulse rounded-lg bg-muted/40" />
            </div>

            <div className="space-y-2">
              <div className="h-4 w-20 animate-pulse rounded bg-muted/50" />
              <div className="h-10 w-full animate-pulse rounded-lg bg-muted/40" />
              <div className="h-10 w-full animate-pulse rounded-lg bg-muted/40" />
            </div>

            <div className="h-9 w-full animate-pulse rounded-lg bg-muted/30" />
          </div>
        </div>

        <div className="flex flex-1 flex-col">
          <div className="mb-6 flex items-center justify-between">
            <div className="flex flex-col gap-2">
              <div className="h-6 w-28 animate-pulse rounded bg-muted/60" />
              <div className="h-4 w-48 animate-pulse rounded bg-muted/40" />
            </div>
            <div className="h-9 w-24 animate-pulse rounded-lg bg-muted/50" />
          </div>

          <SkeletonTimeline count={8} />
        </div>
      </div>
    </div>
  );
}
