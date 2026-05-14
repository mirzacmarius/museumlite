const LOCATION_SECTION_SKELETON_KEYS = ["exhibition", "storage"];
const LOCATION_ROW_SKELETON_KEYS = ["root", "wing", "room", "case"];
const LOCATION_METRIC_SKELETON_KEYS = [
  "objects",
  "capacity",
  "humidity",
  "temperature",
];
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
    <div className="flex h-full min-h-0 w-full bg-background">
      <aside className="hidden h-full w-72 shrink-0 border-r border-border bg-background/95 p-4 md:flex md:flex-col">
        <div className="mb-5 flex items-center justify-between">
          <div className="h-5 w-24 rounded bg-muted/70" />
          <div className="size-8 rounded-md bg-muted/60" />
        </div>
        <div className="mb-4 h-9 rounded-md bg-muted/50" />
        <div className="space-y-5">
          {LOCATION_SECTION_SKELETON_KEYS.map((sectionKey) => (
            <div key={sectionKey} className="space-y-2">
              <div className="h-3 w-28 rounded bg-muted/50" />
              {LOCATION_ROW_SKELETON_KEYS.map((rowKey) => (
                <div
                  key={`${sectionKey}-${rowKey}`}
                  className="h-9 rounded-md bg-muted/40"
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
    <main className="min-h-0 flex-1 overflow-hidden bg-gradient-to-br from-zinc-950 to-zinc-900/50 px-6 pb-6 pt-0">
      <LocationContentSkeleton />
    </main>
  );
}

export function LocationContentSkeleton() {
  return (
    <>
      <header className="-mx-6 sticky top-0 z-20 mb-8 flex h-14 items-center justify-between border-b border-border/60 bg-background/80 px-6 backdrop-blur-xl">
        <div className="flex items-center gap-2">
          <div className="h-3 w-16 rounded bg-muted/50" />
          <div className="size-3 rounded bg-muted/30" />
          <div className="h-3 w-32 rounded bg-muted/60" />
        </div>
        <div className="flex items-center gap-3">
          <div className="h-8 w-28 rounded-md bg-muted/50" />
          <div className="h-8 w-28 rounded-md bg-muted/60" />
        </div>
      </header>

      <section className="mb-6 rounded-xl border border-border/60 bg-card p-6">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <div className="h-7 w-64 rounded bg-muted/70" />
            <div className="h-4 w-96 max-w-full rounded bg-muted/40" />
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {LOCATION_METRIC_SKELETON_KEYS.map((key) => (
              <div
                key={key}
                className="h-20 w-28 rounded-lg border border-border bg-muted/30"
              />
            ))}
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {LOCATION_CARD_SKELETON_KEYS.map((key) => (
          <div
            key={key}
            className="h-40 rounded-xl border border-border/60 bg-card"
          />
        ))}
      </div>
    </>
  );
}
