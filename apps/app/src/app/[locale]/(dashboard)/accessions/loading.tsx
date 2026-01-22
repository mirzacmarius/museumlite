"use client";

export default function AccessionsLoading() {
  return (
    <div className="flex h-full w-full flex-col bg-background p-6">
      <div className="mb-6 flex items-center justify-between">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-muted/60" />
        <div className="h-10 w-32 animate-pulse rounded-lg bg-muted/60" />
      </div>

      <div className="mb-6 grid grid-cols-4 gap-4">
        {["stat-1", "stat-2", "stat-3", "stat-4"].map((id) => (
          <div
            key={id}
            className="rounded-xl border border-border/60 bg-card p-4"
          >
            <div className="mb-2 h-4 w-24 animate-pulse rounded bg-muted/60" />
            <div className="h-8 w-16 animate-pulse rounded bg-muted/60" />
          </div>
        ))}
      </div>

      <div className="grid flex-1 grid-cols-4 gap-4">
        {["col-1", "col-2", "col-3", "col-4"].map((colId) => (
          <div
            key={colId}
            className="flex flex-col rounded-xl border border-border/60 bg-card"
          >
            <div className="border-b border-border/60 p-4">
              <div className="h-5 w-24 animate-pulse rounded bg-muted/60" />
            </div>
            <div className="flex-1 space-y-3 p-4">
              {["card-1", "card-2", "card-3"].map((cardId) => (
                <div
                  key={`${colId}-${cardId}`}
                  className="h-24 animate-pulse rounded-lg bg-muted/40"
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
