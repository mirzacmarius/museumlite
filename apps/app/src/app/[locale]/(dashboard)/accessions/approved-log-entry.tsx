"use client";

import type { api } from "@v1/backend/convex/_generated/api";
import type { FunctionReturnType } from "convex/server";
import Link from "next/link";
import { formatDate } from "@/lib/format-date";
import { useCurrentLocale, useI18n, useScopedI18n } from "@/locales/client";
import { formatAccessionMethodLabel } from "./[id]/_components/accession-detail-ui";

type BoardAccession = FunctionReturnType<
  typeof api.accessions.listBoardColumn
>["page"][number];

/**
 * Board headline and secondary line for an accession. The source is dropped
 * from the secondary line when it only repeats the title.
 */
export function accessionBoardText(
  accession: BoardAccession,
  unknownSource: string,
  methodLabel: (method: BoardAccession["method"]) => string,
) {
  const title = accession.draftTitle || accession.source || unknownSource;
  if (!accession.draftTitle) {
    return { title, detail: methodLabel(accession.method) };
  }
  if (accession.source === accession.draftTitle) {
    return { title, detail: undefined };
  }
  return { title, detail: accession.source };
}

interface ApprovedLogEntryProps {
  accession: BoardAccession;
  href: string;
}

/** One approved accession as a two-line log row: number and date, then title. */
export function ApprovedLogEntry({ accession, href }: ApprovedLogEntryProps) {
  const tRoot = useI18n();
  const t = useScopedI18n("accessions");
  const locale = useCurrentLocale();
  const { title, detail } = accessionBoardText(
    accession,
    t("kanban.unknownSource"),
    (method) => formatAccessionMethodLabel(method, tRoot),
  );
  const summary = detail ? `${title} · ${detail}` : title;
  const approvedAt =
    accession.approvedAt === undefined
      ? undefined
      : new Date(accession.approvedAt);

  return (
    <li>
      <Link
        href={href}
        className="group block rounded-md px-2 py-1.5 transition-colors hover:bg-accent/50"
      >
        <div className="flex items-baseline justify-between gap-2">
          <span className="font-mono text-[10px] text-muted-foreground">
            {accession.accessionNumber}
          </span>
          {approvedAt && (
            <time
              dateTime={approvedAt.toISOString()}
              title={formatDate(approvedAt, locale, {
                dateStyle: "medium",
                timeStyle: "short",
              })}
              className="shrink-0 text-[10px] text-muted-foreground"
            >
              {formatDate(approvedAt, locale, { dateStyle: "medium" })}
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
