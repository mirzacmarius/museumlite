"use client";

import { SkeletonTable } from "@v1/ui/skeleton-variants";

export default function LocationsLoading() {
  return (
    <div className="flex h-full w-full flex-col bg-background px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex flex-col gap-2">
          <div className="h-7 w-32 animate-pulse rounded bg-muted/60" />
          <div className="h-4 w-64 animate-pulse rounded bg-muted/40" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-10 w-32 animate-pulse rounded-lg bg-muted/60" />
        </div>
      </div>

      <div className="mb-4 flex items-center gap-2">
        <div className="relative flex-1">
          <div className="h-10 w-full animate-pulse rounded-lg bg-muted/60" />
        </div>
      </div>

      <SkeletonTable className="flex-1" />
    </div>
  );
}
