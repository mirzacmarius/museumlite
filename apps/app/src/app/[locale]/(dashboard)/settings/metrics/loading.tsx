"use client";

export default function MetricsHealthLoading() {
  return (
    <div className="flex size-full flex-col gap-6">
      <div className="flex w-full flex-col gap-2">
        <div className="h-7 w-48 rounded bg-muted/60" />
        <div className="h-4 w-96 rounded bg-muted/40" />
      </div>
      <div className="h-40 rounded-lg border border-border bg-card" />
      <div className="h-64 rounded-lg border border-border bg-card" />
    </div>
  );
}
