"use client";

import { SkeletonList } from "@v1/ui/skeleton-variants";

export default function AssignmentsLoading() {
  return (
    <div className="flex h-full w-full flex-col bg-background">
      <header className="h-14 border-b border-border flex items-center justify-between px-6 bg-background/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="h-5 w-5 animate-pulse rounded bg-muted/60" />
          <div className="h-5 w-32 animate-pulse rounded bg-muted/60" />
        </div>
        <div className="flex items-center gap-6">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="h-6 w-6 animate-pulse rounded-full bg-muted/40" />
              <div className="h-3 w-16 animate-pulse rounded bg-muted/40" />
            </div>
          ))}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-screen-xl space-y-8">
          <section>
            <div className="mb-4 flex items-center gap-2">
              <div className="h-4 w-4 animate-pulse rounded bg-muted/50" />
              <div className="h-4 w-36 animate-pulse rounded bg-muted/50" />
              <div className="h-5 w-6 animate-pulse rounded-full bg-muted/40" />
            </div>
            <SkeletonList count={4} variant="grid" />
          </section>

          <section>
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 animate-pulse rounded bg-muted/50" />
                <div className="h-4 w-36 animate-pulse rounded bg-muted/50" />
              </div>
              <div className="h-3 w-24 animate-pulse rounded bg-muted/30" />
            </div>
            <SkeletonList count={4} variant="grid" />
          </section>

          <section>
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 animate-pulse rounded bg-muted/50" />
                <div className="h-4 w-28 animate-pulse rounded bg-muted/50" />
                <div className="h-3 w-12 animate-pulse rounded bg-muted/30" />
              </div>
              <div className="h-3 w-24 animate-pulse rounded bg-muted/30" />
            </div>
            <SkeletonList count={4} variant="grid" />
          </section>
        </div>
      </div>
    </div>
  );
}
