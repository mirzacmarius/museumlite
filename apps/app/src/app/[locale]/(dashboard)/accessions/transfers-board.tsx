"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Input } from "@v1/ui/input";
import { useQuery } from "convex/react";
import { Search } from "lucide-react";
import { useDeferredValue, useMemo, useState } from "react";
import { AccessionsPageSkeleton } from "./accessions-page-skeleton";
import { AccessionsWorkbenchNav } from "./accessions-workbench-nav";
import { TransferKanbanColumn } from "./transfer-kanban-column";

type TransfersBoardProps = {
  organizationId: Id<"organizations">;
};

export function TransfersBoard({ organizationId }: TransfersBoardProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const transferRequests = useQuery(api.objectMoves.listForOrganization, {
    organizationId,
    search: deferredSearchQuery || undefined,
  });
  const accessions = useQuery(api.accessions.list, {
    organizationId,
    paginationOpts: { numItems: 100, cursor: null },
  });

  const stats = useMemo(() => {
    if (!transferRequests) {
      return {
        pending: "-",
        incoming: "-",
        executed: "-",
        rejected: "-",
        cancelled: "-",
      };
    }

    return {
      pending: transferRequests.filter(
        (request) =>
          request.status === "pending_source_approval" &&
          request.direction === "outgoing",
      ).length,
      incoming: transferRequests.filter(
        (request) =>
          request.status === "awaiting_acceptance" &&
          request.direction === "incoming",
      ).length,
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

  const pendingAccessions =
    accessions?.page.filter((item) => item.status === "pending").length ?? "-";

  if (transferRequests === undefined) {
    return (
      <AccessionsPageSkeleton
        actionsCount={1}
        showWorkbenchNav={true}
        statsCount={5}
      />
    );
  }

  return (
    <div className="flex h-full w-full flex-col bg-background p-6">
      <div className="mb-6 flex min-h-[52px] items-center justify-between gap-6">
        <div className="flex gap-4">
          <TransferStat label="Pending" value={stats.pending} />
          <TransferStat label="Incoming" value={stats.incoming} />
          <TransferStat label="Executed" value={stats.executed} />
          <TransferStat label="Rejected" value={stats.rejected} />
          <TransferStat label="Cancelled" value={stats.cancelled} />
        </div>

        <div className="flex items-center gap-3">
          <div className="group relative">
            <Search className="absolute left-2.5 top-2 size-3.5 text-muted-foreground transition-colors group-focus-within:text-foreground" />
            <Input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search transfers"
              className="w-64 rounded-md border-input bg-background/60 py-1.5 pl-8 pr-3 text-xs text-foreground transition-all placeholder:text-muted-foreground focus:border-ring focus:bg-background"
            />
          </div>
        </div>
      </div>

      <AccessionsWorkbenchNav
        activeView="transfers"
        pendingAccessions={pendingAccessions}
        pendingTransfers={stats.pending}
      />

      <div className="flex-1 overflow-x-auto custom-scrollbar">
        <div className="flex h-full min-w-max gap-6 pb-4">
          <TransferKanbanColumn
            status="pending_source_approval"
            direction="outgoing"
            title="Pending transfer approval"
            searchQuery={deferredSearchQuery}
            transferRequests={transferRequests}
          />
          <TransferKanbanColumn
            status="awaiting_acceptance"
            direction="incoming"
            title="Incoming transfer requests"
            searchQuery={deferredSearchQuery}
            transferRequests={transferRequests}
          />
          <TransferKanbanColumn
            status="executed"
            direction="outgoing"
            title="Executed transfers"
            searchQuery={deferredSearchQuery}
            transferRequests={transferRequests}
          />
          <TransferKanbanColumn
            status="rejected"
            direction="outgoing"
            title="Rejected transfers"
            searchQuery={deferredSearchQuery}
            transferRequests={transferRequests}
          />
          <TransferKanbanColumn
            status="cancelled"
            direction="outgoing"
            title="Cancelled transfers"
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
