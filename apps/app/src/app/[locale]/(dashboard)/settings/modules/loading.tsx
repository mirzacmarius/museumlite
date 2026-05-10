"use client";

export default function ModulesSettingsLoading() {
  return (
    <div className="flex h-full w-full flex-col gap-6">
      <div className="flex w-full flex-col items-start rounded-lg border border-border bg-card">
        <div className="flex w-full flex-col gap-2 p-6">
          <div className="h-7 w-32 rounded bg-muted/60" />
          <div className="h-4 w-96 rounded bg-muted/40" />
        </div>
      </div>

      <div className="flex w-full flex-col gap-4">
        {Array.from({ length: 7 }, (_, i) => `module-card-${i}`).map((key) => (
          <div
            key={key}
            className="flex w-full flex-col rounded-lg border border-border bg-card"
          >
            <div className="flex w-full items-start justify-between p-6">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/5" />
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <div className="h-5 w-28 rounded bg-muted/60" />
                  </div>
                  <div className="h-4 w-72 rounded bg-muted/40" />
                </div>
              </div>
              <div className="h-6 w-11 rounded-full bg-muted/50" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
