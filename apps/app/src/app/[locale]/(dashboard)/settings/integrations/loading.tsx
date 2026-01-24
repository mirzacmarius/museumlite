"use client";

export default function IntegrationsSettingsLoading() {
  return (
    <div className="flex h-full w-full flex-col gap-6">
      <div className="flex w-full flex-col items-start rounded-lg border border-border bg-card">
        <div className="flex w-full flex-col gap-2 p-6">
          <div className="h-7 w-32 animate-pulse rounded bg-muted/60" />
          <div className="h-4 w-80 animate-pulse rounded bg-muted/40" />
        </div>
      </div>

      <div className="flex w-full flex-col gap-4">
        {[...Array(2)].map((_, i) => (
          <div
            key={i}
            className="flex w-full flex-col rounded-lg border border-border bg-card"
          >
            <div className="flex w-full items-start justify-between p-6">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 animate-pulse items-center justify-center rounded-lg bg-primary/5" />
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <div className="h-5 w-32 animate-pulse rounded bg-muted/60" />
                  </div>
                  <div className="h-4 w-64 animate-pulse rounded bg-muted/40" />
                  <div className="mt-1 h-3 w-40 animate-pulse rounded bg-muted/30" />
                </div>
              </div>
              <div className="h-6 w-11 animate-pulse rounded-full bg-muted/50" />
            </div>

            <div className="border-t border-border px-6 py-4">
              <div className="mb-3 h-4 w-32 animate-pulse rounded bg-muted/50" />
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {[...Array(4)].map((_, j) => (
                  <div key={j} className="flex items-center gap-2">
                    <div className="h-4 w-4 animate-pulse rounded bg-muted/40" />
                    <div className="h-4 w-40 animate-pulse rounded bg-muted/40" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
