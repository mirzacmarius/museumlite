"use client";

import {
  DashboardListPageSkeleton,
  ListRowsSkeleton,
} from "@/components/dashboard-list-page-skeleton";
import { ExportCSVButton } from "@/components/export-csv-button";
import { useOrganization } from "@/components/organization-provider";
import { PermissionGate } from "@/components/permission-gate";
import { useScopedI18n } from "@/locales/client";
import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Badge } from "@v1/ui/badge";
import { Button } from "@v1/ui/button";
import { EmptyState } from "@v1/ui/empty-state";
import { Input } from "@v1/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@v1/ui/select";
import { useMutation, useQuery } from "convex/react";
import {
  Building2,
  Download,
  FileUp,
  Plus,
  Search,
  Settings,
  User,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";

type AccountType = "lender" | "borrower" | "both" | "institution" | "patron";

export default function AccountsPage() {
  const t = useScopedI18n("accounts");
  const { currentOrganizationId, organizations, isLoading } = useOrganization();
  const searchParams = useSearchParams();
  const typeParam = searchParams.get("type") as AccountType | null;
  const [searchQuery, setSearchQuery] = useState("");
  const [accountTypeFilter, setAccountTypeFilter] = useState<
    AccountType | "all"
  >(typeParam ?? "all");

  const isPatronView = typeParam === "patron";

  const exportAccounts = useMutation(api.imports.exportAccounts);

  const handleExport = useCallback(async () => {
    if (!currentOrganizationId) return [];
    return exportAccounts({ organizationId: currentOrganizationId });
  }, [currentOrganizationId, exportAccounts]);

  if (isLoading) {
    return (
      <DashboardListPageSkeleton
        actionsCount={3}
        filtersCount={isPatronView ? 0 : 1}
        layout="list"
      />
    );
  }

  if (!organizations || organizations.length === 0) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-background px-6 py-8">
        <div className="flex flex-col items-center gap-4 rounded-lg border border-border bg-card p-8">
          <Building2 className="h-12 w-12 text-muted-foreground" />
          <div className="text-center">
            <h3 className="text-lg font-semibold">
              {t("noOrganizationTitle")}
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {t("noOrganizationDescription")}
            </p>
          </div>
          <Button asChild>
            <Link href="/organizations/new">
              <Plus className="mr-2 h-4 w-4" />
              {t("createOrganization")}
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
            <h3 className="text-lg font-semibold">
              {t("selectOrganizationTitle")}
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {t("selectOrganizationDescription")}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Check if accounts module is enabled
  const isAccountsEnabled = organizations
    .find((org) => org._id === currentOrganizationId)
    ?.settings?.enabledModules?.includes("accounts");

  if (!isAccountsEnabled) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-background px-6 py-8">
        <div className="flex flex-col items-center gap-4 rounded-lg border border-border bg-card p-8">
          <Users className="h-12 w-12 text-muted-foreground" />
          <div className="text-center">
            <h3 className="text-lg font-semibold">{t("description")}</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {t("moduleDisabled")}
            </p>
          </div>
          <Button asChild>
            <Link href="/settings/modules">
              <Settings className="mr-2 h-4 w-4" />
              {t("enableModule")}
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full bg-background px-4 sm:px-6">
      <div className="z-10 mx-auto flex h-full w-full max-w-screen-xl gap-12">
        <div className="flex w-full flex-col rounded-lg border border-border bg-card">
          <div className="flex w-full flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-lg p-4 sm:p-6">
            <div className="flex flex-col gap-2">
              <h2 className="text-lg sm:text-xl font-medium text-primary">
                {isPatronView ? t("patronsTitle") : t("title")}
              </h2>
              <p className="text-sm font-normal text-primary/60">
                {isPatronView ? t("patronsDescription") : t("description")}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap flex-shrink-0">
              <PermissionGate permission="accounts.read">
                <ExportCSVButton onExport={handleExport} filename="accounts" />
              </PermissionGate>
              <PermissionGate permission="accounts.write">
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className="sm:size-auto"
                >
                  <Link href="/accounts/import">
                    <FileUp className="h-4 w-4 sm:mr-2" />
                    <span className="hidden sm:inline">{t("importCSV")}</span>
                  </Link>
                </Button>
              </PermissionGate>
              <PermissionGate permission="accounts.write">
                <Button asChild>
                  <Link href="/accounts/new">
                    <Plus className="h-4 w-4 sm:mr-2" />
                    <span className="hidden sm:inline">{t("newAccount")}</span>
                  </Link>
                </Button>
              </PermissionGate>
            </div>
          </div>
          <div className="flex w-full px-4 sm:px-6">
            <div className="w-full border-b border-border" />
          </div>

          <div className="border-b border-border px-4 sm:px-6 py-4">
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder={
                    isPatronView
                      ? t("patronsSearchPlaceholder")
                      : t("searchPlaceholder")
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
                  <SelectTrigger className="w-full sm:w-[180px]">
                    <SelectValue placeholder={t("filters.allTypes")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("filters.allTypes")}</SelectItem>
                    <SelectItem value="lender">
                      {t("filters.lenders")}
                    </SelectItem>
                    <SelectItem value="borrower">
                      {t("filters.borrowers")}
                    </SelectItem>
                    <SelectItem value="both">{t("filters.both")}</SelectItem>
                    <SelectItem value="institution">
                      {t("filters.institutions")}
                    </SelectItem>
                    <SelectItem value="patron">
                      {t("filters.patrons")}
                    </SelectItem>
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
  const t = useScopedI18n("accounts");
  const accounts = useQuery(api.accounts.list, {
    organizationId,
    search: searchQuery || undefined,
    accountType,
  });

  if (accounts === undefined) {
    return <ListRowsSkeleton count={8} />;
  }

  if (accounts.accounts.length === 0) {
    return (
      <div className="flex h-64 flex-col items-center justify-center">
        <EmptyState
          icon={Users}
          title={
            searchQuery
              ? t("emptyState.noSearchResults")
              : t("emptyState.noAccountsFound")
          }
          description={t("emptyState.createFirst")}
        />
        <PermissionGate permission="loans.create">
          <Button asChild className="mt-4">
            <Link href="/accounts/new">
              <Plus className="mr-2 h-4 w-4" />
              {t("emptyState.createFirst")}
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
        t("list.unnamedPatron")
      );
    }
    return account.businessName ?? t("list.unnamedAccount");
  };

  const getAccountTypeBadge = (type?: string) => {
    switch (type) {
      case "lender":
        return <Badge variant="outline">{t("types.lender")}</Badge>;
      case "borrower":
        return <Badge variant="outline">{t("types.borrower")}</Badge>;
      case "both":
        return <Badge variant="outline">{t("types.both")}</Badge>;
      case "institution":
        return <Badge variant="secondary">{t("types.institution")}</Badge>;
      case "patron":
        return <Badge variant="default">{t("types.patron")}</Badge>;
      default:
        return null;
    }
  };

  return (
    <div className="p-4 sm:p-6">
      <div className="space-y-2">
        {accounts.accounts.map((account) => (
          <Link
            key={account._id}
            href={`/accounts/${account._id}`}
            className="group flex items-center justify-between rounded-lg border border-border bg-card p-4 transition-colors hover:bg-accent hover:border-primary/50"
          >
            <div className="flex flex-1 items-center gap-4">
              <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
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
                        {t("list.contact")} {account.contactPerson}
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
