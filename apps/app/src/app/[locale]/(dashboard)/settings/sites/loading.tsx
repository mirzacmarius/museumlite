"use client";

export default function SitesSettingsLoading() {
  return (
    <div className="flex w-full flex-col gap-6">
      <div className="flex w-full flex-col gap-2">
        <div className="h-7 w-32 rounded bg-muted/60" />
        <div className="h-4 w-72 rounded bg-muted/40" />
      </div>

      <div className="flex w-full items-center justify-between">
        <div>
          <div className="h-5 w-16 rounded bg-muted/60" />
          <div className="mt-1 h-4 w-28 rounded bg-muted/40" />
        </div>
        <div className="h-10 w-28 rounded-lg bg-muted/60" />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {Array.from({ length: 4 }, (_, i) => ({
          key: `site-card-${i}`,
          isDefault: i === 0,
          showActions: i > 0,
        })).map((site) => (
          <div
            key={site.key}
            className="rounded-lg border border-border bg-card p-4"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <div className="h-5 w-24 rounded bg-muted/60" />
                  {site.isDefault && (
                    <div className="h-5 w-16 rounded-full bg-primary/10" />
                  )}
                </div>
                <div className="mt-2 h-4 w-48 rounded bg-muted/40" />
                <div className="mt-3">
                  <div className="h-3 w-28 rounded bg-muted/30" />
                  <div className="mt-2 flex flex-wrap gap-1">
                    <div className="h-6 w-20 rounded bg-secondary" />
                    <div className="h-6 w-24 rounded bg-secondary" />
                    <div className="h-6 w-16 rounded bg-secondary" />
                  </div>
                </div>
              </div>
              {site.showActions && (
                <div className="flex gap-2">
                  <div className="size-8 rounded bg-muted/30" />
                  <div className="size-8 rounded bg-muted/30" />
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
