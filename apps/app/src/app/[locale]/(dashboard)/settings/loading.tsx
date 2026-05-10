"use client";

export default function SettingsLoading() {
  return (
    <div className="flex h-full w-full flex-col gap-6">
      <div className="flex w-full flex-col items-start rounded-lg border border-border bg-card">
        <div className="flex w-full items-start justify-between rounded-lg p-6">
          <div className="flex flex-col gap-2">
            <div className="h-6 w-24 rounded bg-muted/60" />
            <div className="h-4 w-48 rounded bg-muted/40" />
          </div>
          <div className="h-20 w-20 rounded-full bg-muted/60" />
        </div>
        <div className="flex min-h-14 w-full items-center justify-between rounded-lg rounded-t-none border-t border-border bg-secondary px-6 dark:bg-card">
          <div className="h-4 w-40 rounded bg-muted/40" />
        </div>
      </div>

      <div className="flex w-full flex-col items-start rounded-lg border border-border bg-card">
        <div className="flex w-full flex-col gap-4 rounded-lg p-6">
          <div className="flex flex-col gap-2">
            <div className="h-6 w-16 rounded bg-muted/60" />
            <div className="h-4 w-56 rounded bg-muted/40" />
          </div>
          <div className="h-10 w-80 rounded-lg bg-muted/40" />
        </div>
        <div className="flex min-h-14 w-full items-center justify-between rounded-lg rounded-t-none border-t border-border bg-secondary px-6 dark:bg-card">
          <div className="h-4 w-32 rounded bg-muted/40" />
          <div className="h-9 w-16 rounded-lg bg-muted/60" />
        </div>
      </div>

      <div className="flex w-full flex-col items-start rounded-lg border border-border bg-card">
        <div className="flex w-full flex-col gap-4 rounded-lg p-6">
          <div className="flex flex-col gap-2">
            <div className="h-6 w-24 rounded bg-muted/60" />
            <div className="h-4 w-64 rounded bg-muted/40" />
          </div>
          <div className="h-10 w-80 rounded-lg bg-muted/40" />
        </div>
        <div className="flex min-h-14 w-full items-center justify-between rounded-lg rounded-t-none border-t border-border bg-secondary px-6 dark:bg-card">
          <div className="h-4 w-36 rounded bg-muted/40" />
          <div className="h-9 w-16 rounded-lg bg-muted/60" />
        </div>
      </div>

      <div className="flex w-full flex-col items-start rounded-lg border border-destructive/30 bg-card">
        <div className="flex flex-col gap-2 p-6">
          <div className="h-6 w-32 rounded bg-muted/60" />
          <div className="h-4 w-72 rounded bg-muted/40" />
        </div>
        <div className="flex min-h-14 w-full items-center justify-between rounded-lg rounded-t-none border-t border-border bg-red-500/5 px-6">
          <div className="h-4 w-48 rounded bg-muted/40" />
          <div className="h-9 w-28 rounded-lg bg-destructive/20" />
        </div>
      </div>
    </div>
  );
}
