"use client";

export default function PreparationRecipesSettingsLoading() {
  return (
    <div className="flex w-full flex-col gap-6">
      <div className="flex w-full items-start justify-between">
        <div className="flex flex-col gap-2">
          <div className="h-7 w-48 rounded bg-muted/60" />
          <div className="h-4 w-96 rounded bg-muted/40" />
        </div>
        <div className="h-10 w-36 rounded-lg bg-muted/60" />
      </div>
      {["first", "second"].map((row) => (
        <div
          key={row}
          className="h-28 rounded-lg border border-border bg-card"
        />
      ))}
    </div>
  );
}
