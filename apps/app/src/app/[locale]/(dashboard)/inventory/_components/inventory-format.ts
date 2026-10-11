import { formatDate } from "@/lib/format-date";

/** A recorded moment, in the app locale, with the time. */
export function formatMoment(timestamp: number, locale: string) {
  return formatDate(new Date(timestamp), locale, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}
