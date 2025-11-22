"use client";

import { useOrganization } from "@/components/organization-provider";
import { PermissionGate } from "@/components/permission-gate";
import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { Input } from "@v1/ui/input";
import { useQuery } from "convex/react";
import {
  Building2,
  CheckCircle,
  Clock,
  FileCheck,
  Plus,
  Search,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

type AccessionStatus = "pending" | "approved" | "rejected" | "all";

export default function AccessionsPage() {
  const { currentOrganizationId, organizations, isLoading } = useOrganization();
  const [statusFilter, setStatusFilter] = useState<AccessionStatus>("all");
  const [searchQuery, setSearchQuery] = useState("");

  if (isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!organizations || organizations.length === 0) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-secondary px-6 py-8 dark:bg-black">
        <div className="flex flex-col items-center gap-4 rounded-lg border border-border bg-card p-8 dark:bg-black">
          <Building2 className="h-12 w-12 text-muted-foreground" />
          <div className="text-center">
            <h3 className="text-lg font-semibold">No Organization Found</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              You need to create an organization to start managing accessions.
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
      <div className="flex h-full w-full items-center justify-center bg-secondary px-6 py-8 dark:bg-black">
        <div className="flex flex-col items-center gap-4 rounded-lg border border-border bg-card p-8 dark:bg-black">
          <FileCheck className="h-12 w-12 text-muted-foreground" />
          <div className="text-center">
            <h3 className="text-lg font-semibold">Select an Organization</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Please select an organization from the dropdown above to view
              accessions.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full bg-secondary px-6 dark:bg-black">
      <div className="z-10 mx-auto flex h-full w-full max-w-screen-xl gap-12">
        <div className="flex w-full flex-col rounded-lg border border-border bg-card dark:bg-black">
          <div className="flex w-full items-center justify-between rounded-lg p-6">
            <div className="flex flex-col gap-2">
              <h2 className="text-xl font-medium text-primary">
                Accession Records
              </h2>
              <p className="text-sm font-normal text-primary/60">
                Track and approve new object acquisitions
              </p>
            </div>
            <PermissionGate permission="collections.create">
              <Button asChild>
                <Link href="/accessions/new">
                  <Plus className="mr-2 h-4 w-4" />
                  New Accession
                </Link>
              </Button>
            </PermissionGate>
          </div>
          <div className="flex w-full px-6">
            <div className="w-full border-b border-border" />
          </div>

          {/* Search Bar */}
          <div className="border-b border-border px-6 py-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by accession number, source, or notes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {/* Status Filters */}
          <div className="flex gap-2 border-b border-border px-6">
            <button
              type="button"
              onClick={() => setStatusFilter("all")}
              className={`px-4 py-3 text-sm font-medium transition-colors ${
                statusFilter === "all"
                  ? "border-b-2 border-primary text-primary"
                  : "text-muted-foreground hover:text-primary"
              }`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("pending")}
              className={`px-4 py-3 text-sm font-medium transition-colors ${
                statusFilter === "pending"
                  ? "border-b-2 border-primary text-primary"
                  : "text-muted-foreground hover:text-primary"
              }`}
            >
              <Clock className="mr-2 inline h-4 w-4" />
              Pending
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("approved")}
              className={`px-4 py-3 text-sm font-medium transition-colors ${
                statusFilter === "approved"
                  ? "border-b-2 border-primary text-primary"
                  : "text-muted-foreground hover:text-primary"
              }`}
            >
              <CheckCircle className="mr-2 inline h-4 w-4" />
              Approved
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("rejected")}
              className={`px-4 py-3 text-sm font-medium transition-colors ${
                statusFilter === "rejected"
                  ? "border-b-2 border-primary text-primary"
                  : "text-muted-foreground hover:text-primary"
              }`}
            >
              <XCircle className="mr-2 inline h-4 w-4" />
              Rejected
            </button>
          </div>

          <AccessionList
            organizationId={currentOrganizationId}
            statusFilter={statusFilter}
            searchQuery={searchQuery}
          />
        </div>
      </div>
    </div>
  );
}

function AccessionList({
  organizationId,
  statusFilter,
  searchQuery,
}: {
  organizationId: string;
  statusFilter: AccessionStatus;
  searchQuery: string;
}) {
  const accessions = useQuery(
    api.accessions.list,
    organizationId
      ? {
          organizationId: organizationId as Id<"organizations">,
          paginationOpts: { numItems: 50, cursor: null },
          status: statusFilter === "all" ? undefined : statusFilter,
          search: searchQuery.trim() || undefined,
        }
      : "skip",
  );

  if (accessions === undefined) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (accessions.page.length === 0) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-4">
        <FileCheck className="h-12 w-12 text-muted-foreground" />
        <div className="text-center">
          <p className="text-muted-foreground">No accessions found</p>
          <p className="mt-2 text-sm text-muted-foreground">
            {searchQuery
              ? "Try adjusting your search query"
              : statusFilter === "all"
                ? "Create your first accession to get started"
                : `No ${statusFilter} accessions`}
          </p>
        </div>
        {statusFilter === "all" && (
          <PermissionGate permission="collections.create">
            <Button asChild>
              <Link href="/accessions/new">
                <Plus className="mr-2 h-4 w-4" />
                Create Accession
              </Link>
            </Button>
          </PermissionGate>
        )}
      </div>
    );
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending":
        return <Clock className="h-4 w-4" />;
      case "approved":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "rejected":
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400";
      case "approved":
        return "bg-green-500/10 text-green-600 dark:text-green-400";
      case "rejected":
        return "bg-red-500/10 text-red-600 dark:text-red-400";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  return (
    <div className="p-6">
      <div className="space-y-4">
        {accessions.page.map((accession) => (
          <Link
            key={accession._id}
            href={`/accessions/${accession._id}`}
            className="block rounded-lg border border-border bg-card p-4 transition-colors hover:bg-accent"
          >
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <h3 className="font-medium">{accession.accessionNumber}</h3>
                  <span
                    className={`flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${getStatusColor(
                      accession.status,
                    )}`}
                  >
                    {getStatusIcon(accession.status)}
                    {accession.status.charAt(0).toUpperCase() +
                      accession.status.slice(1)}
                  </span>
                  {accession.workflowStep && (
                    <span className="text-xs text-muted-foreground">
                      Step {accession.workflowStep}
                    </span>
                  )}
                </div>
                <div className="mt-1 flex items-center gap-4 text-sm text-muted-foreground">
                  <span>{accession.source}</span>
                  <span className="capitalize">• {accession.method}</span>
                  <span>
                    • {new Date(accession.dateReceived).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
