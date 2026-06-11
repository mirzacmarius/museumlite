const KPI_SKELETON_KEYS = ["objects", "display", "loans"];
const COMMAND_SKELETON_KEYS = ["add-object", "new-collection", "analytics"];
const USAGE_SKELETON_KEYS = ["storage", "objects", "exports"];
const WORKFLOW_SKELETON_KEYS = [
  "transfer-approvals",
  "accessions",
  "deaccessions",
  "loans",
];

function CompactKpiSkeleton() {
  return (
    <div className="flex w-full items-center gap-3 rounded-lg border border-border bg-card px-3.5 py-3">
      <div className="size-8 rounded-md bg-muted/70" />
      <div className="space-y-1.5">
        <div className="h-2.5 w-24 rounded bg-muted/70" />
        <div className="h-5 w-8 rounded bg-muted/70" />
      </div>
    </div>
  );
}

function CompactActionSkeleton() {
  return (
    <div className="inline-flex w-full rounded-lg border border-border bg-card px-3.5 py-3">
      <div className="flex items-center gap-3">
        <div className="size-8 rounded-md bg-muted/70" />
        <div className="h-4 w-24 rounded bg-muted/70" />
      </div>
    </div>
  );
}

function BillingOverviewSkeleton() {
  return (
    <section className="mt-6">
      <div className="h-4 w-36 rounded bg-muted/70" />
      <div className="mt-2 h-4 w-80 max-w-full rounded bg-muted/50" />
      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,0.9fr)_minmax(22rem,1.1fr)]">
        <div className="rounded-lg border border-border bg-card p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="size-8 rounded-md bg-muted/70" />
              <div>
                <div className="h-3 w-20 rounded bg-muted/70" />
                <div className="mt-2 h-5 w-28 rounded bg-muted/70" />
              </div>
            </div>
            <div className="h-6 w-14 rounded bg-muted/60" />
          </div>
          <div className="mt-5 space-y-3">
            <div className="h-9 rounded-md bg-muted/50" />
            <div className="h-9 rounded-md bg-muted/50" />
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card p-5">
          <div className="mb-3 flex items-center justify-between">
            <div className="h-4 w-24 rounded bg-muted/70" />
            <div className="h-3 w-14 rounded bg-muted/60" />
          </div>
          <div className="space-y-3">
            {USAGE_SKELETON_KEYS.map((metric) => (
              <div key={metric}>
                <div className="mb-1 flex items-end justify-between">
                  <div className="h-3 w-20 rounded bg-muted/70" />
                  <div className="h-3 w-24 rounded bg-muted/60" />
                </div>
                <div className="h-1.5 w-full rounded-full bg-muted/50" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export function DashboardAnalyticsSectionsSkeleton() {
  return (
    <>
      <section className="mt-8">
        <div className="h-4 w-24 rounded bg-muted/70" />
        <div className="mt-3 inline-grid grid-cols-1 gap-3 sm:auto-cols-fr sm:grid-flow-col sm:grid-cols-none">
          {KPI_SKELETON_KEYS.map((key) => (
            <CompactKpiSkeleton key={key} />
          ))}
        </div>
      </section>

      <section className="mt-6">
        <div className="h-4 w-32 rounded bg-muted/70" />
        <div className="mt-3 inline-grid grid-cols-1 gap-3 sm:grid-cols-3">
          {COMMAND_SKELETON_KEYS.map((key) => (
            <CompactActionSkeleton key={key} />
          ))}
        </div>
      </section>

      <BillingOverviewSkeleton />

      <section className="mt-6">
        <div className="h-4 w-32 rounded bg-muted/70" />
        <div className="mt-3 inline-grid grid-cols-1 gap-3 sm:auto-cols-fr sm:grid-flow-col sm:grid-cols-none">
          {WORKFLOW_SKELETON_KEYS.map((key) => (
            <CompactKpiSkeleton key={key} />
          ))}
        </div>
      </section>
    </>
  );
}

export function DashboardPageSkeleton() {
  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-y-auto bg-background p-4 sm:p-6">
      <div className="h-6 w-72 max-w-full rounded bg-muted/70" />
      <div className="mt-2 h-4 w-[34rem] max-w-full rounded bg-muted/50" />

      <DashboardAnalyticsSectionsSkeleton />
    </div>
  );
}
