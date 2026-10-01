const KPI_SKELETON_KEYS = ["objects", "display", "loans", "locations"];
const COLLECTION_GROUP_SKELETON_WIDTHS = [
  "w-28",
  "w-36",
  "w-44",
  "w-32",
  "w-40",
  "w-48",
  "w-24",
  "w-52",
] as const;
const USAGE_SKELETON_KEYS = ["storage", "objects", "exports"];
const WORKFLOW_SKELETON_KEYS = [
  "transfer-approvals",
  "accessions",
  "deaccessions",
  "loans",
];

export function CollectionGroupsGridSkeleton() {
  return (
    <div className="mt-3 flex flex-wrap items-center justify-start gap-1.5">
      {COLLECTION_GROUP_SKELETON_WIDTHS.map((widthClass) => (
        <div
          key={widthClass}
          className={`h-6 max-w-full rounded-md border border-border bg-card ${widthClass}`}
        />
      ))}
    </div>
  );
}

export function DashboardPageSkeleton() {
  return (
    <div className="@container h-full min-h-0 w-full overflow-y-auto bg-background p-4 sm:p-6 custom-scrollbar">
      <div className="flex min-w-0 flex-col gap-5">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-1">
          <div className="max-w-full">
            <div className="h-4 w-64 max-w-full rounded bg-muted/50" />
            <div className="mt-2 h-8 w-72 max-w-full rounded bg-muted/70" />
            <div className="mt-2 h-4 w-80 max-w-full rounded bg-muted/50" />
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="h-8 w-28 rounded-md bg-muted/70" />
            <div className="h-8 w-32 rounded-md bg-muted/50" />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2 rounded-lg border border-border bg-card p-5 @min-[20rem]:grid-cols-2 @min-[44rem]:grid-cols-4">
          {KPI_SKELETON_KEYS.map((key) => (
            <div
              key={key}
              className="flex min-w-0 items-center gap-3 rounded-md border border-border px-3 py-2.5"
            >
              <div className="size-8 shrink-0 rounded-md bg-muted/70" />
              <div className="h-3 min-w-0 flex-1 rounded bg-muted/70" />
              <div className="h-4 w-8 shrink-0 rounded bg-muted/70" />
              <div className="size-3.5 shrink-0 rounded bg-muted/50" />
            </div>
          ))}
        </div>

        <div className="min-w-0 rounded-lg border border-border bg-card p-5">
          <div className="h-4 w-32 rounded bg-muted/70" />
          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 @min-[44rem]:grid-cols-4">
            {WORKFLOW_SKELETON_KEYS.map((key) => (
              <div
                key={key}
                className="flex items-center gap-3 rounded-md border border-border px-3 py-2.5"
              >
                <div className="size-8 shrink-0 rounded-md bg-muted/70" />
                <div className="h-3 w-32 max-w-full rounded bg-muted/70" />
                <div className="ms-auto h-4 w-5 shrink-0 rounded bg-muted/60" />
              </div>
            ))}
          </div>
        </div>

        <div className="min-w-0 rounded-lg border border-border bg-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="h-4 w-36 rounded bg-muted/70" />
            <div className="h-7 w-40 rounded bg-muted/60" />
          </div>
          <CollectionGroupsGridSkeleton />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-border bg-card p-5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="size-8 shrink-0 rounded-md bg-muted/70" />
            <div className="min-w-0">
              <div className="h-4 w-20 rounded bg-muted/70" />
              <div className="mt-2 h-3 w-48 max-w-full rounded bg-muted/50" />
            </div>
          </div>
          <div className="h-8 w-28 rounded-md bg-muted/60" />
        </div>

        <div className="grid gap-6 rounded-lg border border-border bg-card p-5 @min-[56rem]:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] @min-[56rem]:items-center">
          <div className="flex items-start gap-3">
            <div className="size-8 shrink-0 rounded-md bg-muted/70" />
            <div className="min-w-0 flex-1">
              <div className="h-6 w-40 max-w-full rounded bg-muted/70" />
              <div className="mt-2 h-4 w-48 max-w-full rounded bg-muted/50" />
              <div className="mt-2 h-3 w-28 rounded bg-muted/50" />
              <div className="mt-3 h-3 w-full rounded bg-muted/50" />
            </div>
          </div>
          <div className="@container/usage border-t border-border pt-5 @min-[56rem]:border-s @min-[56rem]:border-t-0 @min-[56rem]:ps-6 @min-[56rem]:pt-0">
            <div className="grid gap-4 @min-[26rem]/usage:grid-cols-3">
              {USAGE_SKELETON_KEYS.map((key) => (
                <div key={key}>
                  <div className="h-3 w-20 rounded bg-muted/50" />
                  <div className="mt-2 h-4 w-24 rounded bg-muted/70" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
