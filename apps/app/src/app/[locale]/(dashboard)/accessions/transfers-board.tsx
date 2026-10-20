"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { useQuery } from "convex/react";
import { Search } from "lucide-react";
import { parseAsString, useQueryState } from "nuqs";
import { useDeferredValue, useMemo, useState } from "react";
import { useI18n } from "@/locales/client";
import { AccessionsPageSkeleton } from "./accessions-page-skeleton";
import { TransferKanbanColumn } from "./transfer-kanban-column";
import {
  countIncomingTransfers,
  countPendingTransfers,
} from "./use-open-transfer-count";

type TransfersBoardProps = {
  organizationId: Id<"organizations">;
};

export function TransfersBoard({ organizationId }: TransfersBoardProps) {
  const tRoot = useI18n();
  const [statusFilter] = useQueryState("status", parseAsString.withDefault(""));
  const [searchQuery, setSearchQuery] = useState("");
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const transferRequests = useQuery(api.objectMoves.listForOrganization, {
    organizationId,
    search: deferredSearchQuery || undefined,
  });

  const stats = useMemo(() => {
    if (!transferRequests) {
      return {
        pending: "-",
        awaitingReceiver: "-",
        incoming: "-",
        executed: "-",
        rejected: "-",
        cancelled: "-",
      };
    }

    return {
      pending: countPendingTransfers(transferRequests),
      awaitingReceiver: transferRequests.filter(
        (request) =>
          request.status === "awaiting_acceptance" &&
          request.direction === "outgoing",
      ).length,
      incoming: countIncomingTransfers(transferRequests),
      executed: transferRequests.filter(
        (request) =>
          request.status === "executed" && request.direction === "outgoing",
      ).length,
      rejected: transferRequests.filter(
        (request) =>
          request.status === "rejected" && request.direction === "outgoing",
      ).length,
      cancelled: transferRequests.filter(
        (request) =>
          request.status === "cancelled" && request.direction === "outgoing",
      ).length,
    };
  }, [transferRequests]);

  if (transferRequests === undefined) {
    return <AccessionsPageSkeleton actionsCount={1} statsCount={6} />;
  }

  const visibleRequests = statusFilter
    ? transferRequests.filter(
        (request) =>
          request.status === statusFilter && request.direction === "outgoing",
      )
    : transferRequests;

  return (
    <div className="flex size-full flex-col bg-background p-6">
      <div className="mb-6 flex min-h-[52px] flex-wrap items-center justify-between gap-6">
        <div className="flex flex-wrap gap-4">
          <TransferStat
            label={tRoot("accessions.stats.pending")}
            value={stats.pending}
          />
          <TransferStat
            label={tRoot(
              "untranslatedRecords.accessions.transfers.awaitingAcceptance",
            )}
            value={stats.awaitingReceiver}
          />
          <TransferStat
            label={tRoot("loans.filters.incoming")}
            value={stats.incoming}
          />
          <TransferStat
            label={tRoot("untranslatedRecords.accessions.transfer.executed")}
            value={stats.executed}
          />
          <TransferStat
            label={tRoot("accessions.status.rejected")}
            value={stats.rejected}
          />
          <TransferStat
            label={tRoot("loans.status.cancelled")}
            value={stats.cancelled}
          />
        </div>

        <div className="flex items-center gap-3">
          <div className="group relative">
            <Search className="absolute left-2.5 top-2 size-3.5 text-muted-foreground transition-colors group-focus-within:text-foreground" />
            <input
              type="search"
              aria-label={tRoot(
                "untranslatedRecords.accessions.transfer.search",
              )}
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder={tRoot(
                "untranslatedRecords.accessions.transfer.search",
              )}
              className="w-64 rounded-md border border-input bg-background/60 py-1.5 pl-8 pr-3 text-xs text-foreground transition-all placeholder:text-muted-foreground focus:border-ring focus:bg-background focus:outline-none"
            />
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-x-auto custom-scrollbar">
        <div className="flex h-full min-w-max gap-6 pb-4">
          <TransferKanbanColumn
            statuses={["pending_source_approval"]}
            direction="outgoing"
            title={tRoot(
              "untranslatedRecords.accessions.transfer.pendingApproval",
            )}
            searchQuery={deferredSearchQuery}
            transferRequests={visibleRequests}
          />
          <TransferKanbanColumn
            statuses={["awaiting_acceptance"]}
            direction="outgoing"
            title={tRoot(
              "untranslatedRecords.accessions.transfer.awaitingReceiver",
            )}
            searchQuery={deferredSearchQuery}
            transferRequests={visibleRequests}
          />
          <TransferKanbanColumn
            statuses={["awaiting_acceptance"]}
            direction="incoming"
            title={tRoot(
              "untranslatedRecords.accessions.transfer.incomingRequests",
            )}
            searchQuery={deferredSearchQuery}
            transferRequests={visibleRequests}
          />
          <TransferKanbanColumn
            statuses={["executed", "rejected", "cancelled"]}
            direction="outgoing"
            title={tRoot("untranslatedRecords.accessions.transfer.transferLog")}
            searchQuery={deferredSearchQuery}
            transferRequests={visibleRequests}
          />
        </div>
      </div>
    </div>
  );
}

function TransferStat({
  label,
  value,
}: {
  label: string;
  value: number | string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="text-2xl font-semibold tracking-tight text-foreground">
        {value}
      </span>
    </div>
  );
}
