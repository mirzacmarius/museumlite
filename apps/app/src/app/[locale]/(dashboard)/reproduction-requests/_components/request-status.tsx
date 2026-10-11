"use client";

import type { ReproductionStatus } from "@v1/backend/convex/utils/reproductionRequestValidators";
import { Badge } from "@v1/ui/badge";
import { CALENDAR_DATE_OPTIONS, formatDate } from "@/lib/format-date";
import { useCurrentLocale, useScopedI18n } from "@/locales/client";

export function RequestStatusBadge({ status }: { status: ReproductionStatus }) {
  const t = useScopedI18n("reproductionRequests.statuses");
  return (
    <Badge
      variant={
        status === "approved"
          ? "default"
          : status === "open"
            ? "secondary"
            : "outline"
      }
    >
      {t(status)}
    </Badge>
  );
}

/** Formats stored timestamps as the reader's local date. */
export function useRequestDate() {
  const locale = useCurrentLocale();
  return (timestamp: number) =>
    formatDate(new Date(timestamp), locale, { dateStyle: "medium" });
}

/** Formats a timestamp with its time, for delivery attempts and uses. */
export function useRequestDateTime() {
  const locale = useCurrentLocale();
  return (timestamp: number) =>
    formatDate(new Date(timestamp), locale, {
      dateStyle: "medium",
      timeStyle: "short",
    });
}

/** Formats a calendar date stored at a UTC day boundary as that day. */
export function useCalendarDate() {
  const locale = useCurrentLocale();
  return (timestamp: number) =>
    formatDate(new Date(timestamp), locale, CALENDAR_DATE_OPTIONS);
}
