"use client";

import { useOrganization } from "@/components/organization-provider";
import { PermissionGate } from "@/components/permission-gate";
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
import { Building2, Plus, Search, User, Users } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";

type AccountType = "lender" | "borrower" | "both" | "institution" | "patron";

export default function AccountsPage() {
  const { currentOrganizationId, organizations, isLoading } = useOrganization();
  const searchParams = useSearchParams();
  const typeParam = searchParams.get("type") as AccountType | null;
  const [searchQuery, setSearchQuery] = useState("");
  const [accountTypeFilter, setAccountTypeFilter] = useState<
    AccountType | "all"
  >(typeParam ?? "all");

  const isPatronView = typeParam === "patron";

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
              You need to create an organization to start managing accounts.
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
          <Users className="h-12 w-12 text-muted-foreground" />
          <div className="text-center">
            <h3 className="text-lg font-semibold">Select an Organization</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Please select an organization from the dropdown above to view
              accounts.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full bg-background px-6">
      <div className="z-10 mx-auto flex h-full w-full max-w-screen-xl gap-12">
        <div className="flex w-full flex-col rounded-lg border border-border bg-card">
          <div className="flex w-full items-center justify-between rounded-lg p-6">
            <div className="flex flex-col gap-2">
              <h2 className="text-xl font-medium text-primary">
                {isPatronView ? "Library Patrons" : "Accounts"}
              </h2>
              <p className="text-sm font-normal text-primary/60">
                {isPatronView
                  ? "Manage library members and their accounts"
                  : "Manage lenders, borrowers, institutions, and contacts"}
              </p>
            </div>
            <PermissionGate permission="loans.create">
              <Button asChild>
                <Link href="/accounts/new">
                  <Plus className="mr-2 h-4 w-4" />
                  New Account
                </Link>
              </Button>
            </PermissionGate>
          </div>
          <div className="flex w-full px-6">
            <div className="w-full border-b border-border" />
          </div>

          {/* Search Bar and Filters */}
          <div className="border-b border-border px-6 py-4">
            <div className="flex gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder={
                    isPatronView
                      ? "Search by name, card number, or email..."
                      : "Search by business name, account number, email, or contact person..."
                  }
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              {!isPatronView && (
                <Select
                  value={accountTypeFilter}
                  onValueChange={(value) =>
                    setAccountTypeFilter(value as AccountType | "all")
                  }
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="All Types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="lender">Lenders</SelectItem>
                    <SelectItem value="borrower">Borrowers</SelectItem>
                    <SelectItem value="both">Both</SelectItem>
                    <SelectItem value="institution">Institutions</SelectItem>
                    <SelectItem value="patron">Patrons</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>

          <AccountList
            organizationId={currentOrganizationId}
            searchQuery={searchQuery}
            accountType={
              isPatronView
                ? "patron"
                : accountTypeFilter !== "all"
                  ? accountTypeFilter
                  : undefined
            }
          />
        </div>
      </div>
    </div>
  );
}

function AccountList({
  organizationId,
  searchQuery,
  accountType,
}: {
  organizationId: Id<"organizations">;
  searchQuery: string;
  accountType?: AccountType;
}) {
  const accounts = useQuery(api.accounts.list, {
    organizationId,
    search: searchQuery || undefined,
    accountType,
  });

  if (accounts === undefined) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (accounts.accounts.length === 0) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">
          {searchQuery
            ? "No accounts found matching your search"
            : "No accounts found"}
        </p>
        <PermissionGate permission="loans.create">
          <Button asChild>
            <Link href="/accounts/new">
              <Plus className="mr-2 h-4 w-4" />
              Create Your First Account
            </Link>
          </Button>
        </PermissionGate>
      </div>
    );
  }

  const isPatronList = accountType === "patron";

  const getAccountDisplayName = (account: (typeof accounts.accounts)[0]) => {
    if (account.accountType === "patron") {
      return (
        `${account.firstName ?? ""} ${account.lastName ?? ""}`.trim() ||
        "Unnamed Patron"
      );
    }
    return account.businessName ?? "Unnamed Account";
  };

  const getAccountTypeBadge = (type?: string) => {
    switch (type) {
      case "lender":
        return <Badge variant="outline">Lender</Badge>;
      case "borrower":
        return <Badge variant="outline">Borrower</Badge>;
      case "both":
        return <Badge variant="outline">Both</Badge>;
      case "institution":
        return <Badge variant="secondary">Institution</Badge>;
      case "patron":
        return <Badge variant="default">Patron</Badge>;
      default:
        return null;
    }
  };

  return (
    <div className="p-6">
      <div className="space-y-2">
        {accounts.accounts.map((account) => (
          <Link
            key={account._id}
            href={`/accounts/${account._id}`}
            className="group flex items-center justify-between rounded-lg border border-border bg-card p-4 transition-colors hover:bg-accent hover:border-primary/50"
          >
            <div className="flex flex-1 items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                {account.accountType === "patron" ? (
                  <User className="h-5 w-5 text-primary" />
                ) : (
                  <Users className="h-5 w-5 text-primary" />
                )}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-medium">
                    {getAccountDisplayName(account)}
                  </h3>
                  <span className="text-xs text-muted-foreground">
                    {account.accountType === "patron"
                      ? account.cardNumber
                      : account.accountNumber}
                  </span>
                  {!isPatronList && getAccountTypeBadge(account.accountType)}
                </div>
                <div className="mt-1 flex items-center gap-4 text-sm text-muted-foreground">
                  {account.email && (
                    <span className="truncate">{account.email}</span>
                  )}
                  {account.phone && (
                    <span className="truncate">{account.phone}</span>
                  )}
                  {account.accountType !== "patron" &&
                    account.contactPerson && (
                      <span className="truncate">
                        Contact: {account.contactPerson}
                      </span>
                    )}
                  {account.accountType === "patron" && account.status && (
                    <Badge
                      variant={
                        account.status === "active" ? "default" : "secondary"
                      }
                    >
                      {account.status}
                    </Badge>
                  )}
                </div>
                {account.city && account.country && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {account.city}, {account.country}
                  </p>
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
