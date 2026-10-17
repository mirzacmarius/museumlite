const TAB_SKELETONS = [
  { key: "general", width: "w-16" },
  { key: "physical", width: "w-36" },
  { key: "media", width: "w-12" },
  { key: "accession", width: "w-20" },
  { key: "provenance", width: "w-40" },
  { key: "valuation", width: "w-20" },
];

/** Placeholder for the object page while its record streams in. */
export function ObjectDetailSkeleton() {
  return (
    <div
      className="flex size-full flex-col overflow-hidden bg-background"
      data-testid="object-detail-skeleton"
    >
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-6">
        <div className="h-4 w-40 rounded bg-muted/60" />
        <div className="h-8 w-28 rounded-md bg-muted/60" />
      </div>
      <div className="flex gap-8 px-6 pt-8">
        <div className="size-44 shrink-0 rounded-lg bg-muted/50" />
        <div className="flex min-w-0 flex-1 flex-col gap-4 pt-1">
          <div className="h-5 w-40 rounded bg-muted/50" />
          <div className="h-8 w-72 max-w-full rounded bg-muted/70" />
          <div className="h-4 w-full max-w-xl rounded bg-muted/40" />
          <div className="h-4 w-48 rounded bg-muted/40" />
        </div>
      </div>
      <div className="mt-8 flex gap-6 border-b border-border px-6 pb-3">
        {TAB_SKELETONS.map((tab) => (
          <div
            key={tab.key}
            className={`h-4 rounded bg-muted/50 ${tab.width}`}
          />
        ))}
      </div>
      <div className="flex flex-col gap-4 p-6">
        <div className="h-24 w-full rounded-lg bg-muted/30" />
        <div className="h-24 w-full rounded-lg bg-muted/30" />
      </div>
    </div>
  );
}
