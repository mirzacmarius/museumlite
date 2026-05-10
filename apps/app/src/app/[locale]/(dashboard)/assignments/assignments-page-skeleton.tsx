const STAT_KEYS = ["pending", "cataloged", "week"];
const SECTION_KEYS = ["approvals", "modified", "cataloged"];
const CARD_KEYS = ["first", "second", "third", "fourth"];

export function AssignmentsPageSkeleton() {
  return (
    <div className="flex h-full w-full flex-col bg-background">
      <header className="sticky top-0 z-50 flex h-14 items-center justify-between border-b border-border bg-background/80 px-6 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="h-5 w-5 rounded bg-indigo-400/30" />
          <div className="h-5 w-32 rounded bg-muted/70" />
        </div>
        <div className="hidden items-center gap-6 sm:flex">
          {STAT_KEYS.map((key) => (
            <div key={key} className="flex items-center gap-2">
              <div className="h-6 w-6 rounded-full bg-muted/50" />
              <div className="h-3 w-20 rounded bg-muted/50" />
            </div>
          ))}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-screen-xl space-y-8">
          {SECTION_KEYS.map((sectionKey) => (
            <section key={sectionKey}>
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 rounded bg-muted/50" />
                  <div className="h-4 w-44 rounded bg-muted/60" />
                </div>
                <div className="h-3 w-20 rounded bg-muted/40" />
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {CARD_KEYS.map((key) => (
                  <div
                    key={`${sectionKey}-${key}`}
                    className="h-40 rounded-xl border border-border bg-muted/20"
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
