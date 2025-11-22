"use client";

import { useOrganization } from "@/components/organization-provider";
import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { Input } from "@v1/ui/input";
import { useQuery } from "convex/react";
import { format } from "date-fns";
import { Archive, CheckCircle, Clock, Search, XCircle } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

export default function DeaccessionsPage() {
  const { currentOrganizationId } = useOrganization();

  if (!currentOrganizationId) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-secondary px-6 py-8 dark:bg-black">
        <div className="flex flex-col items-center gap-4">
          <Archive className="h-12 w-12 text-muted-foreground" />
          <p className="text-muted-foreground">
            Please select an organization to view deaccessions
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full bg-secondary px-6 dark:bg-black">
      <div className="z-10 mx-auto flex h-full w-full max-w-screen-xl gap-12">
        <div className="flex w-full flex-col rounded-lg border border-border bg-card dark:bg-black">
          <DeaccessionsList organizationId={currentOrganizationId} />
        </div>
      </div>
    </div>
  );
}

function DeaccessionsList({
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

  // Reset cursor when filters change
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

  // Status badge helper
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <span className="inline-flex items-center rounded-full bg-blue-500/10 px-2.5 py-0.5 text-xs font-medium text-blue-600">
            <Clock className="mr-1 h-3 w-3" />
            Pending
          </span>
        );
      case "approved":
        return (
          <span className="inline-flex items-center rounded-full bg-green-500/10 px-2.5 py-0.5 text-xs font-medium text-green-600">
            <CheckCircle className="mr-1 h-3 w-3" />
            Approved
          </span>
        );
      case "rejected":
        return (
          <span className="inline-flex items-center rounded-full bg-red-500/10 px-2.5 py-0.5 text-xs font-medium text-red-600">
            <XCircle className="mr-1 h-3 w-3" />
            Rejected
          </span>
        );
    }
  };

  const getMethodBadge = (method: string) => {
    return (
      <span className="inline-flex items-center rounded-md bg-secondary px-2 py-0.5 text-xs font-medium">
        {method.charAt(0).toUpperCase() + method.slice(1)}
      </span>
    );
  };

  return (
    <>
      {/* Header */}
      <div className="flex w-full items-center justify-between p-6">
        <div className="flex flex-col gap-2">
          <h2 className="text-xl font-medium text-primary">Deaccessions</h2>
          <p className="text-sm text-primary/60">
            Track and manage deaccessioned objects
          </p>
        </div>
      </div>

      <div className="flex w-full px-6">
        <div className="w-full border-b border-border" />
      </div>

      {/* Status Tabs */}
      <div className="flex w-full gap-2 border-b border-border px-6">
        <button
          type="button"
          onClick={() => setStatus("all")}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            status === "all"
              ? "border-b-2 border-primary text-primary"
              : "text-muted-foreground hover:text-primary"
          }`}
        >
          All
        </button>
        <button
          type="button"
          onClick={() => setStatus("pending")}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            status === "pending"
              ? "border-b-2 border-primary text-primary"
              : "text-muted-foreground hover:text-primary"
          }`}
        >
          Pending
        </button>
        <button
          type="button"
          onClick={() => setStatus("approved")}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            status === "approved"
              ? "border-b-2 border-primary text-primary"
              : "text-muted-foreground hover:text-primary"
          }`}
        >
          Approved
        </button>
        <button
          type="button"
          onClick={() => setStatus("rejected")}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            status === "rejected"
              ? "border-b-2 border-primary text-primary"
              : "text-muted-foreground hover:text-primary"
          }`}
        >
          Rejected
        </button>
      </div>

      {/* Search */}
      <div className="border-b border-border p-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by deaccession number, reason, collection..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* List */}
      <div className="p-6">
        {deaccessions === undefined && (
          <div className="flex h-64 items-center justify-center">
            <p className="text-muted-foreground">Loading...</p>
          </div>
        )}

        {deaccessions && deaccessions.page.length === 0 && (
          <div className="flex h-64 flex-col items-center justify-center gap-4">
            <Archive className="h-12 w-12 text-muted-foreground" />
            <p className="text-muted-foreground">No deaccessions found</p>
          </div>
        )}

        {deaccessions && deaccessions.page.length > 0 && (
          <div className="space-y-4">
            {deaccessions.page.map((item) => (
              <DeaccessionListItem
                key={item._id}
                item={item}
                getStatusBadge={getStatusBadge}
                getMethodBadge={getMethodBadge}
              />
            ))}
          </div>
        )}

        {deaccessions && !deaccessions.isDone && (
          <div className="mt-6 flex justify-center">
            <Button
              variant="outline"
              onClick={() => setCursor(deaccessions.continueCursor)}
            >
              Load More
            </Button>
          </div>
        )}

        {deaccessions && deaccessions.page.length > 0 && (
          <div className="mt-4 text-center text-sm text-muted-foreground">
            Showing {deaccessions.page.length}{" "}
            {deaccessions.isDone ? "items" : "items (more available)"}
          </div>
        )}
      </div>
    </>
  );
}

function DeaccessionListItem({
  item,
  getStatusBadge,
  getMethodBadge,
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
  getStatusBadge: (status: string) => React.ReactNode;
  getMethodBadge: (method: string) => React.ReactNode;
}) {
  // Get collection info
  const collection = useQuery(api.collections.get, {
    collectionId: item.collectionId,
  });

  return (
    <Link
      href={`/deaccessions/${item._id}`}
      className="block rounded-lg border border-border bg-card p-4 transition-colors hover:bg-accent"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <h3 className="font-medium">{item.deaccessionNumber}</h3>
            {getStatusBadge(item.status)}
            {item.status === "pending" && item.workflowStep && (
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                <Clock className="h-3 w-3" />
                Awaiting step {item.workflowStep}
              </span>
            )}
          </div>
          {collection && (
            <p className="text-sm text-muted-foreground mb-1">
              {collection.title} ({collection.accessionNumber})
            </p>
          )}
          {!collection && (
            <p className="text-sm text-muted-foreground mb-1">
              Loading collection...
            </p>
          )}
          <p className="text-sm text-muted-foreground line-clamp-2">
            {item.reason}
          </p>
        </div>
        <div className="text-right space-y-2 flex-shrink-0">
          <div className="text-sm text-muted-foreground">
            {format(new Date(item.dateDeaccessioned), "MMM d, yyyy")}
          </div>
          {getMethodBadge(item.method)}
        </div>
      </div>
    </Link>
  );
}
