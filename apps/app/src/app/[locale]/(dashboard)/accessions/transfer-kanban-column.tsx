"use client";

import type { api } from "@v1/backend/convex/_generated/api";
import { Button } from "@v1/ui/button";
import { ScrollArea } from "@v1/ui/scroll-area";
import type { FunctionReturnType } from "convex/server";
import {
  ArrowRightLeft,
  Ban,
  CheckCircle2,
  Clock3,
  ScrollText,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { ClientDateFns } from "@/components/client-date";
import {
  RECORD_LOG_PAGE_SIZE,
  RecordLog,
  RecordLogEntry,
} from "@/components/record-log";
import type { useI18n as useI18nType } from "@/locales/client";
import { useCurrentLocale, useI18n, useScopedI18n } from "@/locales/client";
import { boardStatus } from "./use-open-transfer-count";

type TransferRequest = FunctionReturnType<
  typeof api.objectMoves.listForOrganization
>[number];

type TransferStatus = TransferRequest["status"];
type TransferDirection = TransferRequest["direction"];
type Translator = ReturnType<typeof useI18nType>;

type TransferKanbanColumnProps = {
  /** The statuses the column lists; finished ones make it the transfer log. */
  statuses: readonly TransferStatus[];
  /** Omitted, the column lists transfers sent and received. */
  direction?: TransferDirection;
  title: string;
  searchQuery: string;
  transferRequests: TransferRequest[];
};

const statusStyles: Record<
  TransferStatus,
  {
    badge: string;
    card: string;
    icon: typeof Clock3;
  }
> = {
  pending: {
    badge: "bg-sky-500/15 text-sky-300",
    card: "border-sky-500/30 bg-[linear-gradient(180deg,rgba(14,165,233,0.14),rgba(9,9,11,0.92))]",
    icon: Clock3,
  },
  pending_source_approval: {
    badge: "bg-sky-500/15 text-sky-300",
    card: "border-sky-500/30 bg-[linear-gradient(180deg,rgba(14,165,233,0.14),rgba(9,9,11,0.92))]",
    icon: Clock3,
  },
  approved_for_transfer: {
    badge: "bg-amber-500/15 text-amber-300",
    card: "border-amber-500/30 bg-[linear-gradient(180deg,rgba(245,158,11,0.12),rgba(9,9,11,0.92))]",
    icon: Clock3,
  },
  awaiting_acceptance: {
    badge: "bg-amber-500/15 text-amber-300",
    card: "border-amber-500/30 bg-[linear-gradient(180deg,rgba(245,158,11,0.12),rgba(9,9,11,0.92))]",
    icon: Clock3,
  },
  executed: {
    badge: "bg-emerald-500/15 text-emerald-300",
    card: "border-emerald-500/30 bg-[linear-gradient(180deg,rgba(16,185,129,0.12),rgba(9,9,11,0.92))]",
    icon: CheckCircle2,
  },
  rejected: {
    badge: "bg-rose-500/15 text-rose-300",
    card: "border-rose-500/30 bg-[linear-gradient(180deg,rgba(244,63,94,0.12),rgba(9,9,11,0.92))]",
    icon: XCircle,
  },
  cancelled: {
    badge: "bg-zinc-500/15 text-zinc-300",
    card: "border-zinc-700 bg-[linear-gradient(180deg,rgba(63,63,70,0.18),rgba(9,9,11,0.92))]",
    icon: Ban,
  },
};

const statusLabels: Record<TransferStatus, Parameters<Translator>[0]> = {
  pending: "untranslatedRecords.accessions.transfers.awaitingApproval",
  pending_source_approval:
    "untranslatedRecords.accessions.transfers.pendingApproval",
  approved_for_transfer: "untranslatedRecords.accessions.transfers.approved",
  awaiting_acceptance:
    "untranslatedRecords.accessions.transfers.awaitingAcceptance",
  executed: "untranslatedRecords.accessions.transfers.executed",
  rejected: "untranslatedRecords.accessions.transfers.rejected",
  cancelled: "untranslatedRecords.accessions.transfers.cancelled",
};

function getTransferEmptyMessage(
  status: TransferStatus,
  direction: TransferDirection | undefined,
  tRoot: Translator,
): string {
  switch (status) {
    case "pending":
    case "pending_source_approval":
      return tRoot("untranslatedRecords.accessions.transfers.empty.pending");
    case "approved_for_transfer":
      return tRoot("untranslatedRecords.accessions.transfers.empty.approved");
    case "awaiting_acceptance":
      return direction === "incoming"
        ? tRoot("untranslatedRecords.accessions.transfers.empty.incoming")
        : tRoot(
            "untranslatedRecords.accessions.transfers.empty.awaitingReceiver",
          );
    case "executed":
    case "rejected":
    case "cancelled":
      return tRoot("untranslatedRecords.accessions.transfers.empty.log");
  }
}

/** Finished transfers read as a log of outcomes rather than as cards. */
const LOG_STATUSES = new Set<TransferStatus>([
  "executed",
  "rejected",
  "cancelled",
]);

const LOG_STYLE = {
  badge: "bg-zinc-500/15 text-zinc-300",
  icon: ScrollText,
};

/** When the transfer was executed, rejected or cancelled. */
function decidedAt(request: TransferRequest) {
  return (
    request.targetReviewedAt ??
    request.sourceReviewedAt ??
    request.reviewedAt ??
    request.requestedAt
  );
}

/**
 * Where a transfer went or came from, otherwise why it was rejected or
 * cancelled. A receiver's decline says who declined.
 */
function logDetail(
  request: TransferRequest,
  tMoves: ReturnType<typeof useScopedI18n<"moveRequests">>,
) {
  if (request.status === "executed") {
    return request.direction === "incoming"
      ? tMoves("receivedFrom", { organization: request.sourceOrganizationName })
      : tMoves("sentTo", { organization: request.targetOrganizationName });
  }
  if (request.status === "rejected" && request.targetReviewedAt !== undefined) {
    const declined = tMoves("declinedBy", {
      organization: request.targetOrganizationName,
    });
    return request.targetReviewNotes
      ? `${declined}: ${request.targetReviewNotes}`
      : declined;
  }
  return request.sourceReviewNotes ?? request.targetOrganizationName;
}

function newestDecisionFirst(left: TransferRequest, right: TransferRequest) {
  return (
    decidedAt(right) - decidedAt(left) ||
    right.requestedAt - left.requestedAt ||
    left._id.localeCompare(right._id)
  );
}

export function TransferKanbanColumn({
  statuses,
  direction,
  title,
  searchQuery,
  transferRequests,
}: TransferKanbanColumnProps) {
  const tRoot = useI18n();
  const tMoves = useScopedI18n("moveRequests");
  const locale = useCurrentLocale();
  const isLog = statuses.every((status) => LOG_STATUSES.has(status));
  const firstStatus = statuses[0] ?? "pending_source_approval";
  const emptyStyle = isLog ? LOG_STYLE : statusStyles[firstStatus];
  const EmptyIcon = emptyStyle.icon;
  const [shownLog, setShownLog] = useState({
    search: searchQuery,
    length: RECORD_LOG_PAGE_SIZE,
  });
  const logLength =
    shownLog.search === searchQuery ? shownLog.length : RECORD_LOG_PAGE_SIZE;

  const filteredRequests = transferRequests.filter((request) => {
    if (
      !statuses.includes(boardStatus(request)) ||
      (direction !== undefined && request.direction !== direction)
    ) {
      return false;
    }

    if (!searchQuery) {
      return true;
    }

    const search = searchQuery.toLowerCase();
    return (
      request.collectionTitle.toLowerCase().includes(search) ||
      request.sourceAccessionNumber.toLowerCase().includes(search) ||
      // The other organization: the viewer's own name matches every row.
      (request.direction === "incoming"
        ? request.sourceOrganizationName
        : request.targetOrganizationName
      )
        .toLowerCase()
        .includes(search) ||
      request.requestedByName.toLowerCase().includes(search) ||
      request.reason.toLowerCase().includes(search) ||
      request.requestedAccessionNumber?.toLowerCase().includes(search) ||
      request.finalAccessionNumber?.toLowerCase().includes(search) ||
      false
    );
  });
  const logEntries = isLog
    ? filteredRequests.toSorted(newestDecisionFirst)
    : [];

  return (
    <div className="flex w-80 flex-shrink-0 flex-col">
      <div className="mb-2 flex items-center justify-between gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">
        <span>{title}</span>
        <span className="shrink-0 rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] normal-case tracking-normal text-zinc-500">
          {isLog
            ? tRoot("listState.shownOfTotal", {
                shown: Math.min(logLength, logEntries.length),
                total: logEntries.length,
              })
            : filteredRequests.length}
        </span>
      </div>

      <div className="flex-1 rounded-xl border border-border/60 bg-card">
        <ScrollArea className="h-full max-h-[calc(100vh-280px)]">
          <div className="flex flex-col gap-2 p-2">
            {filteredRequests.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className={`rounded-full p-2 ${emptyStyle.badge}`}>
                  <EmptyIcon className="size-4" />
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  {getTransferEmptyMessage(firstStatus, direction, tRoot)}
                </p>
              </div>
            ) : isLog ? (
              <RecordLog>
                {logEntries.slice(0, logLength).map((request) => (
                  <RecordLogEntry
                    key={request._id}
                    href={`/objects/move-requests/${request._id}`}
                    reference={request.sourceAccessionNumber}
                    date={decidedAt(request)}
                    title={request.collectionTitle}
                    detail={logDetail(request, tMoves)}
                    status={{
                      label: tRoot(statusLabels[request.status]),
                      className: statusStyles[request.status].badge,
                    }}
                  />
                ))}
              </RecordLog>
            ) : (
              filteredRequests.map((request) => (
                <Link
                  key={request._id}
                  href={`/objects/move-requests/${request._id}`}
                  className={`group block rounded-xl border p-3 transition-colors ${statusStyles[boardStatus(request)].card}`}
                >
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.22em] text-zinc-400">
                        <ArrowRightLeft className="size-3" />
                        {tRoot("accessions.form.methods.transfer")}
                      </div>
                      <p className="mt-2 text-sm font-medium text-white transition-colors group-hover:text-sky-200">
                        {request.collectionTitle}
                      </p>
                      <p className="mt-1 font-mono text-[11px] text-zinc-400">
                        {request.sourceAccessionNumber}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-2 py-1 text-[10px] font-medium ${statusStyles[boardStatus(request)].badge}`}
                    >
                      {tRoot(statusLabels[boardStatus(request)])}
                    </span>
                  </div>

                  <div className="space-y-2 text-xs text-zinc-300">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-zinc-500">
                        {tRoot(
                          "untranslatedRecords.accessions.transfer.receiver",
                        )}
                      </span>
                      <span className="text-right">
                        {request.targetOrganizationName}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-zinc-500">
                        {tRoot("library.acquisitions.labels.requestedBy")}
                      </span>
                      <span className="text-right">
                        {request.requestedByName}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-zinc-500">
                        {tRoot(
                          "untranslatedRecords.accessions.transfer.requested",
                        )}
                      </span>
                      <span className="text-right">
                        <ClientDateFns
                          timestamp={request.requestedAt}
                          format="MMM d, yyyy"
                          locale={locale}
                        />
                      </span>
                    </div>
                  </div>

                  <div className="mt-3 rounded-lg border border-white/10 bg-zinc-950/20 px-3 py-2">
                    <p className="text-[10px] uppercase tracking-[0.22em] text-zinc-500">
                      {tRoot(
                        "untranslatedRecords.accessions.transfer.handling",
                      )}
                    </p>
                    <p className="mt-1 text-xs text-zinc-200">
                      {tMoves("accession.chosenByReceiver")}
                    </p>
                  </div>

                  {request.targetReviewNotes || request.sourceReviewNotes ? (
                    <div className="mt-3 rounded-lg border border-white/10 bg-zinc-950/20 px-3 py-2">
                      <p className="text-[10px] uppercase tracking-[0.22em] text-zinc-500">
                        {tRoot(
                          "untranslatedRecords.accessions.transfer.reviewNotes",
                        )}
                      </p>
                      <p className="mt-1 line-clamp-3 text-xs text-zinc-300">
                        {request.targetReviewNotes ?? request.sourceReviewNotes}
                      </p>
                    </div>
                  ) : null}
                </Link>
              ))
            )}
            {logEntries.length > logLength ? (
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-xs"
                onClick={() =>
                  setShownLog({
                    search: searchQuery,
                    length: logLength + RECORD_LOG_PAGE_SIZE,
                  })
                }
              >
                {tRoot("listState.showMore")}
              </Button>
            ) : null}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
