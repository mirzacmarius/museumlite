"use client";

export default function DataSettingsLoading() {
  return (
    <div className="flex size-full flex-col gap-6">
      <div className="flex w-full flex-col gap-2">
        <div className="h-7 w-40 rounded bg-muted/60" />
        <div className="h-4 w-80 rounded bg-muted/40" />
      </div>

      <div className="w-full">
        <div className="grid w-full grid-cols-2 rounded-lg bg-muted/30 p-1">
          <div className="h-9 rounded-md bg-muted/60" />
          <div className="h-9 rounded-md bg-muted/40" />
        </div>

        <div className="mt-6 space-y-6">
          <div className="rounded-xl border border-border bg-card">
            <div className="p-6">
              <div className="flex items-center gap-2">
                <div className="size-5 rounded bg-muted/50" />
                <div className="h-6 w-28 rounded bg-muted/60" />
              </div>
              <div className="mt-2 h-4 w-96 rounded bg-muted/40" />
            </div>
            <div className="space-y-4 px-6 pb-6">
              <div className="flex items-center gap-4">
                <div className="h-10 w-48 rounded-lg bg-muted/50" />
                <div className="h-10 w-40 rounded-lg bg-muted/50" />
              </div>

              <div className="rounded-lg border bg-muted/20 p-4">
                <div className="h-4 w-full rounded bg-muted/40" />
                <div className="mt-2 h-4 w-64 rounded bg-muted/30" />
              </div>

              <div className="flex items-center gap-4">
                <div className="h-10 w-32 rounded-lg bg-muted/60" />
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card">
            <div className="p-6">
              <div className="h-6 w-40 rounded bg-muted/60" />
            </div>
            <div className="space-y-4 px-6 pb-6">
              {Array.from({ length: 2 }, (_, i) => `data-row-${i}`).map(
                (key) => (
                  <div
                    key={key}
                    className="flex items-center justify-between rounded-lg border p-4"
                  >
                    <div className="flex items-center gap-4">
                      <div className="size-5 rounded-full bg-muted/50" />
                      <div>
                        <div className="h-4 w-24 rounded bg-muted/60" />
                        <div className="mt-1 h-3 w-32 rounded bg-muted/40" />
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="h-2 w-32 rounded-full bg-muted/40" />
                      <div className="h-6 w-20 rounded-full bg-muted/50" />
                    </div>
                  </div>
                ),
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
