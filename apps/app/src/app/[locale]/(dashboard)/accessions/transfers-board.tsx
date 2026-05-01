"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Input } from "@v1/ui/input";
import { useQuery } from "convex/react";
import { Search } from "lucide-react";
import { useDeferredValue, useMemo, useState } from "react";
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
        executed: "-",
        rejected: "-",
        cancelled: "-",
      };
    }

    return {
      pending: transferRequests.filter(
        (request) => request.status === "pending",
      ).length,
      executed: transferRequests.filter(
        (request) => request.status === "executed",
      ).length,
      rejected: transferRequests.filter(
        (request) => request.status === "rejected",
      ).length,
      cancelled: transferRequests.filter(
        (request) => request.status === "cancelled",
      ).length,
    };
  }, [transferRequests]);

  const pendingAccessions =
    accessions?.page.filter((item) => item.status === "pending").length ?? "-";

  if (transferRequests === undefined) {
    return (
      <div className="flex h-full w-full items-center justify-center px-6">
        <p className="text-muted-foreground">Loading transfers...</p>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col bg-background p-6">
      <div className="mb-6 flex items-end justify-between gap-6">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.24em] text-zinc-500">
            Accessions workbench
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white">
            Transfer review
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-zinc-500">
            Track incoming and outgoing custody movement before final
            accessioning adds objects to the catalog/archive.
          </p>
        </div>

        <div className="flex gap-4">
          <TransferStat label="Pending" value={stats.pending} />
          <TransferStat label="Executed" value={stats.executed} />
          <TransferStat label="Rejected" value={stats.rejected} />
          <TransferStat label="Cancelled" value={stats.cancelled} />
        </div>
      </div>

      <AccessionsWorkbenchNav
        activeView="transfers"
        pendingAccessions={pendingAccessions}
        pendingTransfers={stats.pending}
      />

      <div className="mb-6 flex items-center gap-3">
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <Input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search transfers"
            className="h-8 rounded-full border-zinc-800 bg-zinc-900 pl-9 text-xs text-zinc-200 placeholder:text-zinc-500"
          />
        </div>
      </div>

      <div className="flex-1 overflow-x-auto custom-scrollbar">
        <div className="flex h-full min-w-max gap-6 pb-4">
          <TransferKanbanColumn
            status="pending"
            title="Pending approval transferring object"
            searchQuery={deferredSearchQuery}
            transferRequests={transferRequests}
          />
          <TransferKanbanColumn
            status="executed"
            title="Executed transfers"
            searchQuery={deferredSearchQuery}
            transferRequests={transferRequests}
          />
          <TransferKanbanColumn
            status="rejected"
            title="Rejected transfers"
            searchQuery={deferredSearchQuery}
            transferRequests={transferRequests}
          />
          <TransferKanbanColumn
            status="cancelled"
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
      <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
        {label}
      </span>
      <span className="text-2xl font-semibold tracking-tight text-white">
        {value}
      </span>
    </div>
  );
}
