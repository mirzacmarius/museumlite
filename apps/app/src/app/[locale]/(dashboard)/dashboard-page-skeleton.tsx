import { OVERVIEW_CARD_GRID_STYLE } from "./_components/overview-card";

const METRIC_SKELETON_KEYS = [
  "objects",
  "display",
  "notOnDisplay",
  "loans",
  "locations",
  "transfers",
];
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
const WORK_CARD_SKELETON_KEYS = ["tasks", "approvals", "reviews"];
const BOARD_COLUMN_SKELETON_KEYS = ["tasks", "approvals", "reviews", "cases"];
const CARD_SKELETON_KEYS = ["first", "second", "third"];

function OverviewCardSkeleton() {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-border bg-card px-3 py-2.5">
      <div className="h-8">
        <div className="h-4 w-3/4 rounded bg-muted/50" />
      </div>
      <div className="h-7 w-10 rounded bg-muted/70" />
    </div>
  );
}

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

function BoardColumnSkeleton({ columnKey }: { columnKey: string }) {
  return (
    <div className="flex min-w-52 max-w-72 flex-1 basis-0 flex-col rounded-lg bg-muted/30">
      <div className="p-3">
        <div className="h-3 w-36 rounded bg-muted/60" />
      </div>
      <div className="flex flex-col gap-2 px-2 pb-2">
        {CARD_SKELETON_KEYS.map((key) => (
          <div
            key={`${columnKey}-${key}`}
            className="space-y-1.5 rounded-lg border border-border bg-card px-3 py-2.5"
          >
            <div className="h-3 w-3/4 rounded bg-muted/60" />
            <div className="h-2.5 w-1/2 rounded bg-muted/40" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Placeholder for the My work board while the organization loads. */
export function MyWorkBoardSkeleton() {
  return (
    <div className="flex items-start gap-3 overflow-hidden">
      {BOARD_COLUMN_SKELETON_KEYS.map((key) => (
        <BoardColumnSkeleton key={key} columnKey={key} />
      ))}
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

        <div className="grid" style={OVERVIEW_CARD_GRID_STYLE}>
          {METRIC_SKELETON_KEYS.map((key) => (
            <OverviewCardSkeleton key={key} />
          ))}
        </div>

        <div className="space-y-3">
          <div className="h-5 w-28 rounded bg-muted/50" />
          <div className="grid" style={OVERVIEW_CARD_GRID_STYLE}>
            {WORK_CARD_SKELETON_KEYS.map((key) => (
              <OverviewCardSkeleton key={key} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
