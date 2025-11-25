"use client";

import { useOrganization } from "@/components/organization-provider";
import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Badge } from "@v1/ui/badge";
import { Button } from "@v1/ui/button";
import { Input } from "@v1/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@v1/ui/select";
import { useQuery } from "convex/react";
import {
  BookUser,
  Building2,
  DollarSign,
  Filter,
  Library,
  Loader2,
  Mail,
  Phone,
  Plus,
  Search,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

const STATUS_FILTERS = [
  { value: "all", label: "All Status" },
  { value: "active", label: "Active" },
  { value: "expired", label: "Expired" },
  { value: "suspended", label: "Suspended" },
  { value: "blocked", label: "Blocked" },
  { value: "inactive", label: "Inactive" },
] as const;

type PatronStatus = "active" | "expired" | "suspended" | "blocked" | "inactive";

export default function LibraryPatronsPage() {
  const { currentOrganizationId, organizations, isLoading } = useOrganization();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const isLibraryEnabled = useQuery(
    api.integrations.isEnabled,
    currentOrganizationId
      ? {
          organizationId: currentOrganizationId as Id<"organizations">,
          integrationId: "library",
        }
      : "skip",
  );

  const patrons = useQuery(
    api.library.patrons.list,
    currentOrganizationId && isLibraryEnabled
      ? {
          organizationId: currentOrganizationId as Id<"organizations">,
          paginationOpts: { numItems: 50, cursor: null },
          search: searchQuery.trim() || undefined,
          status:
            statusFilter !== "all" ? (statusFilter as PatronStatus) : undefined,
        }
      : "skip",
  );

  const statistics = useQuery(
    api.library.patrons.getStatistics,
    currentOrganizationId && isLibraryEnabled
      ? { organizationId: currentOrganizationId as Id<"organizations"> }
      : "skip",
  );

  if (isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
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
              You need to create an organization to manage patrons.
            </p>
          </div>
          <Button asChild>
            <Link href="/organizations/new">Create Organization</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (!currentOrganizationId) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-secondary px-6 py-8 dark:bg-black">
        <div className="flex flex-col items-center gap-4 rounded-lg border border-border bg-card p-8 dark:bg-black">
          <Library className="h-12 w-12 text-muted-foreground" />
          <div className="text-center">
            <h3 className="text-lg font-semibold">Select an Organization</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Please select an organization from the dropdown above.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (isLibraryEnabled === false) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-secondary px-6 py-8 dark:bg-black">
        <div className="flex flex-col items-center gap-4 rounded-lg border border-border bg-card p-8 dark:bg-black">
          <Library className="h-12 w-12 text-muted-foreground" />
          <div className="text-center">
            <h3 className="text-lg font-semibold">Library Not Enabled</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              The Library integration is not enabled for this organization.
            </p>
          </div>
          <Button asChild>
            <Link href="/settings/integrations">Enable Integration</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (isLibraryEnabled === undefined) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return (
          <Badge variant="default" className="bg-green-500">
            Active
          </Badge>
        );
      case "expired":
        return <Badge variant="secondary">Expired</Badge>;
      case "suspended":
        return (
          <Badge variant="default" className="bg-yellow-500">
            Suspended
          </Badge>
        );
      case "blocked":
        return <Badge variant="destructive">Blocked</Badge>;
      case "inactive":
        return <Badge variant="outline">Inactive</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  return (
    <div className="flex h-full w-full bg-secondary px-6 dark:bg-black">
      <div className="z-10 mx-auto flex h-full w-full max-w-screen-xl flex-col gap-6 py-6">
        {/* Statistics */}
        {statistics && (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-lg border border-border bg-card p-4 dark:bg-black">
              <p className="text-sm text-muted-foreground">Total Patrons</p>
              <p className="mt-1 text-2xl font-medium">{statistics.total}</p>
            </div>
            <div className="rounded-lg border border-border bg-card p-4 dark:bg-black">
              <p className="text-sm text-muted-foreground">Active</p>
              <p className="mt-1 text-2xl font-medium text-green-500">
                {statistics.active}
              </p>
            </div>
            <div className="rounded-lg border border-border bg-card p-4 dark:bg-black">
              <p className="text-sm text-muted-foreground">New This Month</p>
              <p className="mt-1 text-2xl font-medium">
                {statistics.newThisMonth}
              </p>
            </div>
            <div className="rounded-lg border border-border bg-card p-4 dark:bg-black">
              <p className="text-sm text-muted-foreground">Outstanding Fines</p>
              <p className="mt-1 text-2xl font-medium">
                {formatCurrency(statistics.totalFinesBalance)}
              </p>
            </div>
          </div>
        )}

        <div className="flex w-full flex-col rounded-lg border border-border bg-card dark:bg-black">
          {/* Header */}
          <div className="flex w-full items-center justify-between rounded-lg p-6">
            <div className="flex flex-col gap-2">
              <h2 className="text-xl font-medium text-primary">
                Library Patrons
              </h2>
              <p className="text-sm font-normal text-primary/60">
                Manage library members and their accounts
              </p>
            </div>
            <Button asChild>
              <Link href="/library/patrons/new">
                <Plus className="mr-2 h-4 w-4" />
                Register Patron
              </Link>
            </Button>
          </div>
          <div className="flex w-full px-6">
            <div className="w-full border-b border-border" />
          </div>

          {/* Search & Filters */}
          <div className="space-y-4 border-b border-border px-6 py-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, or card number..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex gap-4">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Filters:</span>
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_FILTERS.map((status) => (
                    <SelectItem key={status.value} value={status.value}>
                      {status.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Patrons List */}
          {patrons === undefined ? (
            <div className="flex h-64 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : patrons.page.length === 0 ? (
            <div className="flex h-64 flex-col items-center justify-center gap-4 p-6">
              <BookUser className="h-12 w-12 text-muted-foreground" />
              <div className="text-center">
                <p className="font-medium">
                  {searchQuery || statusFilter !== "all"
                    ? "No patrons found"
                    : "No patrons registered"}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {searchQuery || statusFilter !== "all"
                    ? "Try adjusting your search or filters"
                    : "Register your first library patron to get started"}
                </p>
              </div>
              {!searchQuery && statusFilter === "all" && (
                <Button asChild>
                  <Link href="/library/patrons/new">
                    <Plus className="mr-2 h-4 w-4" />
                    Register First Patron
                  </Link>
                </Button>
              )}
            </div>
          ) : (
            <div className="p-6">
              <div className="space-y-4">
                {patrons.page.map((patron) => (
                  <Link
                    key={patron._id}
                    href={`/library/patrons/${patron._id}`}
                    className="flex items-center gap-4 rounded-lg border border-border p-4 transition-colors hover:bg-accent"
                  >
                    {/* Avatar */}
                    <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <span className="text-lg font-medium">
                        {patron.firstName[0]}
                        {patron.lastName[0]}
                      </span>
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium">
                          {patron.firstName} {patron.lastName}
                        </h3>
                        {getStatusBadge(patron.status)}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                        <span className="font-mono">{patron.cardNumber}</span>
                        {patron.email && (
                          <span className="flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            {patron.email}
                          </span>
                        )}
                        {patron.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {patron.phone}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="flex-shrink-0 text-right">
                      <p className="text-sm">
                        <span className="font-medium">
                          {patron.membershipType}
                        </span>
                      </p>
                      {patron.fineBalance > 0 && (
                        <div className="mt-1 flex items-center justify-end gap-1 text-destructive">
                          <DollarSign className="h-3 w-3" />
                          <span className="text-sm font-medium">
                            {formatCurrency(patron.fineBalance)} owed
                          </span>
                        </div>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
