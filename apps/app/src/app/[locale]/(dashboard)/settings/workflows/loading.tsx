"use client";

export default function WorkflowsSettingsLoading() {
  return (
    <div className="flex w-full flex-col gap-8 bg-background">
      <div className="flex flex-col gap-2">
        <div className="h-7 w-48 animate-pulse rounded bg-muted/60" />
        <div className="h-4 w-80 animate-pulse rounded bg-muted/40" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {Array.from({ length: 6 }, (_, i) => `workflow-card-${i}`).map(
          (key) => (
            <div
              key={key}
              className="rounded-xl border border-border bg-card p-6"
            >
              <div className="mb-6 flex items-start justify-between">
                <div>
                  <div className="h-5 w-32 animate-pulse rounded bg-muted/60" />
                  <div className="mt-2 h-4 w-48 animate-pulse rounded bg-muted/40" />
                </div>
                <div className="h-9 w-28 animate-pulse rounded-lg bg-muted/50" />
              </div>

              <div className="space-y-6">
                <div>
                  <div className="mb-3 h-4 w-28 animate-pulse rounded bg-muted/50" />
                  <div className="space-y-3">
                    {Array.from(
                      { length: 2 },
                      (_, j) => `workflow-step-${j}`,
                    ).map((stepKey) => (
                      <div
                        key={stepKey}
                        className="flex items-center gap-4 rounded-lg border border-border bg-background/50 p-3"
                      >
                        <div className="flex h-6 w-6 animate-pulse items-center justify-center rounded-full bg-muted/50" />
                        <div className="flex-1">
                          <div className="h-4 w-24 animate-pulse rounded bg-muted/50" />
                          <div className="mt-1 h-3 w-32 animate-pulse rounded bg-muted/30" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="mb-3 h-4 w-24 animate-pulse rounded bg-muted/50" />
                  <div className="flex flex-wrap gap-2">
                    <div className="h-7 w-20 animate-pulse rounded-md bg-muted/40" />
                    <div className="h-7 w-16 animate-pulse rounded-md bg-muted/40" />
                  </div>
                </div>
              </div>
            </div>
          ),
        )}
      </div>
    </div>
  );
}
