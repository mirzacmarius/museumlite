"use client";

export default function UsersSettingsLoading() {
  return (
    <div className="flex w-full flex-col gap-6">
      <div className="flex w-full flex-col gap-2">
        <div className="h-7 w-32 animate-pulse rounded bg-muted/60" />
        <div className="h-4 w-64 animate-pulse rounded bg-muted/40" />
      </div>

      <div className="flex w-full items-center justify-between">
        <div>
          <div className="h-5 w-16 animate-pulse rounded bg-muted/60" />
          <div className="mt-1 h-4 w-24 animate-pulse rounded bg-muted/40" />
        </div>
        <div className="h-10 w-28 animate-pulse rounded-lg bg-muted/60" />
      </div>

      <div className="rounded-lg border border-border bg-card">
        <div className="divide-y divide-border">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center justify-between p-4">
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 animate-pulse rounded-full bg-muted/50" />
                <div>
                  <div className="h-4 w-32 animate-pulse rounded bg-muted/60" />
                  <div className="mt-1 h-3 w-48 animate-pulse rounded bg-muted/40" />
                  <div className="mt-1 h-3 w-24 animate-pulse rounded bg-muted/30" />
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="h-10 w-40 animate-pulse rounded-lg bg-muted/40" />
                <div className="h-8 w-8 animate-pulse rounded bg-muted/30" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
