"use client";

export default function LoanAgreementsSettingsLoading() {
  return (
    <div className="flex w-full flex-col gap-6">
      <div className="flex w-full items-start justify-between">
        <div className="flex flex-col gap-2">
          <div className="h-7 w-40 rounded bg-muted/60" />
          <div className="h-4 w-80 rounded bg-muted/40" />
        </div>
        <div className="h-10 w-32 rounded-lg bg-muted/60" />
      </div>
      <div className="h-16 rounded-lg border border-border bg-muted/20" />
      {["first", "second"].map((row) => (
        <div
          key={row}
          className="h-20 rounded-lg border border-border bg-card"
        />
      ))}
    </div>
  );
}
