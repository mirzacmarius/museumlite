"use client";

export default function OrganizationSettingsLoading() {
  return (
    <div className="flex w-full flex-col gap-6">
      <div className="flex w-full flex-col gap-2">
        <div className="h-7 w-48 rounded bg-muted/60" />
        <div className="h-4 w-80 rounded bg-muted/40" />
      </div>

      <div className="rounded-lg border border-border bg-card p-6">
        <div className="mb-4 h-5 w-36 rounded bg-muted/60" />
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="h-4 w-24 rounded bg-muted/50" />
            <div className="h-10 w-full rounded-lg bg-muted/40" />
          </div>
          <div className="space-y-2">
            <div className="h-4 w-16 rounded bg-muted/50" />
            <div className="h-10 w-full rounded-lg bg-muted/30" />
          </div>
          <div className="space-y-2">
            <div className="h-4 w-12 rounded bg-muted/50" />
            <div className="h-10 w-full rounded-lg bg-muted/30" />
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-6">
        <div className="mb-4 h-5 w-48 rounded bg-muted/60" />
        <div className="space-y-6">
          <div className="space-y-2">
            <div className="h-4 w-32 rounded bg-muted/50" />
            <div className="h-10 w-full rounded-lg bg-muted/40" />
          </div>
          <div className="space-y-2">
            <div className="h-4 w-40 rounded bg-muted/50" />
            <div className="h-10 w-full rounded-lg bg-muted/40" />
          </div>
          <div className="flex items-center justify-between">
            <div className="h-4 w-48 rounded bg-muted/50" />
            <div className="h-6 w-11 rounded-full bg-muted/40" />
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-6">
        <div className="mb-4 h-5 w-32 rounded bg-muted/60" />
        <div className="space-y-4">
          <div className="h-4 w-40 rounded bg-muted/50" />
          <div className="flex flex-wrap gap-2">
            <div className="h-8 w-20 rounded-md bg-muted/40" />
            <div className="h-8 w-24 rounded-md bg-muted/40" />
            <div className="h-8 w-16 rounded-md bg-muted/40" />
          </div>
          <div className="h-9 w-36 rounded-lg bg-muted/50" />
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-6">
        <div className="mb-4 h-5 w-36 rounded bg-muted/60" />
        <div className="space-y-4">
          <div className="h-4 w-48 rounded bg-muted/50" />
          <div className="h-3 w-64 rounded bg-muted/30" />
        </div>
      </div>

      <div className="flex justify-end gap-4">
        <div className="h-10 w-32 rounded-lg bg-muted/60" />
      </div>
    </div>
  );
}
