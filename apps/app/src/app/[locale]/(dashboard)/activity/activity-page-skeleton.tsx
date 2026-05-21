const ACTIVITY_FILTER_SKELETON_KEYS = [
  "all",
  "objects",
  "accessions",
  "loans",
  "locations",
  "settings",
];
const ACTIVITY_ROW_SKELETON_KEYS = [
  "created",
  "updated",
  "moved",
  "approved",
  "assigned",
  "imported",
  "exported",
  "archived",
  "reviewed",
];

export function ActivityPageSkeleton() {
  return (
    <div className="flex size-full bg-zinc-950 px-6 py-8">
      <div className="z-10 mx-auto flex size-full max-w-screen-xl gap-12">
        <div className="hidden w-64 shrink-0 flex-col md:flex">
          <div className="rounded-lg border border-white/10 bg-zinc-950 p-4">
            <div className="mb-4 h-5 w-20 rounded bg-white/15" />
            <div className="space-y-2">
              {ACTIVITY_FILTER_SKELETON_KEYS.map((key) => (
                <div key={key} className="h-9 rounded-md bg-white/10" />
              ))}
            </div>
          </div>
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="mb-6 flex items-center justify-between">
            <div className="space-y-2">
              <div className="h-6 w-32 rounded bg-white/15" />
              <div className="h-4 w-56 rounded bg-white/10" />
            </div>
            <div className="h-9 w-28 rounded-md bg-white/10" />
          </div>
          <div className="space-y-3">
            {ACTIVITY_ROW_SKELETON_KEYS.map((key) => (
              <div
                key={key}
                className="flex items-start gap-4 rounded-lg border border-white/10 bg-white/[0.03] p-4"
              >
                <div className="size-9 rounded-full bg-white/10" />
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="h-4 w-2/3 rounded bg-white/15" />
                  <div className="h-3 w-1/3 rounded bg-white/10" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
