type AccessionsPageSkeletonProps = {
  actionsCount?: number;
  showWorkbenchNav?: boolean;
  statsCount?: number;
};

const statPlaceholders = [
  "pending",
  "approved",
  "rejected",
  "incoming",
  "cancelled",
] as const;
const actionPlaceholders = ["export", "import", "create", "delete"] as const;

export function AccessionsPageSkeleton({
  actionsCount = 4,
  showWorkbenchNav = true,
  statsCount = 3,
}: AccessionsPageSkeletonProps) {
  return (
    <div className="flex h-full w-full flex-col bg-background p-6">
      <div className="mb-6 flex min-h-[52px] items-center justify-between gap-6">
        <div className="flex gap-4">
          {statPlaceholders.slice(0, statsCount).map((id) => (
            <div key={id} className="flex min-w-20 flex-col gap-2">
              <div className="h-3 w-20 rounded bg-muted/60" />
              <div className="h-7 w-8 rounded bg-muted/60" />
            </div>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <div className="h-8 w-64 rounded-md bg-muted/60" />
          {actionPlaceholders.slice(0, actionsCount).map((id) => (
            <div key={id} className="h-8 w-24 rounded-md bg-muted/60" />
          ))}
        </div>
      </div>

      {showWorkbenchNav ? (
        <div className="mb-6 rounded-2xl border border-border/60 bg-card/70 p-3">
          <div className="grid gap-2 md:grid-cols-2">
            {["overview", "transfers"].map((id) => (
              <div
                key={id}
                className="flex items-center justify-between gap-4 rounded-xl border border-transparent bg-background/40 px-4 py-3"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="h-9 w-9 shrink-0 rounded-lg bg-muted/60" />
                  <div className="space-y-2">
                    <div className="h-4 w-24 rounded bg-muted/60" />
                    <div className="h-3 w-64 rounded bg-muted/50" />
                  </div>
                </div>
                <div className="h-6 w-9 shrink-0 rounded-full bg-muted/60" />
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="custom-scrollbar flex-1 overflow-x-auto">
        <div className="flex h-full min-w-max gap-6 pb-4">
          {["col-1", "col-2", "col-3"].map((colId) => (
            <div key={colId} className="flex w-72 flex-col gap-3">
              <div className="mb-2 flex items-center justify-between">
                <div className="h-4 w-20 rounded bg-muted/60" />
                <div className="h-5 w-6 rounded bg-muted/60" />
              </div>

              <div className="flex-1 rounded-lg border-2 border-dashed border-border/60">
                <div className="flex flex-col gap-3 p-2">
                  {["card-1", "card-2", "card-3"].map((cardId) => (
                    <div
                      key={`${colId}-${cardId}`}
                      className="h-24 rounded-lg border border-border/60 bg-muted/40"
                    />
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
