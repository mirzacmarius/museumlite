"use client";

import type { api } from "@v1/backend/convex/_generated/api";
import type { FunctionReturnType } from "convex/server";
import { RecordLogEntry } from "@/components/record-log";
import { useI18n, useScopedI18n } from "@/locales/client";
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

/** One approved accession as a log row: number and approval date, then title. */
export function ApprovedLogEntry({ accession, href }: ApprovedLogEntryProps) {
  const tRoot = useI18n();
  const t = useScopedI18n("accessions");
  const { title, detail } = accessionBoardText(
    accession,
    t("kanban.unknownSource"),
    (method) => formatAccessionMethodLabel(method, tRoot),
  );

  return (
    <RecordLogEntry
      href={href}
      reference={accession.accessionNumber}
      date={accession.approvedAt}
      title={title}
      detail={detail}
    />
  );
}
