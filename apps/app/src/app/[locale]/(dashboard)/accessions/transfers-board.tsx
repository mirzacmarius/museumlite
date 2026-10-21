"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { useQuery } from "convex/react";
import { Search } from "lucide-react";
import { useDeferredValue, useState } from "react";
import { useI18n } from "@/locales/client";
import { AccessionsPageSkeleton } from "./accessions-page-skeleton";
import { TransferKanbanColumn } from "./transfer-kanban-column";

type TransfersBoardProps = {
  organizationId: Id<"organizations">;
};

export function TransfersBoard({ organizationId }: TransfersBoardProps) {
  const tRoot = useI18n();
  const [searchQuery, setSearchQuery] = useState("");
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const transferRequests = useQuery(api.objectMoves.listForOrganization, {
    organizationId,
    search: deferredSearchQuery || undefined,
  });
  // The whole board's counts, whatever the search, as the Transfers tab shows.
  const counts = useQuery(api.objectMoves.getBoardCounts, { organizationId });

  if (transferRequests === undefined) {
    return <AccessionsPageSkeleton actionsCount={1} statsCount={6} />;
  }

  return (
    <div className="flex size-full flex-col bg-background p-6">
      <div className="mb-6 flex min-h-[52px] flex-wrap items-center justify-between gap-6">
        <div className="flex flex-wrap gap-4">
          <TransferStat
            label={tRoot("accessions.stats.pending")}
            value={counts?.waitingForApproval ?? "-"}
          />
          <TransferStat
            label={tRoot(
              "untranslatedRecords.accessions.transfers.awaitingAcceptance",
            )}
            value={counts?.waitingForReceiver ?? "-"}
          />
          <TransferStat
            label={tRoot("loans.filters.incoming")}
            value={counts?.incoming ?? "-"}
          />
          <TransferStat
            label={tRoot("untranslatedRecords.accessions.transfer.executed")}
            value={counts?.received ?? "-"}
          />
          <TransferStat
            label={tRoot("accessions.status.rejected")}
            value={counts?.declined ?? "-"}
          />
          <TransferStat
            label={tRoot("loans.status.cancelled")}
            value={counts?.cancelled ?? "-"}
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
            stages={["waiting_for_sender"]}
            direction="outgoing"
            title={tRoot(
              "untranslatedRecords.accessions.transfer.pendingApproval",
            )}
            searchQuery={deferredSearchQuery}
            transferRequests={transferRequests}
          />
          <TransferKanbanColumn
            stages={["waiting_for_receiver"]}
            direction="outgoing"
            title={tRoot(
              "untranslatedRecords.accessions.transfer.awaitingReceiver",
            )}
            searchQuery={deferredSearchQuery}
            transferRequests={transferRequests}
          />
          <TransferKanbanColumn
            stages={["waiting_for_receiver"]}
            direction="incoming"
            title={tRoot(
              "untranslatedRecords.accessions.transfer.incomingRequests",
            )}
            searchQuery={deferredSearchQuery}
            transferRequests={transferRequests}
          />
          <TransferKanbanColumn
            stages={["received", "declined", "cancelled"]}
            title={tRoot("untranslatedRecords.accessions.transfer.transferLog")}
            searchQuery={deferredSearchQuery}
            transferRequests={transferRequests}
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
