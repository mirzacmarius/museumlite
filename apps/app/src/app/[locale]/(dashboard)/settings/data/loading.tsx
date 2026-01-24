"use client";

export default function DataSettingsLoading() {
  return (
    <div className="flex h-full w-full flex-col gap-6">
      {/* Header */}
      <div className="flex w-full flex-col gap-2">
        <div className="h-7 w-40 animate-pulse rounded bg-muted/60" />
        <div className="h-4 w-80 animate-pulse rounded bg-muted/40" />
      </div>

      {/* Tabs */}
      <div className="w-full">
        <div className="grid w-full grid-cols-2 rounded-lg bg-muted/30 p-1">
          <div className="h-9 animate-pulse rounded-md bg-muted/60" />
          <div className="h-9 animate-pulse rounded-md bg-muted/40" />
        </div>

        {/* Tab Content - Import */}
        <div className="mt-6 space-y-6">
          {/* CSV Import Card */}
          <div className="rounded-xl border border-border bg-card">
            <div className="p-6">
              <div className="flex items-center gap-2">
                <div className="h-5 w-5 animate-pulse rounded bg-muted/50" />
                <div className="h-6 w-28 animate-pulse rounded bg-muted/60" />
              </div>
              <div className="mt-2 h-4 w-96 animate-pulse rounded bg-muted/40" />
            </div>
            <div className="space-y-4 px-6 pb-6">
              <div className="flex items-center gap-4">
                <div className="h-10 w-48 animate-pulse rounded-lg bg-muted/50" />
                <div className="h-10 w-40 animate-pulse rounded-lg bg-muted/50" />
              </div>

              {/* Template Info */}
              <div className="rounded-lg border bg-muted/20 p-4">
                <div className="h-4 w-full animate-pulse rounded bg-muted/40" />
                <div className="mt-2 h-4 w-64 animate-pulse rounded bg-muted/30" />
              </div>

              <div className="flex items-center gap-4">
                <div className="h-10 w-32 animate-pulse rounded-lg bg-muted/60" />
              </div>
            </div>
          </div>

          {/* Recent Import Jobs Card */}
          <div className="rounded-xl border border-border bg-card">
            <div className="p-6">
              <div className="h-6 w-40 animate-pulse rounded bg-muted/60" />
            </div>
            <div className="space-y-4 px-6 pb-6">
              {[...Array(2)].map((_, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-lg border p-4"
                >
                  <div className="flex items-center gap-4">
                    <div className="h-5 w-5 animate-pulse rounded-full bg-muted/50" />
                    <div>
                      <div className="h-4 w-24 animate-pulse rounded bg-muted/60" />
                      <div className="mt-1 h-3 w-32 animate-pulse rounded bg-muted/40" />
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="h-2 w-32 animate-pulse rounded-full bg-muted/40" />
                    <div className="h-6 w-20 animate-pulse rounded-full bg-muted/50" />
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
