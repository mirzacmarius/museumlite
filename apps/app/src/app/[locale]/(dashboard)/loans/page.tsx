"use client";

import { useOrganization } from "@/components/organization-provider";
import { PermissionGate } from "@/components/permission-gate";
import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { Input } from "@v1/ui/input";
import { useQuery } from "convex/react";
import {
  ArrowDownLeft,
  ArrowDownRight,
  ArrowRightLeft,
  ArrowUpRight,
  Boxes,
  Building2,
  CheckCircle,
  ChevronRight,
  Clock,
  Handshake,
  Plus,
  Search,
  ShieldCheck,
  Truck,
  XCircle,
  AlertCircle,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

type LoanStatus =
  | "pending"
  | "active"
  | "dispatched"
  | "returned"
  | "cancelled"
  | "all";
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
      <div className="flex h-full w-full items-center justify-center bg-background px-6 py-8">
        <div className="flex flex-col items-center gap-4 rounded-lg border border-border bg-card p-8">
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
      <div className="flex h-full w-full items-center justify-center bg-background px-6 py-8">
        <div className="flex flex-col items-center gap-4 rounded-lg border border-border bg-card p-8">
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
    <div className="flex h-full w-full flex-col overflow-y-auto bg-zinc-50/50 dark:bg-black">
      <div className="mx-auto w-full max-w-7xl space-y-8 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-white">
              Loans
            </h1>
            <p className="mt-1 text-sm text-zinc-500">
              Manage incoming and outgoing loan agreements
            </p>
          </div>
          <PermissionGate permission="loans.create">
            <Button asChild>
              <Link href="/loans/new">
                <Plus className="h-3.5 w-3.5" />
                <span>New Loan</span>
              </Link>
            </Button>
          </PermissionGate>
        </div>

        <LoanList
          organizationId={currentOrganizationId}
          statusFilter={statusFilter}
          typeFilter={typeFilter}
          searchQuery={searchQuery}
          onStatusFilterChange={setStatusFilter}
          onTypeFilterChange={setTypeFilter}
          onSearchQueryChange={setSearchQuery}
        />
      </div>
    </div>
  );
}

function LoanList({
  organizationId,
  statusFilter,
  typeFilter,
  searchQuery,
  onStatusFilterChange,
  onTypeFilterChange,
  onSearchQueryChange,
}: {
  organizationId: string;
  statusFilter: LoanStatus;
  typeFilter: LoanType;
  searchQuery: string;
  onStatusFilterChange: (status: LoanStatus) => void;
  onTypeFilterChange: (type: LoanType) => void;
  onSearchQueryChange: (query: string) => void;
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

  const isLoading = loans === undefined;
  const loansPage = loans?.page ?? [];

  const activeLoansCount = loansPage.filter(
    (l: { status: string }) => l.status === "active",
  ).length;
  const totalItemsInTransit = loansPage.reduce(
    (sum: number, l: { itemCount?: number }) => sum + (l.itemCount || 0),
    0,
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <span className="inline-flex items-center gap-1.5 rounded border border-amber-100 bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-600 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-500">
            <span className="h-1 w-1 rounded-full bg-amber-500" />
            Pending Review
          </span>
        );
      case "active":
        return (
          <span className="inline-flex items-center gap-1.5 rounded border border-emerald-100 bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-600 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-400">
            <span className="h-1 w-1 rounded-full bg-emerald-500" />
            Active
          </span>
        );
      case "dispatched":
        return (
          <span className="inline-flex items-center gap-1.5 rounded border border-purple-100 bg-purple-50 px-2 py-0.5 text-[10px] font-medium text-purple-600 dark:border-purple-900 dark:bg-purple-950/30 dark:text-purple-400">
            <span className="h-1 w-1 rounded-full bg-purple-500" />
            Dispatched
          </span>
        );
      case "returned":
        return (
          <span className="inline-flex items-center gap-1.5 rounded border border-blue-100 bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-600 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-400">
            <span className="h-1 w-1 rounded-full bg-blue-500" />
            Returned
          </span>
        );
      case "cancelled":
        return (
          <span className="inline-flex items-center gap-1.5 rounded border border-red-100 bg-red-50 px-2 py-0.5 text-[10px] font-medium text-red-600 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400">
            <span className="h-1 w-1 rounded-full bg-red-500" />
            Cancelled
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 rounded border border-zinc-200 bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400">
            Draft
          </span>
        );
    }
  };

  const getTypeIcon = (type: string) => {
    return type === "incoming" ? (
      <div className="flex h-6 w-6 items-center justify-center rounded bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400">
        <ArrowDownLeft className="h-3 w-3" strokeWidth={3} />
      </div>
    ) : (
      <div className="flex h-6 w-6 items-center justify-center rounded bg-cyan-100 text-cyan-600 dark:bg-cyan-900/30 dark:text-cyan-400">
        <ArrowUpRight className="h-3 w-3" strokeWidth={3} />
      </div>
    );
  };

  const formatDateRange = (startDate: number, endDate?: number) => {
    const start = new Date(startDate);
    const startStr = start.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });

    if (!endDate) return startStr;

    const end = new Date(endDate);
    const endStr = end.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

    return `${startStr} — ${endStr}`;
  };

  const getInitial = (name: string) => {
    return name.charAt(0).toUpperCase();
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/50">
          <div className="mb-4 flex items-start justify-between">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-100 text-zinc-500 dark:bg-zinc-800">
              <ArrowRightLeft className="h-4 w-4" />
            </div>
            <span className="rounded border border-emerald-100 bg-emerald-50 px-1.5 py-0.5 text-xs font-medium text-emerald-600 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-400">
              +{activeLoansCount} active
            </span>
          </div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            Active Loans
          </p>
          <p className="mt-1 text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
            {activeLoansCount}
          </p>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/50">
          <div className="mb-4 flex items-start justify-between">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-100 text-zinc-500 dark:bg-zinc-800">
              <Boxes className="h-4 w-4" />
            </div>
          </div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            Objects in Transit
          </p>
          <p className="mt-1 text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
            {totalItemsInTransit}
          </p>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/50">
          <div className="mb-4 flex items-start justify-between">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-100 text-zinc-500 dark:bg-zinc-800">
              <ShieldCheck className="h-4 w-4" />
            </div>
          </div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            Total Insured Value
          </p>
          <p className="mt-1 text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
            —
          </p>
        </div>

        <div className="relative overflow-hidden rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/50">
          <div className="absolute right-0 top-0 h-16 w-16 rounded-full bg-red-500/10 blur-2xl" />
          <div className="mb-4 flex items-start justify-between">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-50 text-red-500 dark:bg-red-900/20">
              <AlertCircle className="h-4 w-4" />
            </div>
            <span className="rounded border border-red-100 bg-red-50 px-1.5 py-0.5 text-xs font-medium text-red-600 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400">
              Action Req.
            </span>
          </div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            Expiring Agreements
          </p>
          <p className="mt-1 text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
            —
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex self-start rounded-lg bg-zinc-100 p-1 dark:bg-zinc-900">
            <button
              type="button"
              onClick={() => onTypeFilterChange("all")}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-all ${
                typeFilter === "all"
                  ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-zinc-100"
                  : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
              }`}
            >
              All Loans
            </button>
            <button
              type="button"
              onClick={() => onTypeFilterChange("outgoing")}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-all ${
                typeFilter === "outgoing"
                  ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-zinc-100"
                  : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
              }`}
            >
              Outgoing
            </button>
            <button
              type="button"
              onClick={() => onTypeFilterChange("incoming")}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-all ${
                typeFilter === "incoming"
                  ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-zinc-100"
                  : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
              }`}
            >
              Incoming
            </button>
            <button
              type="button"
              onClick={() => onStatusFilterChange("pending")}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-all ${
                statusFilter === "pending"
                  ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-zinc-100"
                  : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
              }`}
            >
              Pending
            </button>
          </div>

          <div className="flex items-center gap-2">
            <div className="group relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <Search className="h-3.5 w-3.5 text-zinc-400 transition-colors group-focus-within:text-cyan-500" />
              </div>
              <Input
                type="text"
                className="block w-48 rounded-lg border border-zinc-200 bg-white p-2 pl-9 text-xs text-zinc-900 outline-none transition-all focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400"
                placeholder="Search loans..."
                value={searchQuery}
                onChange={(e) => onSearchQueryChange(e.target.value)}
              />
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="flex h-64 items-center justify-center rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-zinc-500">Loading...</p>
          </div>
        ) : loansPage.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center gap-4 rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
            <Handshake className="h-12 w-12 text-zinc-400" />
            <div className="text-center">
              <p className="text-zinc-500">No loans found</p>
              <p className="mt-2 text-sm text-zinc-400">
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
                    <Plus className="h-4 w-4" />
                    Create Loan
                  </Link>
                </Button>
              </PermissionGate>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-50/50 text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/50">
                    <th className="w-12 px-6 py-3">Type</th>
                    <th className="px-6 py-3">Loan ID & Title</th>
                    <th className="px-6 py-3">Partner Institution</th>
                    <th className="px-6 py-3">Duration</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/50">
                  {loansPage.map(
                    (loan: {
                      _id: string;
                      type: string;
                      loanNumber: string;
                      itemCount: number;
                      lenderBorrowerName: string;
                      startDate: number;
                      endDate?: number;
                      status: string;
                    }) => {
                      const handleNavigate = () => {
                        window.location.href = `/loans/${loan._id}`;
                      };

                      return (
                        <tr
                          key={loan._id}
                          className="group cursor-pointer transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                          onClick={handleNavigate}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              handleNavigate();
                            }
                          }}
                          tabIndex={0}
                          role="button"
                        >
                          <td className="px-6 py-4">
                            {getTypeIcon(loan.type)}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-col">
                              <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                                {loan.loanNumber}
                              </span>
                              <span className="mt-0.5 font-mono text-[10px] text-zinc-500">
                                {loan.itemCount} item
                                {loan.itemCount !== 1 ? "s" : ""}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <div className="flex h-5 w-5 items-center justify-center rounded bg-zinc-100 text-[9px] font-bold text-zinc-500 dark:bg-zinc-800">
                                {getInitial(loan.lenderBorrowerName)}
                              </div>
                              <span className="text-xs text-zinc-600 dark:text-zinc-300">
                                {loan.lenderBorrowerName}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-xs text-zinc-600 dark:text-zinc-400">
                              {formatDateRange(loan.startDate, loan.endDate)}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            {getStatusBadge(loan.status)}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <ChevronRight className="inline-block h-4 w-4 text-zinc-300 transition-colors group-hover:text-zinc-500" />
                          </td>
                        </tr>
                      );
                    },
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between px-2 pt-2 text-xs text-zinc-500">
              <span>
                Showing 1-{loansPage.length} of {loansPage.length} loans
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="rounded border border-zinc-200 px-2 py-1 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-800 dark:hover:bg-zinc-800"
                  disabled
                >
                  Previous
                </button>
                <button
                  type="button"
                  className="rounded border border-zinc-200 px-2 py-1 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800"
                  disabled={!loans?.continueCursor}
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
