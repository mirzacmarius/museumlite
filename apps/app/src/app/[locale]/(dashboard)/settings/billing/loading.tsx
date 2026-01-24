"use client";

export default function BillingSettingsLoading() {
  return (
    <div className="flex h-full w-full flex-col gap-6">
      <div className="flex w-full flex-col gap-2 p-6 py-2">
        <div className="h-7 w-40 animate-pulse rounded bg-muted/60" />
        <div className="h-4 w-96 animate-pulse rounded bg-muted/40" />
      </div>

      <div className="flex w-full flex-col items-start rounded-lg border border-border bg-card">
        <div className="flex flex-col gap-2 p-6">
          <div className="h-7 w-24 animate-pulse rounded bg-muted/60" />
          <div className="flex items-center gap-2">
            <div className="h-4 w-32 animate-pulse rounded bg-muted/40" />
            <div className="h-5 w-12 animate-pulse rounded-md bg-primary/10" />
            <div className="h-4 w-12 animate-pulse rounded bg-muted/40" />
          </div>
        </div>

        <div className="flex w-full flex-col items-center justify-evenly gap-2 border-border p-6 pt-0">
          <div className="flex w-full items-center rounded-md border border-border p-4">
            <div className="flex w-full flex-col items-start">
              <div className="h-5 w-12 animate-pulse rounded bg-muted/60" />
              <div className="mt-1 h-4 w-64 animate-pulse rounded bg-muted/40" />
            </div>
          </div>

          <div className="flex w-full items-center rounded-md border border-border p-4">
            <div className="flex w-full flex-col items-start">
              <div className="flex items-center gap-2">
                <div className="h-5 w-8 animate-pulse rounded bg-muted/60" />
                <div className="h-5 w-24 animate-pulse rounded-md bg-primary/10" />
              </div>
              <div className="mt-1 h-4 w-72 animate-pulse rounded bg-muted/40" />
            </div>
            <div className="flex items-center gap-2 px-4">
              <div className="h-4 w-16 animate-pulse rounded bg-muted/40" />
              <div className="h-6 w-11 animate-pulse rounded-full bg-muted/50" />
            </div>
          </div>
        </div>

        <div className="flex min-h-14 w-full items-center justify-between rounded-lg rounded-t-none border-t border-border bg-secondary px-6 py-3 dark:bg-card">
          <div className="h-4 w-48 animate-pulse rounded bg-muted/40" />
          <div className="h-9 w-32 animate-pulse rounded-lg bg-muted/60" />
        </div>
      </div>
    </div>
  );
}
