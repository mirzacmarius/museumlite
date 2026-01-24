"use client";

export default function ModulesSettingsLoading() {
  return (
    <div className="flex h-full w-full flex-col gap-6">
      {/* Header Card */}
      <div className="flex w-full flex-col items-start rounded-lg border border-border bg-card">
        <div className="flex w-full flex-col gap-2 p-6">
          <div className="h-7 w-32 animate-pulse rounded bg-muted/60" />
          <div className="h-4 w-96 animate-pulse rounded bg-muted/40" />
        </div>
      </div>

      {/* Modules List */}
      <div className="flex w-full flex-col gap-4">
        {[...Array(7)].map((_, i) => (
          <div
            key={i}
            className="flex w-full flex-col rounded-lg border border-border bg-card"
          >
            <div className="flex w-full items-start justify-between p-6">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 animate-pulse items-center justify-center rounded-lg bg-primary/5" />
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <div className="h-5 w-28 animate-pulse rounded bg-muted/60" />
                  </div>
                  <div className="h-4 w-72 animate-pulse rounded bg-muted/40" />
                </div>
              </div>
              <div className="h-6 w-11 animate-pulse rounded-full bg-muted/50" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
