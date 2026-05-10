export function ScanPageSkeleton() {
  return (
    <div className="flex h-full w-full flex-col overflow-y-auto bg-background">
      <div className="mx-auto w-full max-w-4xl space-y-6 p-4 sm:p-6">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-muted/60" />
            <div className="space-y-2">
              <div className="h-7 w-36 rounded bg-muted/60" />
              <div className="h-4 w-80 rounded bg-muted/40" />
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-4 sm:p-6">
          <div className="flex aspect-video min-h-[320px] items-center justify-center rounded-lg border border-dashed border-border bg-muted/20">
            <div className="h-24 w-24 rounded-full bg-muted/60" />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {["how-to-scan", "supported-formats"].map((id) => (
            <div
              key={id}
              className="rounded-lg border border-border bg-card p-4"
            >
              <div className="flex items-start gap-3">
                <div className="h-8 w-8 flex-shrink-0 rounded-lg bg-muted/60" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-28 rounded bg-muted/60" />
                  <div className="h-3 w-full rounded bg-muted/40" />
                  <div className="h-3 w-4/5 rounded bg-muted/40" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
