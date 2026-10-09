"use client";

import {
  type EntryStatus,
  isOpenEntryStatus,
} from "@v1/backend/convex/utils/objectEntryValidators";
import { Badge } from "@v1/ui/badge";
import { cn } from "@v1/ui/utils";
import { useScopedI18n } from "@/locales/client";

const STATUS_STYLES: Record<EntryStatus, string> = {
  in_custody: "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  acquisition_review:
    "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  accessioned:
    "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  exited: "border-border bg-muted text-muted-foreground",
};

export function EntryStatusBadge({ status }: { status: EntryStatus }) {
  const t = useScopedI18n("objectEntries.status");
  return (
    <Badge
      variant="outline"
      className={cn("font-medium", STATUS_STYLES[status])}
    >
      {t(status)}
    </Badge>
  );
}

/** Earliest due date still relevant to an open entry. */
export function entryDueAt(entry: {
  status: EntryStatus;
  decisionDueAt?: number;
  returnDueAt?: number;
}) {
  if (!isOpenEntryStatus(entry.status)) return undefined;
  const dates = [entry.decisionDueAt, entry.returnDueAt].filter(
    (date): date is number => date !== undefined,
  );
  return dates.length > 0 ? Math.min(...dates) : undefined;
}
