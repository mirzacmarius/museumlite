"use client";

import { useOrganization } from "@/components/organization-provider";
import { PermissionGate } from "@/components/permission-gate";
import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { Input } from "@v1/ui/input";
import { useQuery } from "convex/react";
import {
  ArrowDownRight,
  ArrowUpRight,
  Building2,
  CheckCircle,
  Clock,
  Handshake,
  Plus,
  Search,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

type LoanStatus = "pending" | "active" | "returned" | "cancelled" | "all";
type LoanType = "incoming" | "outgoing" | "all";

export default function LoansPage() {
  const { currentOrganizationId, organizations, isLoading } = useOrganization();
  const [statusFilter, setStatusFilter] = useState<LoanStatus>("all");
  const [typeFilter, setTypeFilter] = useState<LoanType>("all");
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
              You need to create an organization to start managing loans.
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
          <Handshake className="h-12 w-12 text-muted-foreground" />
          <div className="text-center">
            <h3 className="text-lg font-semibold">Select an Organization</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Please select an organization from the dropdown above to view
              loans.
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
              <h2 className="text-xl font-medium text-primary">Loan Records</h2>
              <p className="text-sm font-normal text-primary/60">
                Track incoming and outgoing loans
              </p>
            </div>
            <PermissionGate permission="loans.create">
              <Button asChild>
                <Link href="/loans/new">
                  <Plus className="mr-2 h-4 w-4" />
                  New Loan
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
                placeholder="Search by loan number, lender/borrower name, contact, notes, or terms..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-col gap-2 border-b border-border px-6">
            {/* Type Filters */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setTypeFilter("all")}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  typeFilter === "all"
                    ? "border-b-2 border-primary text-primary"
                    : "text-muted-foreground hover:text-primary"
                }`}
              >
                All Types
              </button>
              <button
                type="button"
                onClick={() => setTypeFilter("incoming")}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  typeFilter === "incoming"
                    ? "border-b-2 border-primary text-primary"
                    : "text-muted-foreground hover:text-primary"
                }`}
              >
                <ArrowDownRight className="mr-2 inline h-4 w-4" />
                Incoming
              </button>
              <button
                type="button"
                onClick={() => setTypeFilter("outgoing")}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  typeFilter === "outgoing"
                    ? "border-b-2 border-primary text-primary"
                    : "text-muted-foreground hover:text-primary"
                }`}
              >
                <ArrowUpRight className="mr-2 inline h-4 w-4" />
                Outgoing
              </button>
            </div>

            {/* Status Filters */}
            <div className="flex gap-2">
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
                onClick={() => setStatusFilter("active")}
                className={`px-4 py-3 text-sm font-medium transition-colors ${
                  statusFilter === "active"
                    ? "border-b-2 border-primary text-primary"
                    : "text-muted-foreground hover:text-primary"
                }`}
              >
                <CheckCircle className="mr-2 inline h-4 w-4" />
                Active
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("returned")}
                className={`px-4 py-3 text-sm font-medium transition-colors ${
                  statusFilter === "returned"
                    ? "border-b-2 border-primary text-primary"
                    : "text-muted-foreground hover:text-primary"
                }`}
              >
                Returned
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("cancelled")}
                className={`px-4 py-3 text-sm font-medium transition-colors ${
                  statusFilter === "cancelled"
                    ? "border-b-2 border-primary text-primary"
                    : "text-muted-foreground hover:text-primary"
                }`}
              >
                <XCircle className="mr-2 inline h-4 w-4" />
                Cancelled
              </button>
            </div>
          </div>

          <LoanList
            organizationId={currentOrganizationId}
            statusFilter={statusFilter}
            typeFilter={typeFilter}
            searchQuery={searchQuery}
          />
        </div>
      </div>
    </div>
  );
}

function LoanList({
  organizationId,
  statusFilter,
  typeFilter,
  searchQuery,
}: {
  organizationId: string;
  statusFilter: LoanStatus;
  typeFilter: LoanType;
  searchQuery: string;
}) {
  const loans = useQuery(
    api.loans.list,
    organizationId
      ? {
          organizationId: organizationId as Id<"organizations">,
          paginationOpts: { numItems: 50, cursor: null },
          status: statusFilter === "all" ? undefined : statusFilter,
          type: typeFilter === "all" ? undefined : typeFilter,
          search: searchQuery.trim() || undefined,
        }
      : "skip",
  );

  if (loans === undefined) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (loans.page.length === 0) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-4">
        <Handshake className="h-12 w-12 text-muted-foreground" />
        <div className="text-center">
          <p className="text-muted-foreground">No loans found</p>
          <p className="mt-2 text-sm text-muted-foreground">
            {searchQuery
              ? "Try adjusting your search query"
              : statusFilter === "all" && typeFilter === "all"
                ? "Create your first loan to get started"
                : `No ${statusFilter !== "all" ? statusFilter : ""} ${typeFilter !== "all" ? typeFilter : ""} loans`}
          </p>
        </div>
        {statusFilter === "all" && typeFilter === "all" && (
          <PermissionGate permission="loans.create">
            <Button asChild>
              <Link href="/loans/new">
                <Plus className="mr-2 h-4 w-4" />
                Create Loan
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
      case "active":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "returned":
        return <CheckCircle className="h-4 w-4 text-blue-500" />;
      case "cancelled":
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400";
      case "active":
        return "bg-green-500/10 text-green-600 dark:text-green-400";
      case "returned":
        return "bg-blue-500/10 text-blue-600 dark:text-blue-400";
      case "cancelled":
        return "bg-red-500/10 text-red-600 dark:text-red-400";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const getTypeIcon = (type: string) => {
    return type === "incoming" ? (
      <ArrowDownRight className="h-4 w-4 text-blue-500" />
    ) : (
      <ArrowUpRight className="h-4 w-4 text-purple-500" />
    );
  };

  return (
    <div className="p-6">
      <div className="space-y-4">
        {loans.page.map((loan) => (
          <Link
            key={loan._id}
            href={`/loans/${loan._id}`}
            className="block rounded-lg border border-border bg-card p-4 transition-colors hover:bg-accent"
          >
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  {getTypeIcon(loan.type)}
                  <h3 className="font-medium">{loan.loanNumber}</h3>
                  <span
                    className={`flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${getStatusColor(
                      loan.status,
                    )}`}
                  >
                    {getStatusIcon(loan.status)}
                    {loan.status.charAt(0).toUpperCase() + loan.status.slice(1)}
                  </span>
                  <span className="rounded-full bg-muted px-2 py-1 text-xs font-medium">
                    {loan.type === "incoming" ? "Incoming" : "Outgoing"}
                  </span>
                </div>
                <div className="mt-1 flex items-center gap-4 text-sm text-muted-foreground">
                  <span>{loan.lenderBorrowerName}</span>
                  <span>
                    • {loan.itemCount} item{loan.itemCount !== 1 ? "s" : ""}
                  </span>
                  <span>
                    • {new Date(loan.startDate).toLocaleDateString()}
                    {loan.endDate &&
                      ` - ${new Date(loan.endDate).toLocaleDateString()}`}
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
