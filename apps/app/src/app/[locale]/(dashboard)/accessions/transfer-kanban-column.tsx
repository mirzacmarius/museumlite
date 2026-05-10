"use client";

import { formatDateFns } from "@/lib/format-date";
import { useCurrentLocale } from "@/locales/client";
import type { api } from "@v1/backend/convex/_generated/api";
import { ScrollArea } from "@v1/ui/scroll-area";
import type { FunctionReturnType } from "convex/server";
import {
  ArrowRightLeft,
  Ban,
  CheckCircle2,
  Clock3,
  XCircle,
} from "lucide-react";
import Link from "next/link";

type TransferRequest = FunctionReturnType<
  typeof api.objectMoves.listForOrganization
>[number];

type TransferStatus = TransferRequest["status"];
type TransferDirection = TransferRequest["direction"];

type TransferKanbanColumnProps = {
  status: TransferStatus;
  direction: TransferDirection;
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
    empty: string;
  }
> = {
  pending: {
    badge: "bg-sky-500/15 text-sky-300",
    card: "border-sky-500/30 bg-[linear-gradient(180deg,rgba(14,165,233,0.14),rgba(9,9,11,0.92))]",
    icon: Clock3,
    empty: "No transfer approvals are waiting right now.",
  },
  pending_source_approval: {
    badge: "bg-sky-500/15 text-sky-300",
    card: "border-sky-500/30 bg-[linear-gradient(180deg,rgba(14,165,233,0.14),rgba(9,9,11,0.92))]",
    icon: Clock3,
    empty: "No transfer approvals are waiting right now.",
  },
  approved_for_transfer: {
    badge: "bg-amber-500/15 text-amber-300",
    card: "border-amber-500/30 bg-[linear-gradient(180deg,rgba(245,158,11,0.12),rgba(9,9,11,0.92))]",
    icon: Clock3,
    empty: "No approved transfers are waiting right now.",
  },
  awaiting_acceptance: {
    badge: "bg-amber-500/15 text-amber-300",
    card: "border-amber-500/30 bg-[linear-gradient(180deg,rgba(245,158,11,0.12),rgba(9,9,11,0.92))]",
    icon: Clock3,
    empty: "No incoming transfer requests are waiting right now.",
  },
  executed: {
    badge: "bg-emerald-500/15 text-emerald-300",
    card: "border-emerald-500/30 bg-[linear-gradient(180deg,rgba(16,185,129,0.12),rgba(9,9,11,0.92))]",
    icon: CheckCircle2,
    empty: "No executed transfers match this search.",
  },
  rejected: {
    badge: "bg-rose-500/15 text-rose-300",
    card: "border-rose-500/30 bg-[linear-gradient(180deg,rgba(244,63,94,0.12),rgba(9,9,11,0.92))]",
    icon: XCircle,
    empty: "No rejected transfers match this search.",
  },
  cancelled: {
    badge: "bg-zinc-500/15 text-zinc-300",
    card: "border-zinc-700 bg-[linear-gradient(180deg,rgba(63,63,70,0.18),rgba(9,9,11,0.92))]",
    icon: Ban,
    empty: "No cancelled transfers match this search.",
  },
};

const statusLabels: Record<TransferStatus, string> = {
  pending: "Awaiting approval",
  pending_source_approval: "Pending transfer approval",
  approved_for_transfer: "Approved for transfer",
  awaiting_acceptance: "Awaiting acceptance",
  executed: "Transfer executed",
  rejected: "Rejected",
  cancelled: "Cancelled",
};

function getAccessionHandlingSummary(request: TransferRequest) {
  switch (request.accessionMode) {
    case "keep":
      return "Keep current accession number";
    case "auto":
      return "Generate a new accession number";
    case "manual":
      return request.requestedAccessionNumber
        ? `Requested accession: ${request.requestedAccessionNumber}`
        : "Manual accession requested";
    default:
      return request.accessionMode;
  }
}

export function TransferKanbanColumn({
  status,
  direction,
  title,
  searchQuery,
  transferRequests,
}: TransferKanbanColumnProps) {
  const locale = useCurrentLocale();
  const style = statusStyles[status];
  const Icon = style.icon;

  const filteredRequests = transferRequests.filter((request) => {
    if (request.status !== status || request.direction !== direction) {
      return false;
    }

    if (!searchQuery) {
      return true;
    }

    const search = searchQuery.toLowerCase();
    return (
      request.collectionTitle.toLowerCase().includes(search) ||
      request.sourceAccessionNumber.toLowerCase().includes(search) ||
      request.targetOrganizationName.toLowerCase().includes(search) ||
      request.requestedByName.toLowerCase().includes(search) ||
      request.reason.toLowerCase().includes(search) ||
      request.requestedAccessionNumber?.toLowerCase().includes(search) ||
      request.finalAccessionNumber?.toLowerCase().includes(search) ||
      false
    );
  });

  return (
    <div className="flex w-80 flex-shrink-0 flex-col">
      <div className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-zinc-400">
        <span>{title}</span>
        <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-500">
          {filteredRequests.length}
        </span>
      </div>

      <div className="flex-1 rounded-xl border border-border/60 bg-card">
        <ScrollArea className="h-full max-h-[calc(100vh-280px)]">
          <div className="flex flex-col gap-2 p-2">
            {filteredRequests.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className={`rounded-full p-2 ${style.badge}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  {style.empty}
                </p>
              </div>
            ) : (
              filteredRequests.map((request) => (
                <Link
                  key={request._id}
                  href={`/objects/move-requests/${request._id}`}
                  className={`group block rounded-xl border p-3 transition-colors ${style.card}`}
                >
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.22em] text-zinc-400">
                        <ArrowRightLeft className="h-3 w-3" />
                        Transfer
                      </div>
                      <p className="mt-2 text-sm font-medium text-white transition-colors group-hover:text-sky-200">
                        {request.collectionTitle}
                      </p>
                      <p className="mt-1 font-mono text-[11px] text-zinc-400">
                        {request.sourceAccessionNumber}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-2 py-1 text-[10px] font-medium ${style.badge}`}
                    >
                      {statusLabels[status]}
                    </span>
                  </div>

                  <div className="space-y-2 text-xs text-zinc-300">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-zinc-500">Receiver</span>
                      <span className="text-right">
                        {request.targetOrganizationName}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-zinc-500">Requested by</span>
                      <span className="text-right">
                        {request.requestedByName}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-zinc-500">Requested</span>
                      <span className="text-right">
                        {formatDateFns(
                          new Date(request.requestedAt),
                          "MMM d, yyyy",
                          locale,
                        )}
                      </span>
                    </div>
                  </div>

                  <div className="mt-3 rounded-lg border border-white/10 bg-black/20 px-3 py-2">
                    <p className="text-[10px] uppercase tracking-[0.22em] text-zinc-500">
                      Accession handling
                    </p>
                    <p className="mt-1 text-xs text-zinc-200">
                      {getAccessionHandlingSummary(request)}
                    </p>
                  </div>

                  {request.targetReviewNotes || request.sourceReviewNotes ? (
                    <div className="mt-3 rounded-lg border border-white/10 bg-black/20 px-3 py-2">
                      <p className="text-[10px] uppercase tracking-[0.22em] text-zinc-500">
                        Review notes
                      </p>
                      <p className="mt-1 line-clamp-3 text-xs text-zinc-300">
                        {request.targetReviewNotes ?? request.sourceReviewNotes}
                      </p>
                    </div>
                  ) : null}
                </Link>
              ))
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
