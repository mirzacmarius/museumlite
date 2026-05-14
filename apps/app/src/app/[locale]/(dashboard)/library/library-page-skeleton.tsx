const STAT_KEYS = ["items", "patrons", "circulation", "fines"];
const ACTION_KEYS = [
  "catalog",
  "patrons",
  "circulation",
  "fines",
  "acquisitions",
];
const CONFIG_KEYS = ["period", "fine", "renewals", "classification"];

export function LibraryPageSkeleton() {
  return (
    <div className="flex size-full bg-background px-6">
      <div className="z-10 mx-auto flex size-full max-w-screen-xl flex-col gap-6 py-6">
        <div className="flex w-full flex-col rounded-lg border border-border bg-card p-6">
          <div className="flex items-center gap-4">
            <div className="size-12 rounded-lg bg-muted/60" />
            <div className="space-y-2">
              <div className="h-7 w-40 rounded bg-muted/70" />
              <div className="h-4 w-72 rounded bg-muted/50" />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STAT_KEYS.map((key) => (
            <div
              key={key}
              className="h-28 rounded-lg border border-border bg-card"
            />
          ))}
        </div>

        <div className="flex w-full flex-col rounded-lg border border-border bg-card">
          <div className="border-b border-border p-6">
            <div className="h-5 w-32 rounded bg-muted/70" />
            <div className="mt-2 h-4 w-60 rounded bg-muted/50" />
          </div>
          <div className="grid grid-cols-1 gap-4 p-6 sm:grid-cols-2 lg:grid-cols-3">
            {ACTION_KEYS.map((key) => (
              <div
                key={key}
                className="h-24 rounded-lg border border-border bg-muted/20"
              />
            ))}
          </div>
        </div>

        <div className="flex w-full flex-col rounded-lg border border-border bg-card">
          <div className="border-b border-border p-6">
            <div className="h-5 w-36 rounded bg-muted/70" />
            <div className="mt-2 h-4 w-64 rounded bg-muted/50" />
          </div>
          <div className="grid grid-cols-1 gap-4 p-6 sm:grid-cols-2 lg:grid-cols-4">
            {CONFIG_KEYS.map((key) => (
              <div key={key} className="space-y-2">
                <div className="h-3 w-28 rounded bg-muted/50" />
                <div className="h-4 w-20 rounded bg-muted/70" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
