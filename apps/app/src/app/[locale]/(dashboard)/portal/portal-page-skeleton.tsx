const SIDEBAR_KEYS = ["visibility", "branding", "sharing", "filters", "domain"];
const PREVIEW_KEYS = ["hero", "search", "card-one", "card-two", "card-three"];

export function PortalPageSkeleton() {
  return (
    <div className="flex size-full flex-col overflow-hidden bg-background">
      <div className="shrink-0 border-b border-border px-6 py-4">
        <div className="h-7 w-40 rounded bg-muted/70" />
        <div className="mt-2 h-4 w-80 rounded bg-muted/50" />
      </div>

      <div className="flex min-h-0 flex-1 gap-6 p-6">
        <aside className="hidden w-80 shrink-0 space-y-3 rounded-lg border border-border bg-card p-4 md:block">
          {SIDEBAR_KEYS.map((key) => (
            <div
              key={key}
              className="h-20 rounded-lg border border-border bg-muted/20"
            />
          ))}
        </aside>

        <main className="min-w-0 flex-1 rounded-lg border border-border bg-card p-6">
          <div className="mb-6 h-40 rounded-xl bg-muted/30" />
          <div className="mb-6 h-10 rounded-md bg-muted/50" />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {PREVIEW_KEYS.slice(2).map((key) => (
              <div
                key={key}
                className="h-48 rounded-lg border border-border bg-muted/20"
              />
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}
