"use client";

export default function ActivitySettingsLoading() {
  return (
    <div className="flex h-full w-full flex-col gap-6">
      <div className="flex w-full flex-col gap-2">
        <div className="h-7 w-32 animate-pulse rounded bg-muted/60" />
        <div className="h-4 w-64 animate-pulse rounded bg-muted/40" />
      </div>

      <div className="rounded-lg border border-border bg-card p-4">
        <div className="mb-4 flex items-center gap-2">
          <div className="h-4 w-4 animate-pulse rounded bg-muted/50" />
          <div className="h-4 w-16 animate-pulse rounded bg-muted/60" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="h-3 w-16 animate-pulse rounded bg-muted/40" />
              <div className="h-9 w-full animate-pulse rounded-lg bg-muted/50" />
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="h-4 w-32 animate-pulse rounded bg-muted/40" />
      </div>

      <div className="flex-1 space-y-2">
        {[...Array(8)].map((_, i) => (
          <div
            key={i}
            className="flex items-start gap-4 rounded-lg border border-border bg-card p-4"
          >
            <div className="h-9 w-9 animate-pulse rounded-full bg-muted/50" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <div className="h-4 w-24 animate-pulse rounded bg-muted/60" />
                <div className="h-4 w-16 animate-pulse rounded bg-muted/40" />
              </div>
              <div className="mt-1 flex items-center gap-2">
                <div className="h-5 w-16 animate-pulse rounded bg-secondary" />
                <div className="h-3 w-32 animate-pulse rounded bg-muted/30" />
              </div>
            </div>
            <div className="h-3 w-20 animate-pulse rounded bg-muted/30" />
          </div>
        ))}
      </div>
    </div>
  );
}
