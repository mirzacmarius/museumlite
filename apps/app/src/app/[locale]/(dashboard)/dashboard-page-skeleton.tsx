const METRIC_SKELETON_WIDTHS = {
  objects: "w-32",
  display: "w-36",
  loans: "w-32",
  locations: "w-32",
  transfers: "w-52",
};
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
const WORK_SECTION_SKELETON_KEYS = ["approvals", "tasks", "reviews"];
const ROW_SKELETON_KEYS = ["first", "second", "third"];

export function CollectionGroupsGridSkeleton() {
  return (
    <div className="flex flex-wrap items-center justify-start gap-1.5">
      {COLLECTION_GROUP_SKELETON_WIDTHS.map((widthClass) => (
        <div
          key={widthClass}
          className={`h-6 max-w-full rounded-md border border-border bg-card ${widthClass}`}
        />
      ))}
    </div>
  );
}

function WorkSectionSkeleton({ sectionKey }: { sectionKey: string }) {
  return (
    <div className="space-y-3">
      <div className="h-4 w-44 rounded bg-muted/60" />
      <div className="divide-y divide-border rounded-lg border border-border">
        {ROW_SKELETON_KEYS.map((key) => (
          <div
            key={`${sectionKey}-${key}`}
            className="flex items-center gap-3 px-4 py-2.5"
          >
            <div className="size-7 shrink-0 rounded-md bg-muted/70" />
            <div className="h-3 w-48 max-w-full rounded bg-muted/60" />
            <div className="ms-auto h-3 w-16 shrink-0 rounded bg-muted/40" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function DashboardPageSkeleton() {
  return (
    <div className="@container h-full min-h-0 w-full overflow-y-auto bg-background p-4 sm:p-6 custom-scrollbar">
      <div className="flex min-w-0 flex-col gap-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="max-w-full">
            <div className="h-3 w-40 max-w-full rounded bg-muted/50" />
            <div className="mt-1.5 h-6 w-32 max-w-full rounded bg-muted/70" />
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="h-8 w-28 rounded-md bg-muted/70" />
            <div className="h-8 w-32 rounded-md bg-muted/50" />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {Object.entries(METRIC_SKELETON_WIDTHS).map(([key, widthClass]) => (
            <div
              key={key}
              className={`h-8 max-w-full rounded-md border border-border bg-card ${widthClass}`}
            />
          ))}
        </div>

        <div className="grid items-start gap-6 @min-[60rem]:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
          <div className="flex min-w-0 flex-col gap-6">
            {WORK_SECTION_SKELETON_KEYS.map((key) => (
              <WorkSectionSkeleton key={key} sectionKey={key} />
            ))}
          </div>
          <div className="flex min-w-0 flex-col gap-3">
            <div className="h-4 w-36 rounded bg-muted/60" />
            <CollectionGroupsGridSkeleton />
          </div>
        </div>
      </div>
    </div>
  );
}
