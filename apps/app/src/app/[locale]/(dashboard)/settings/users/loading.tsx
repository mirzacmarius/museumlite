"use client";

export default function UsersSettingsLoading() {
  return (
    <div className="flex w-full flex-col gap-6">
      <div className="flex w-full flex-col gap-2">
        <div className="h-7 w-32 rounded bg-muted/60" />
        <div className="h-4 w-64 rounded bg-muted/40" />
      </div>

      <div className="flex w-full items-center justify-between">
        <div>
          <div className="h-5 w-16 rounded bg-muted/60" />
          <div className="mt-1 h-4 w-24 rounded bg-muted/40" />
        </div>
        <div className="h-10 w-28 rounded-lg bg-muted/60" />
      </div>

      <div className="rounded-lg border border-border bg-card">
        <div className="divide-y divide-border">
          {Array.from({ length: 5 }, (_, i) => `user-row-${i}`).map((key) => (
            <div key={key} className="flex items-center justify-between p-4">
              <div className="flex items-center gap-4">
                <div className="size-10 rounded-full bg-muted/50" />
                <div>
                  <div className="h-4 w-32 rounded bg-muted/60" />
                  <div className="mt-1 h-3 w-48 rounded bg-muted/40" />
                  <div className="mt-1 h-3 w-24 rounded bg-muted/30" />
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="h-10 w-40 rounded-lg bg-muted/40" />
                <div className="size-8 rounded bg-muted/30" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
