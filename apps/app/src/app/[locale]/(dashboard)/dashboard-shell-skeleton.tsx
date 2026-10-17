import { DashboardPageSkeleton } from "./dashboard-page-skeleton";

/** Placeholder for the sidebar, header and home page while the session loads. */
export function DashboardShellSkeleton() {
  return (
    <div className="flex h-svh w-full" aria-busy="true">
      <div className="hidden w-56 shrink-0 flex-col gap-3 bg-sidebar p-3 md:flex">
        <div className="h-8 w-32 rounded-md bg-muted/60" />
        <div className="mt-4 flex flex-col gap-2">
          {SIDEBAR_ROW_KEYS.map((key) => (
            <div key={key} className="h-6 w-full rounded-md bg-muted/40" />
          ))}
        </div>
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-16 shrink-0 items-center gap-2 border-b border-border px-4">
          <div className="h-5 w-24 rounded bg-muted/60" />
        </div>
        <div className="min-h-0 flex-1 overflow-hidden">
          <DashboardPageSkeleton />
        </div>
      </div>
    </div>
  );
}

const SIDEBAR_ROW_KEYS = ["1", "2", "3", "4", "5", "6", "7", "8"];
