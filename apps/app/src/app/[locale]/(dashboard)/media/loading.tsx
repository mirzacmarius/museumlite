export default function MediaLoading() {
  return (
    <div className="flex h-full w-full flex-col bg-background">
      <div className="flex h-full flex-col p-6">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <div className="h-5 w-24 animate-pulse rounded bg-muted/60" />
            <div className="mt-1 h-4 w-48 animate-pulse rounded bg-muted/40" />
          </div>
          <div className="flex items-center gap-6">
            {Array.from({ length: 3 }, (_, i) => `media-stat-${i}`).map(
              (key) => (
                <div key={key} className="flex items-center gap-2">
                  <div className="h-4 w-4 animate-pulse rounded bg-muted/50" />
                  <div className="flex flex-col gap-1">
                    <div className="h-3 w-12 animate-pulse rounded bg-muted/40" />
                    <div className="h-4 w-16 animate-pulse rounded bg-muted/60" />
                  </div>
                </div>
              ),
            )}
          </div>
        </div>

        <div className="mb-4 flex items-center gap-4">
          <div className="h-10 flex-1 animate-pulse rounded-lg bg-muted/60" />
          <div className="h-10 w-36 animate-pulse rounded-lg bg-muted/60" />
        </div>

        <div className="mb-4 flex gap-2">
          {Array.from({ length: 4 }, (_, i) => `media-filter-${i}`).map(
            (key) => (
              <div
                key={key}
                className="h-7 w-20 animate-pulse rounded-full border border-border bg-muted/40"
              />
            ),
          )}
        </div>

        <div className="flex-1 overflow-hidden rounded-lg border border-border bg-muted/20">
          <div className="grid grid-cols-2 gap-2 p-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {Array.from({ length: 24 }, (_, i) => `media-tile-${i}`).map(
              (key) => (
                <div
                  key={key}
                  className="aspect-square animate-pulse rounded-lg border border-border bg-muted/40"
                />
              ),
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
