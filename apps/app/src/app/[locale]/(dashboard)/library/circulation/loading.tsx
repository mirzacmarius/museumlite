"use client";

import { SkeletonList } from "@v1/ui/skeleton-variants";

export default function LibraryCirculationLoading() {
  return (
    <div className="flex size-full bg-background px-6">
      <div className="z-10 mx-auto flex size-full max-w-screen-xl flex-col gap-6 py-6">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {Array.from({ length: 6 }, (_, i) => `circulation-stat-${i}`).map(
            (key) => (
              <div
                key={key}
                className="rounded-lg border border-border bg-card p-4"
              >
                <div className="flex items-center gap-2">
                  <div className="size-4 rounded bg-muted/50" />
                  <div className="h-4 w-16 rounded bg-muted/50" />
                </div>
                <div className="mt-2 h-8 w-12 rounded bg-muted/60" />
              </div>
            ),
          )}
        </div>

        <div className="flex w-full flex-col rounded-lg border border-border bg-card">
          <div className="flex w-full items-center justify-between rounded-lg p-6">
            <div className="flex flex-col gap-2">
              <div className="h-7 w-32 rounded bg-muted/60" />
              <div className="h-4 w-64 rounded bg-muted/40" />
            </div>
          </div>
          <div className="flex w-full px-6">
            <div className="w-full border-b border-border" />
          </div>

          <div className="border-b border-border px-6 py-4">
            <div className="mb-2 h-4 w-32 rounded bg-muted/50" />
            <div className="flex gap-2">
              <div className="h-10 flex-1 rounded-lg bg-muted/60" />
              <div className="h-10 w-24 rounded-lg bg-muted/60" />
            </div>
          </div>

          <div className="p-6">
            <div className="flex gap-2 mb-4">
              <div className="h-9 w-32 rounded-lg bg-muted/60" />
              <div className="h-9 w-40 rounded-lg bg-muted/40" />
            </div>
            <SkeletonList count={4} />
          </div>
        </div>
      </div>
    </div>
  );
}
