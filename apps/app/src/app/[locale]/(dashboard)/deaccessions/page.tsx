"use client";

import { useOrganization } from "@/components/organization-provider";
import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { Input } from "@v1/ui/input";
import { ScrollArea } from "@v1/ui/scroll-area";
import { useQuery } from "convex/react";
import { format } from "date-fns";
import { Archive, Building2, Download, Plus, Search } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

export default function DeaccessionsPage() {
  const { currentOrganizationId, organizations, isLoading } = useOrganization();

  if (isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <p className="text-zinc-500">Loading...</p>
      </div>
    );
  }

  if (!organizations || organizations.length === 0) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-zinc-950 px-6 py-8">
        <div className="flex flex-col items-center gap-4 rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-8">
          <Building2 className="h-12 w-12 text-zinc-500" />
          <div className="text-center">
            <h3 className="text-lg font-semibold text-zinc-200">
              No Organization Found
            </h3>
            <p className="mt-2 text-sm text-zinc-500">
              You need to create an organization to manage deaccessions.
            </p>
          </div>
          <Button asChild>
            <Link href="/organizations/new">
              <Plus className="mr-2 h-4 w-4" />
              Create Organization
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  if (!currentOrganizationId) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-zinc-950 px-6 py-8">
        <div className="flex flex-col items-center gap-4 rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-8">
          <Archive className="h-12 w-12 text-zinc-500" />
          <div className="text-center">
            <h3 className="text-lg font-semibold text-zinc-200">
              Select an Organization
            </h3>
            <p className="mt-2 text-sm text-zinc-500">
              Please select an organization from the dropdown above to view
              deaccessions.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col bg-zinc-950">
      <DeaccessionTable organizationId={currentOrganizationId} />
    </div>
  );
}

function DeaccessionTable({
  organizationId,
}: {
  organizationId: Id<"organizations">;
}) {
  const [status, setStatus] = useState<
    "all" | "pending" | "approved" | "rejected"
  >("all");
  const [search, setSearch] = useState("");
  const [cursor, setCursor] = useState<string | null>(null);
  const prevFiltersRef = useRef({ status, search });

  useEffect(() => {
    if (
      prevFiltersRef.current.status !== status ||
      prevFiltersRef.current.search !== search
    ) {
      prevFiltersRef.current = { status, search };
      setCursor(null);
    }
  }, [status, search]);

  const deaccessions = useQuery(api.deaccessions.list, {
    organizationId,
    paginationOpts: { numItems: 50, cursor },
    status: status !== "all" ? status : undefined,
    search: search || undefined,
  });

  const pendingCount =
    deaccessions?.page.filter((d) => d.status === "pending").length ?? 0;
  const approvedCount =
    deaccessions?.page.filter((d) => d.status === "approved").length ?? 0;

  return (
    <div className="flex h-full flex-col p-6">
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h3 className="text-sm font-medium text-zinc-200">
            Deaccession Records
          </h3>
          <p className="text-xs text-zinc-500">
            Items permanently removed from collection.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex gap-6">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                Pending
              </span>
              <span className="text-xl font-semibold tracking-tight text-white">
                {pendingCount}
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                Approved
              </span>
              <span className="text-xl font-semibold tracking-tight text-white">
                {approvedCount}
              </span>
            </div>
          </div>
          <button
            type="button"
            className="flex items-center gap-1 text-xs text-zinc-400 transition-colors hover:text-white"
          >
            <Download className="h-3 w-3" />
            Export Report
          </button>
        </div>
      </div>

      <div className="mb-4 flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <Input
            placeholder="Search deaccessions..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full border-zinc-800 bg-zinc-900/50 pl-9 text-sm placeholder:text-zinc-600"
          />
        </div>
        <div className="flex gap-1 rounded-lg border border-zinc-800 bg-zinc-900/30 p-1">
          {(["all", "pending", "approved", "rejected"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatus(s)}
              className={`rounded px-3 py-1.5 text-xs font-medium transition-colors ${
                status === s
                  ? "bg-zinc-800 text-white"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900/20">
        <ScrollArea className="h-full">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-zinc-800 bg-zinc-900/50 font-medium text-zinc-500">
              <tr>
                <th className="px-4 py-3">Object</th>
                <th className="px-4 py-3">Disposal Date</th>
                <th className="px-4 py-3">Method</th>
                <th className="px-4 py-3">Reason</th>
                <th className="px-4 py-3 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {deaccessions === undefined && (
                <tr>
                  <td colSpan={5} className="px-4 py-16 text-center">
                    <p className="text-zinc-500">Loading deaccessions...</p>
                  </td>
                </tr>
              )}

              {deaccessions && deaccessions.page.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <Archive className="h-8 w-8 text-zinc-600" />
                      <p className="text-zinc-500">No deaccessions found</p>
                    </div>
                  </td>
                </tr>
              )}

              {deaccessions?.page.map((item) => (
                <DeaccessionRow key={item._id} item={item} />
              ))}
            </tbody>
          </table>
        </ScrollArea>
      </div>

      {deaccessions && !deaccessions.isDone && (
        <div className="mt-4 flex justify-center">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCursor(deaccessions.continueCursor)}
            className="border-zinc-800 text-zinc-400 hover:bg-zinc-800 hover:text-white"
          >
            Load More
          </Button>
        </div>
      )}
    </div>
  );
}

function DeaccessionRow({
  item,
}: {
  item: {
    _id: Id<"deaccessions">;
    deaccessionNumber: string;
    collectionId: Id<"collections">;
    dateDeaccessioned: number;
    reason: string;
    method: "sale" | "donation" | "destruction" | "transfer";
    status: "pending" | "approved" | "rejected";
    workflowStep?: number;
  };
}) {
  const collection = useQuery(api.collections.get, {
    collectionId: item.collectionId,
  });

  const getMethodDisplay = (method: string) => {
    switch (method) {
      case "sale":
        return "Sale / Auction";
      case "donation":
        return "Donation";
      case "destruction":
        return "Destruction (Witnessed)";
      case "transfer":
        return "Transfer";
      default:
        return method;
    }
  };

  const getReasonBadge = (reason: string, method: string) => {
    const lowerReason = reason.toLowerCase();
    if (
      lowerReason.includes("irreparable") ||
      lowerReason.includes("damaged") ||
      method === "destruction"
    ) {
      return (
        <span className="rounded border border-rose-500/20 bg-rose-500/10 px-1.5 py-0.5 text-rose-400">
          {reason.length > 30 ? `${reason.substring(0, 30)}...` : reason}
        </span>
      );
    }
    if (method === "sale") {
      return (
        <span className="rounded border border-emerald-500/20 bg-emerald-500/10 px-1.5 py-0.5 text-emerald-400">
          {reason.length > 30 ? `${reason.substring(0, 30)}...` : reason}
        </span>
      );
    }
    return (
      <span className="text-zinc-400">
        {reason.length > 40 ? `${reason.substring(0, 40)}...` : reason}
      </span>
    );
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <span className="rounded border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-amber-400">
            Pending
          </span>
        );
      case "approved":
        return (
          <span className="rounded border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-emerald-400">
            Approved
          </span>
        );
      case "rejected":
        return (
          <span className="rounded border border-rose-500/20 bg-rose-500/10 px-2 py-0.5 text-rose-400">
            Rejected
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <tr className="cursor-pointer transition-colors hover:bg-zinc-900/40">
      <td className="px-4 py-3">
        <Link href={`/deaccessions/${item._id}`} className="block">
          <div className="font-medium text-zinc-300">
            {collection?.title || item.deaccessionNumber}
          </div>
          <div className="text-[10px] text-zinc-500">
            {collection?.accessionNumber || "Loading..."}
          </div>
        </Link>
      </td>
      <td className="px-4 py-3 text-zinc-400">
        {format(new Date(item.dateDeaccessioned), "MMM d, yyyy")}
      </td>
      <td className="px-4 py-3 text-zinc-400">
        {getMethodDisplay(item.method)}
      </td>
      <td className="px-4 py-3">{getReasonBadge(item.reason, item.method)}</td>
      <td className="px-4 py-3 text-right">{getStatusBadge(item.status)}</td>
    </tr>
  );
}
