"use client";

export default function ActivitySettingsLoading() {
  return (
    <div className="flex size-full flex-col gap-6">
      <div className="flex w-full flex-col gap-2">
        <div className="h-7 w-32 rounded bg-muted/60" />
        <div className="h-4 w-64 rounded bg-muted/40" />
      </div>

      <div className="rounded-lg border border-border bg-card p-4">
        <div className="mb-4 flex items-center gap-2">
          <div className="size-4 rounded bg-muted/50" />
          <div className="h-4 w-16 rounded bg-muted/60" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          {Array.from({ length: 5 }, (_, i) => `activity-filter-${i}`).map(
            (key) => (
              <div key={key} className="space-y-2">
                <div className="h-3 w-16 rounded bg-muted/40" />
                <div className="h-9 w-full rounded-lg bg-muted/50" />
              </div>
            ),
          )}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="h-4 w-32 rounded bg-muted/40" />
      </div>

      <div className="flex-1 space-y-2">
        {Array.from({ length: 8 }, (_, i) => `activity-row-${i}`).map((key) => (
          <div
            key={key}
            className="flex items-start gap-4 rounded-lg border border-border bg-card p-4"
          >
            <div className="size-9 rounded-full bg-muted/50" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <div className="h-4 w-24 rounded bg-muted/60" />
                <div className="h-4 w-16 rounded bg-muted/40" />
              </div>
              <div className="mt-1 flex items-center gap-2">
                <div className="h-5 w-16 rounded bg-secondary" />
                <div className="h-3 w-32 rounded bg-muted/30" />
              </div>
            </div>
            <div className="h-3 w-20 rounded bg-muted/30" />
          </div>
        ))}
      </div>
    </div>
  );
}
