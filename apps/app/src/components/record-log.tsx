"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { formatDate } from "@/lib/format-date";
import { useCurrentLocale } from "@/locales/client";

/** Rows a log column shows first, and how many each Show more adds. */
export const RECORD_LOG_PAGE_SIZE = 10;

/**
 * Finished records as a compact log, newest first. Inline-size containment
 * keeps long titles truncating inside a scroll area instead of widening it.
 */
export function RecordLog({ children }: { children: ReactNode }) {
  return (
    <ol className="flex flex-col divide-y divide-border/60 [contain:inline-size]">
      {children}
    </ol>
  );
}

interface RecordLogEntryProps {
  href: string;
  /** Record identifier shown in monospace above the title. */
  reference: string;
  /** The date the log is ordered by; omitted when not recorded. */
  date?: number;
  /** Whether the date carries a meaningful time of day for its tooltip. */
  showTime?: boolean;
  title: string;
  /** Secondary text after the title, dropped first when space runs out. */
  detail?: string;
}

/** One finished record as a two-line log row: identifier and date, then title. */
export function RecordLogEntry({
  href,
  reference,
  date,
  showTime = true,
  title,
  detail,
}: RecordLogEntryProps) {
  const locale = useCurrentLocale();
  const summary = detail ? `${title} · ${detail}` : title;
  const loggedAt = date === undefined ? undefined : new Date(date);

  return (
    <li>
      <Link
        href={href}
        className="group block rounded-md px-2 py-1.5 transition-colors hover:bg-accent/50"
      >
        <div className="flex items-baseline justify-between gap-2">
          <span
            className="min-w-0 truncate font-mono text-[10px] text-muted-foreground"
            title={reference}
          >
            {reference}
          </span>
          {loggedAt && (
            <time
              dateTime={loggedAt.toISOString()}
              title={
                showTime
                  ? formatDate(loggedAt, locale, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })
                  : undefined
              }
              className="shrink-0 text-[10px] text-muted-foreground"
            >
              {formatDate(loggedAt, locale, { dateStyle: "medium" })}
            </time>
          )}
        </div>
        <p className="truncate text-xs" title={summary}>
          <span className="font-medium text-foreground transition-colors group-hover:text-primary">
            {title}
          </span>
          {detail && (
            <span className="text-muted-foreground">
              {" · "}
              {detail}
            </span>
          )}
        </p>
      </Link>
    </li>
  );
}
