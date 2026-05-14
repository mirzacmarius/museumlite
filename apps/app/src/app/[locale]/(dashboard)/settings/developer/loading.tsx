"use client";

export default function DeveloperSettingsLoading() {
  return (
    <div className="w-full space-y-6">
      <div>
        <div className="h-9 w-48 rounded bg-muted/60" />
        <div className="mt-2 h-4 w-80 rounded bg-muted/40" />
      </div>

      <div className="w-full">
        <div className="flex gap-1 rounded-lg bg-muted/30 p-1 w-fit">
          <div className="h-9 w-24 rounded-md bg-muted/60" />
          <div className="h-9 w-24 rounded-md bg-muted/40" />
          <div className="h-9 w-24 rounded-md bg-muted/40" />
        </div>

        <div className="mt-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="h-6 w-24 rounded bg-muted/60" />
              <div className="mt-1 h-4 w-64 rounded bg-muted/40" />
            </div>
            <div className="h-10 w-32 rounded-lg bg-muted/60" />
          </div>

          <div className="rounded-lg border border-border">
            <div className="divide-y divide-border">
              {Array.from({ length: 3 }, (_, i) => `api-key-${i}`).map(
                (key) => (
                  <div
                    key={key}
                    className="flex items-center justify-between p-4"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <div className="h-4 w-32 rounded bg-muted/60" />
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="h-6 w-24 rounded bg-muted/40" />
                        <div className="h-4 w-32 rounded bg-muted/30" />
                        <div className="h-4 w-28 rounded bg-muted/30" />
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-9 w-20 rounded-lg bg-muted/50" />
                      <div className="size-9 rounded bg-muted/30" />
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
