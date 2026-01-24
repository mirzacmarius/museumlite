"use client";

export default function LibraryCatalogLoading() {
  return (
    <div className="flex h-full w-full bg-background px-6">
      <div className="z-10 mx-auto flex h-full w-full max-w-screen-xl gap-12">
        <div className="flex w-full flex-col rounded-lg border border-border bg-card">
          <div className="flex w-full items-center justify-between rounded-lg p-6">
            <div className="flex flex-col gap-2">
              <div className="h-7 w-32 animate-pulse rounded bg-muted/60" />
              <div className="h-4 w-64 animate-pulse rounded bg-muted/40" />
            </div>
            <div className="h-10 w-32 animate-pulse rounded-lg bg-muted/60" />
          </div>
          <div className="flex w-full px-6">
            <div className="w-full border-b border-border" />
          </div>

          <div className="space-y-4 border-b border-border px-6 py-4">
            <div className="h-10 w-full animate-pulse rounded-lg bg-muted/60" />
            <div className="flex gap-4">
              <div className="h-4 w-16 animate-pulse rounded bg-muted/40" />
              <div className="h-10 w-40 animate-pulse rounded-lg bg-muted/60" />
              <div className="h-10 w-40 animate-pulse rounded-lg bg-muted/60" />
            </div>
          </div>

          <div className="p-6">
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className="flex items-center gap-4 rounded-lg border border-border p-4"
                >
                  <div className="h-20 w-14 animate-pulse rounded bg-muted/50" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="h-5 w-48 animate-pulse rounded bg-muted/60" />
                      <div className="h-5 w-16 animate-pulse rounded-full bg-muted/40" />
                    </div>
                    <div className="mt-2 h-4 w-32 animate-pulse rounded bg-muted/40" />
                    <div className="mt-2 flex items-center gap-4">
                      <div className="h-3 w-24 animate-pulse rounded bg-muted/30" />
                      <div className="h-3 w-12 animate-pulse rounded bg-muted/30" />
                    </div>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <div className="h-4 w-12 animate-pulse rounded bg-muted/60" />
                    <div className="mt-1 h-3 w-20 animate-pulse rounded bg-muted/40" />
                    <div className="mt-2 h-5 w-14 animate-pulse rounded-full bg-muted/40" />
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
