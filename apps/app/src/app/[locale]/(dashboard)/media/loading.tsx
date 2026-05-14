import { MediaGridSkeleton } from "./media-skeletons";

export default function MediaLoading() {
  return (
    <div className="flex size-full flex-col bg-background">
      <div className="flex h-full flex-col p-6">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <div className="h-5 w-24 rounded bg-muted/60" />
            <div className="mt-1 h-4 w-48 rounded bg-muted/40" />
          </div>
          <div className="flex items-center gap-6">
            {Array.from({ length: 3 }, (_, i) => `media-stat-${i}`).map(
              (key) => (
                <div key={key} className="flex items-center gap-2">
                  <div className="size-4 rounded bg-muted/50" />
                  <div className="flex flex-col gap-1">
                    <div className="h-3 w-12 rounded bg-muted/40" />
                    <div className="h-4 w-16 rounded bg-muted/60" />
                  </div>
                </div>
              ),
            )}
          </div>
        </div>

        <div className="mb-4 flex items-center gap-4">
          <div className="h-10 flex-1 rounded-lg bg-muted/60" />
          <div className="h-10 w-36 rounded-lg bg-muted/60" />
        </div>

        <div className="mb-4 flex gap-2">
          {Array.from({ length: 4 }, (_, i) => `media-filter-${i}`).map(
            (key) => (
              <div
                key={key}
                className="h-7 w-20 rounded-full border border-border bg-muted/40"
              />
            ),
          )}
        </div>

        <MediaGridSkeleton />
      </div>
    </div>
  );
}
