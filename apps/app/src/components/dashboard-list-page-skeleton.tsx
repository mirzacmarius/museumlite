interface DashboardListPageSkeletonProps {
  actionsCount?: number;
  filtersCount?: number;
  gridColumns?: string;
  itemCount?: number;
  layout?: "grid" | "list";
  showStats?: boolean;
}

function skeletonKeys(prefix: string, count: number) {
  return Array.from({ length: count }, (_, index) => `${prefix}-${index}`);
}

export function DashboardListPageSkeleton({
  actionsCount = 2,
  filtersCount = 1,
  gridColumns = "md:grid-cols-2 lg:grid-cols-3",
  itemCount = 6,
  layout = "grid",
  showStats = false,
}: DashboardListPageSkeletonProps) {
  return (
    <div className="flex h-full w-full bg-background px-4 sm:px-6">
      <div className="z-10 mx-auto flex h-full w-full max-w-screen-xl gap-12">
        <div className="flex w-full flex-col rounded-lg border border-border bg-muted/20">
          <div className="flex w-full flex-col justify-between gap-4 rounded-lg p-4 sm:flex-row sm:items-center sm:p-6">
            <div className="flex flex-col gap-2">
              <div className="h-6 w-44 rounded bg-muted/70" />
              <div className="h-4 w-72 max-w-full rounded bg-muted/50" />
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {skeletonKeys("action", actionsCount).map((key) => (
                <div key={key} className="h-9 w-24 rounded-md bg-muted/60" />
              ))}
            </div>
          </div>
          <div className="flex w-full px-4 sm:px-6">
            <div className="w-full border-b border-border" />
          </div>

          <div className="border-b border-border p-4 sm:px-6">
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="h-10 min-w-0 flex-1 rounded-md bg-muted/60" />
              {skeletonKeys("filter", filtersCount).map((key) => (
                <div
                  key={key}
                  className="h-10 w-full rounded-md bg-muted/50 sm:w-36"
                />
              ))}
            </div>
          </div>

          {showStats && <StatsCardsSkeleton />}

          {layout === "grid" ? (
            <GridCardsSkeleton count={itemCount} gridColumns={gridColumns} />
          ) : (
            <ListRowsSkeleton count={itemCount} />
          )}
        </div>
      </div>
    </div>
  );
}

export function StatsCardsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 p-4 pb-0 sm:gap-4 sm:p-6 sm:pb-0 lg:grid-cols-4">
      {skeletonKeys("stat", count).map((key) => (
        <div
          key={key}
          className="h-28 rounded-xl border border-border/60 bg-card"
        />
      ))}
    </div>
  );
}

export function TableRowsSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <div className="grid grid-cols-6 gap-4 border-b border-border bg-muted/30 p-3">
        {skeletonKeys("header", 6).map((key) => (
          <div key={key} className="h-3 rounded bg-muted/60" />
        ))}
      </div>
      <div className="divide-y divide-border">
        {skeletonKeys("table-row", count).map((key) => (
          <div key={key} className="grid grid-cols-6 gap-4 p-3">
            {skeletonKeys(`${key}-cell`, 6).map((cellKey) => (
              <div key={cellKey} className="h-4 rounded bg-muted/40" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function GridCardsSkeleton({
  count = 6,
  gridColumns = "md:grid-cols-2 lg:grid-cols-3",
}: {
  count?: number;
  gridColumns?: string;
}) {
  return (
    <div className={`grid grid-cols-1 gap-4 p-4 sm:p-6 ${gridColumns}`}>
      {skeletonKeys("card", count).map((key) => (
        <div
          key={key}
          className="min-h-32 rounded-lg border border-border bg-card p-4"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-muted/70" />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="h-4 w-3/4 rounded bg-muted/70" />
                <div className="h-3 w-1/2 rounded bg-muted/50" />
              </div>
            </div>
            <div className="h-6 w-14 rounded-full bg-muted/50" />
          </div>
          <div className="mt-5 space-y-2">
            <div className="h-3 w-full rounded bg-muted/40" />
            <div className="h-3 w-2/3 rounded bg-muted/40" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ListRowsSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="space-y-2 p-4 sm:p-6">
      {skeletonKeys("row", count).map((key) => (
        <div
          key={key}
          className="flex items-center justify-between rounded-lg border border-border bg-card p-4"
        >
          <div className="flex min-w-0 flex-1 items-center gap-4">
            <div className="h-10 w-10 rounded-lg bg-muted/70" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="h-4 w-1/3 rounded bg-muted/70" />
              <div className="h-3 w-2/3 rounded bg-muted/50" />
            </div>
          </div>
          <div className="h-6 w-16 rounded-full bg-muted/50" />
        </div>
      ))}
    </div>
  );
}
