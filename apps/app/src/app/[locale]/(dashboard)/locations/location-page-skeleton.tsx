const LOCATION_SECTION_SKELETON_KEYS = ["exhibition", "storage"];
const LOCATION_ROW_SKELETON_KEYS = ["root", "wing", "room", "case"];
const LOCATION_METRIC_SKELETON_KEYS = ["objects", "capacity", "audit"];
const LOCATION_CARD_SKELETON_KEYS = [
  "vitrine",
  "wall",
  "cabinet",
  "shelf",
  "case",
  "drawer",
];

export function LocationsPageSkeleton() {
  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-background md:flex-row">
      <aside className="h-56 w-full shrink-0 overflow-hidden border-b border-border/60 bg-background px-2 py-3 dark:border-white/10 md:h-full md:w-56 md:border-b-0 md:border-e">
        <div className="mb-3 flex items-center justify-between">
          <div className="h-3 w-16 rounded bg-muted/70" />
          <div className="h-4 w-6 rounded border border-border/60 bg-muted/50 dark:border-white/10" />
        </div>
        <div className="space-y-5">
          {LOCATION_SECTION_SKELETON_KEYS.map((sectionKey) => (
            <div key={sectionKey} className="space-y-2">
              <div className="h-3 w-28 rounded bg-muted/50" />
              {LOCATION_ROW_SKELETON_KEYS.map((rowKey) => (
                <div
                  key={`${sectionKey}-${rowKey}`}
                  className="h-7 rounded-md bg-muted/40"
                />
              ))}
            </div>
          ))}
        </div>
      </aside>

      <LocationMainSkeleton />
    </div>
  );
}

export function LocationMainSkeleton() {
  return (
    <main className="min-h-0 min-w-0 flex-1 overflow-hidden bg-background px-4 pb-6 pt-5 dark:bg-zinc-950 md:px-6">
      <LocationContentSkeleton />
    </main>
  );
}

export function LocationContentSkeleton() {
  return (
    <>
      <section className="mb-7 border-b border-border/60 pb-6 dark:border-white/10">
        <div className="flex flex-col gap-6">
          <div className="space-y-3">
            <div className="h-7 w-64 rounded bg-muted/70" />
            <div className="h-4 w-40 max-w-full rounded bg-muted/40" />
          </div>
          <div className="grid grid-cols-1 gap-x-5 gap-y-3 sm:grid-flow-col sm:auto-cols-fr">
            {LOCATION_METRIC_SKELETON_KEYS.map((key) => (
              <div key={key} className="h-12 rounded-md bg-muted/30" />
            ))}
          </div>
        </div>
      </section>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,160px),1fr))] gap-4">
        {LOCATION_CARD_SKELETON_KEYS.map((key) => (
          <div
            key={key}
            className="h-56 rounded-md border border-border/60 bg-muted/20 dark:border-white/10 dark:bg-zinc-900/40"
          />
        ))}
      </div>
    </>
  );
}
