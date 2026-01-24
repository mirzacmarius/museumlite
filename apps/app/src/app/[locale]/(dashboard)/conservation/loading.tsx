"use client";

export default function ConservationLoading() {
  return (
    <div className="flex h-full w-full bg-background px-6">
      <div className="z-10 mx-auto flex h-full w-full max-w-screen-xl gap-12">
        <div className="flex w-full flex-col rounded-lg border border-border bg-muted/20">
          <div className="flex w-full items-center justify-between rounded-lg p-6">
            <div className="flex flex-col gap-2">
              <div className="h-7 w-32 animate-pulse rounded bg-muted/60" />
              <div className="h-4 w-64 animate-pulse rounded bg-muted/40" />
            </div>
            <div className="h-10 w-36 animate-pulse rounded-lg bg-muted/60" />
          </div>
          <div className="flex w-full px-6">
            <div className="w-full border-b border-border" />
          </div>

          <div className="border-b border-border px-6 py-4">
            <div className="h-10 w-full animate-pulse rounded-lg bg-muted/50" />
          </div>

          <div className="grid grid-cols-1 gap-4 p-6 md:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="flex flex-col justify-between rounded-xl border border-border bg-card p-5"
              >
                <div className="space-y-4">
                  <div className="h-5 w-20 animate-pulse rounded-full bg-muted/40" />
                  <div>
                    <div className="h-5 w-48 animate-pulse rounded bg-muted/60" />
                    <div className="mt-2 h-4 w-full animate-pulse rounded bg-muted/40" />
                  </div>
                  <div className="flex flex-col gap-2 border-t border-border/50 pt-4">
                    <div className="h-3 w-24 animate-pulse rounded bg-muted/40" />
                    <div className="h-3 w-32 animate-pulse rounded bg-muted/40" />
                  </div>
                </div>
                <div className="mt-4 h-8 w-full animate-pulse rounded-lg bg-muted/30" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
