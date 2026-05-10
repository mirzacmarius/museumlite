const CATEGORY_KEYS = [
  "all",
  "approvals",
  "reminders",
  "alerts",
  "assignments",
  "system",
];
const NOTIFICATION_KEYS = [
  "first",
  "second",
  "third",
  "fourth",
  "fifth",
  "sixth",
];

export function NotificationsPageSkeleton() {
  return (
    <div className="flex h-full w-full flex-col gap-6">
      <div className="flex w-full flex-col gap-2">
        <div className="h-6 w-36 rounded bg-muted/70" />
        <div className="h-4 w-72 rounded bg-muted/50" />
      </div>

      <div className="grid h-10 w-full grid-cols-6 gap-1 rounded-lg bg-muted p-1">
        {CATEGORY_KEYS.map((key) => (
          <div key={key} className="rounded-md bg-background/60" />
        ))}
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-9 w-16 rounded-md bg-muted/60" />
          <div className="h-9 w-20 rounded-md bg-muted/50" />
        </div>
        <div className="h-9 w-32 rounded-md bg-muted/50" />
      </div>

      <div className="flex-1 space-y-2">
        {NOTIFICATION_KEYS.map((key) => (
          <div
            key={key}
            className="flex items-start gap-4 rounded-lg border border-border bg-card p-4"
          >
            <div className="h-8 w-8 rounded-full bg-muted/60" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="h-4 w-1/3 rounded bg-muted/70" />
              <div className="h-3 w-2/3 rounded bg-muted/50" />
              <div className="h-3 w-24 rounded bg-muted/40" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
