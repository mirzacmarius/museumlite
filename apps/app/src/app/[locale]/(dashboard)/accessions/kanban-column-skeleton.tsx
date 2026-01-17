import { ScrollArea } from "@v1/ui/scroll-area";

export function KanbanColumnSkeleton() {
  return (
    <div className="flex w-72 flex-col gap-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="h-4 w-20 animate-pulse rounded bg-muted" />
        <div className="h-5 w-6 animate-pulse rounded bg-muted" />
      </div>

      <div className="flex-1 rounded-lg border-2 border-dashed border-border/60">
        <ScrollArea className="h-full p-2">
          <div className="flex flex-col gap-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="rounded-lg border border-border/60 bg-muted p-3"
              >
                <div className="mb-2 h-3 w-16 animate-pulse rounded bg-muted" />
                <div className="mb-3 h-4 w-full animate-pulse rounded bg-muted" />
                <div className="mb-3 h-3 w-2/3 animate-pulse rounded bg-muted" />
                <div className="flex items-center gap-2">
                  <div className="h-5 w-5 animate-pulse rounded-full bg-muted" />
                  <div className="h-3 w-20 animate-pulse rounded bg-muted" />
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
