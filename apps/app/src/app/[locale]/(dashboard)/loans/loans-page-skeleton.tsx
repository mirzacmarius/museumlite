import {
  StatsCardsSkeleton,
  TableRowsSkeleton,
} from "@/components/dashboard-list-page-skeleton";

const OVERVIEW_KEYS = ["overview", "chart"];

export function LoansPageSkeleton() {
  return (
    <div className="flex h-full w-full flex-col overflow-y-auto bg-background">
      <div className="mx-auto w-full max-w-7xl space-y-6 p-4 sm:space-y-8 sm:p-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div className="space-y-2">
            <div className="h-7 w-32 rounded bg-muted/70" />
            <div className="h-4 w-72 rounded bg-muted/50" />
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <div className="h-9 w-24 rounded-md bg-muted/60" />
            <div className="h-9 w-24 rounded-md bg-muted/70" />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
          {OVERVIEW_KEYS.map((key) => (
            <div
              key={key}
              className={
                key === "overview"
                  ? "h-24 rounded-xl bg-card/40 lg:col-span-3"
                  : "h-[250px] rounded-xl bg-card/40 lg:col-span-1"
              }
            />
          ))}
        </div>

        <div className="space-y-6">
          <StatsCardsSkeleton />
          <div className="space-y-4">
            <div className="flex flex-col gap-4">
              <div className="h-9 w-full rounded-lg bg-muted/50 sm:w-96" />
              <div className="h-9 w-full rounded-lg bg-muted/50 sm:w-48" />
            </div>
            <TableRowsSkeleton count={8} />
          </div>
        </div>
      </div>
    </div>
  );
}
