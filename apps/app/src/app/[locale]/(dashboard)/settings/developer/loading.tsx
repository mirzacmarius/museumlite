"use client";

import { SkeletonList } from "@v1/ui/skeleton-variants";

export default function DeveloperSettingsLoading() {
  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div>
        <div className="h-9 w-48 animate-pulse rounded bg-muted/60" />
        <div className="mt-2 h-4 w-80 animate-pulse rounded bg-muted/40" />
      </div>

      {/* Tabs */}
      <div className="w-full">
        <div className="flex gap-1 rounded-lg bg-muted/30 p-1 w-fit">
          <div className="h-9 w-24 animate-pulse rounded-md bg-muted/60" />
          <div className="h-9 w-24 animate-pulse rounded-md bg-muted/40" />
          <div className="h-9 w-24 animate-pulse rounded-md bg-muted/40" />
        </div>

        {/* Tab Content - API Keys */}
        <div className="mt-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="h-6 w-24 animate-pulse rounded bg-muted/60" />
              <div className="mt-1 h-4 w-64 animate-pulse rounded bg-muted/40" />
            </div>
            <div className="h-10 w-32 animate-pulse rounded-lg bg-muted/60" />
          </div>

          {/* API Keys List */}
          <div className="rounded-lg border border-border">
            <div className="divide-y divide-border">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex items-center justify-between p-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <div className="h-4 w-32 animate-pulse rounded bg-muted/60" />
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="h-6 w-24 animate-pulse rounded bg-muted/40" />
                      <div className="h-4 w-32 animate-pulse rounded bg-muted/30" />
                      <div className="h-4 w-28 animate-pulse rounded bg-muted/30" />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-9 w-20 animate-pulse rounded-lg bg-muted/50" />
                    <div className="h-9 w-9 animate-pulse rounded bg-muted/30" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
