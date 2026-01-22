"use client";

export default function CollectionsLoading() {
  return (
    <div className="flex h-full w-full bg-background px-6 py-0">
      <div className="z-10 mx-auto flex h-full w-full max-w-screen-xl gap-12">
        <div className="flex w-full flex-col rounded-lg border border-border/60 bg-card">
          <div className="flex w-full items-center justify-between rounded-lg p-6">
            <div className="flex flex-col gap-2">
              <div className="h-7 w-48 animate-pulse rounded bg-muted/60" />
              <div className="h-4 w-72 animate-pulse rounded bg-muted/40" />
            </div>
            <div className="flex items-center gap-2">
              <div className="h-10 w-24 animate-pulse rounded-lg bg-muted/60" />
              <div className="h-10 w-32 animate-pulse rounded-lg bg-muted/60" />
            </div>
          </div>

          <div className="border-t border-border/60 p-6">
            <div className="mb-4 flex items-center gap-2">
              <div className="h-10 flex-1 animate-pulse rounded-lg bg-muted/60" />
            </div>

            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div
                  key={`skeleton-${i}`}
                  className="flex items-center gap-4 rounded-lg border border-border/60 bg-card p-4"
                >
                  <div className="h-16 w-16 animate-pulse rounded bg-muted/60" />
                  <div className="flex-1">
                    <div className="h-5 w-48 animate-pulse rounded bg-muted/60 mb-2" />
                    <div className="h-4 w-32 animate-pulse rounded bg-muted/40" />
                  </div>
                  <div className="h-8 w-8 animate-pulse rounded bg-muted/60" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
