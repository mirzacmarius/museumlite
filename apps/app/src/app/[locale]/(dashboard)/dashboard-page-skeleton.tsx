const KPI_SKELETON_KEYS = ["objects", "accessions", "loans", "locations"];
const QUICK_ACTION_SKELETON_KEYS = [
  "objects",
  "collections",
  "accessions",
  "locations",
  "loans",
  "reports",
];
const ACTIVITY_SKELETON_KEYS = [
  "create",
  "update",
  "move",
  "loan",
  "accession",
  "review",
];

export function DashboardPageSkeleton() {
  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-y-auto bg-background p-4 sm:p-6">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {KPI_SKELETON_KEYS.map((key) => (
          <div
            key={key}
            className="h-28 rounded-xl border border-border bg-card"
          />
        ))}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-[1fr_360px]">
        <section className="rounded-xl border border-border bg-card p-5">
          <div className="mb-5 h-5 w-36 rounded bg-muted/70" />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {QUICK_ACTION_SKELETON_KEYS.map((key) => (
              <div
                key={key}
                className="h-28 rounded-lg border border-border bg-muted/30"
              />
            ))}
          </div>
        </section>

        <aside className="rounded-xl border border-border bg-card p-5">
          <div className="mb-5 h-5 w-28 rounded bg-muted/70" />
          <div className="space-y-3">
            {ACTIVITY_SKELETON_KEYS.map((key) => (
              <div key={key} className="h-14 rounded-lg bg-muted/30" />
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}
