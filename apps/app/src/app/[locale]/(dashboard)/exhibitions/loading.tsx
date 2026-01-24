"use client";

import { SkeletonList } from "@v1/ui/skeleton-variants";

export default function ExhibitionsLoading() {
  return (
    <div className="flex h-full w-full bg-background px-6">
      <div className="z-10 mx-auto flex h-full w-full max-w-screen-xl gap-12">
        <div className="flex w-full flex-col rounded-lg border border-border bg-muted/20">
          <div className="flex w-full items-center justify-between rounded-lg p-6">
            <div className="flex flex-col gap-2">
              <div className="h-6 w-28 animate-pulse rounded bg-muted/60" />
              <div className="h-4 w-64 animate-pulse rounded bg-muted/40" />
            </div>
            <div className="h-10 w-36 animate-pulse rounded-lg bg-muted/60" />
          </div>

          <div className="flex w-full px-6">
            <div className="w-full border-b border-border" />
          </div>

          <div className="border-b border-border px-6 py-4">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <div className="h-10 w-full animate-pulse rounded-lg bg-muted/50" />
              </div>
              <div className="h-10 w-24 animate-pulse rounded-lg bg-muted/50" />
              <div className="h-10 w-28 animate-pulse rounded-lg bg-muted/50" />
            </div>
          </div>

          <div className="p-6">
            <SkeletonList count={6} variant="grid" />
          </div>
        </div>
      </div>
    </div>
  );
}
