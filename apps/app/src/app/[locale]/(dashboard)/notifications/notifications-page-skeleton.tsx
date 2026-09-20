const SKELETON = {
  chips: 3,
  categories: 6,
  days: 2,
  rowsPerDay: 4,
} as const;

function range(count: number) {
  return Array.from({ length: count }, (_, index) => index);
}

export function NotificationsPageSkeleton() {
  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-y-auto bg-background p-4 sm:p-6">
      <section className="border-b border-border/60 pb-6 dark:border-white/10">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <div className="h-6 w-40 rounded bg-muted/70" />
            <div className="h-4 w-72 max-w-full rounded bg-muted/50" />
          </div>
          <div className="h-8 w-32 rounded-md bg-muted/50" />
        </div>
        <div className="mt-4 flex flex-wrap gap-1.5">
          {range(SKELETON.chips).map((key) => (
            <div
              key={key}
              className="h-8 w-28 rounded-md border border-border/60 bg-muted/40 dark:border-white/10"
            />
          ))}
        </div>
      </section>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex h-8 flex-wrap gap-0.5 rounded-md border border-border/60 p-0.5 dark:border-white/10">
          {range(SKELETON.categories).map((key) => (
            <div key={key} className="h-7 w-16 rounded bg-muted/50 sm:w-24" />
          ))}
        </div>
        <div className="inline-flex h-8 gap-0.5 rounded-md border border-border/60 p-0.5 dark:border-white/10">
          <div className="h-7 w-12 rounded bg-muted/60" />
          <div className="h-7 w-16 rounded bg-muted/40" />
        </div>
      </div>

      <div className="mt-5 overflow-hidden rounded-xl border border-border/60 dark:border-white/10 dark:bg-zinc-900/40">
        {range(SKELETON.days).map((day) => (
          <div key={day}>
            <div className="flex items-center justify-between border-b border-border/60 px-4 py-2 dark:border-white/10">
              <div className="h-2.5 w-16 rounded bg-muted/60" />
              <div className="h-2.5 w-4 rounded bg-muted/40" />
            </div>
            <div className="divide-y divide-border/60 dark:divide-white/10">
              {range(SKELETON.rowsPerDay).map((row) => (
                <div
                  key={`${day}-${row}`}
                  className="flex items-start gap-3 px-4 py-3.5"
                >
                  <div className="size-9 rounded-md bg-muted/60" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="h-4 w-2/5 rounded bg-muted/70" />
                    <div className="h-3 w-3/5 rounded bg-muted/50" />
                    <div className="h-2.5 w-28 rounded bg-muted/40" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
