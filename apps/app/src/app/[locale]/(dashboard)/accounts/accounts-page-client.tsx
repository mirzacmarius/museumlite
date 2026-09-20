"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
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
import { cn } from "@v1/ui/utils";
import { useMutation, useQuery } from "convex/react";
import {
  ArrowRight,
  Building2,
  FileUp,
  Mail,
  Phone,
  Plus,
  Search,
  Settings,
  User,
  Users,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { notFound, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useState, type ReactNode } from "react";
import { ExportCSVButton } from "@/components/export-csv-button";
import { useOrganization } from "@/components/organization-provider";
import { PermissionGate, usePermissions } from "@/components/permission-gate";
import { useScopedI18n } from "@/locales/client";
import {
  AccountsListSkeleton,
  AccountsPageSkeleton,
} from "./accounts-page-skeleton";

type AccountType = "lender" | "borrower" | "both" | "institution" | "patron";
type AccountTypeFilter = AccountType | "all";

interface AccountListItem {
  _id: Id<"accounts">;
  accountType?: AccountType;
  accountNumber: string;
  businessName?: string;
  firstName?: string;
  lastName?: string;
  cardNumber?: string;
  email?: string;
  phone?: string;
  contactPerson?: string;
  city?: string;
  country?: string;
  status?: string;
}

const DEFAULT_TONE =
  "border-border/60 bg-muted/40 text-muted-foreground";

const STATUS_TONES: Record<string, string> = {
  active: "border-emerald-500/20 bg-emerald-500/10 text-emerald-400",
  expired: "border-zinc-500/20 bg-zinc-500/10 text-muted-foreground",
  inactive: "border-zinc-500/20 bg-zinc-500/10 text-muted-foreground",
  suspended: "border-amber-500/20 bg-amber-500/10 text-amber-400",
  blocked: "border-amber-500/20 bg-amber-500/10 text-amber-400",
};

const TYPE_TONES: Record<string, string> = {
  lender: "border-blue-500/20 bg-blue-500/10 text-blue-400",
  borrower: "border-indigo-500/20 bg-indigo-500/10 text-indigo-400",
  both: "border-primary/20 bg-primary/10 text-primary",
  institution: "border-amber-500/20 bg-amber-500/10 text-amber-400",
  patron: "border-emerald-500/20 bg-emerald-500/10 text-emerald-400",
};

const ACCOUNT_GRID =
  "md:grid-cols-[minmax(0,1.4fr)_minmax(0,0.7fr)_minmax(0,1fr)_auto]";
const PATRON_GRID =
  "md:grid-cols-[minmax(0,1.3fr)_minmax(0,0.7fr)_minmax(0,1.1fr)_auto_auto]";
const COLUMN_HEADER =
  "hidden gap-4 border-b border-border/60 px-4 py-2 text-[10px] font-medium uppercase tracking-widest text-muted-foreground md:grid dark:border-white/10";
const TONE_BADGE =
  "inline-flex w-fit items-center rounded border px-2 py-0.5 text-[10px] font-medium tracking-wide";

const ACCOUNT_COLUMN_HEADERS = ["Name", "Type", "Contact"] as const;
const PATRON_COLUMN_HEADERS = ["Patron", "Card", "Contact", "Status"] as const;

export function AccountsPageClient() {
  return (
    <Suspense fallback={<AccountsPageSkeleton />}>
      <AccountsPageContent />
    </Suspense>
  );
}

function AccountsPageContent() {
  const t = useScopedI18n("accounts");
  const { currentOrganizationId, organizations, isLoading } = useOrganization();
  const { hasPermission, isLoading: permissionsLoading } = usePermissions();
  const canAccessAdministration = hasPermission("organization.manage_settings");
  const searchParams = useSearchParams();
  const typeParam = searchParams.get("type") as AccountType | null;
  const [searchQuery, setSearchQuery] = useState("");
  const [accountTypeFilter, setAccountTypeFilter] = useState<AccountTypeFilter>(
    typeParam ?? "all",
  );

  const isPatronView = typeParam === "patron";

  const exportAccounts = useMutation(api.imports.exportAccounts);

  const handleExport = useCallback(async () => {
    if (!currentOrganizationId) return [];
    return exportAccounts({ organizationId: currentOrganizationId });
  }, [currentOrganizationId, exportAccounts]);

  if (!permissionsLoading && !canAccessAdministration && !isPatronView)
    notFound();

  if (isLoading || permissionsLoading) {
    return <AccountsPageSkeleton isPatronView={isPatronView} />;
  }

  if (!organizations || organizations.length === 0) {
    return (
      <CenteredMessage
        icon={Building2}
        title={t("noOrganizationTitle")}
        description={t("noOrganizationDescription")}
        action={
          <Button asChild>
            <Link href="/organizations/new">
              <Plus className="mr-2 size-4" />
              {t("createOrganization")}
            </Link>
          </Button>
        }
      />
    );
  }

  if (!currentOrganizationId) {
    return (
      <CenteredMessage
        icon={Users}
        title={t("selectOrganizationTitle")}
        description={t("selectOrganizationDescription")}
      />
    );
  }

  const isAccountsEnabled = organizations
    .find((org) => org._id === currentOrganizationId)
    ?.settings?.enabledModules?.includes("accounts");

  if (!isAccountsEnabled) {
    return (
      <CenteredMessage
        icon={Users}
        title={t("description")}
        description={t("moduleDisabled")}
        action={
          canAccessAdministration ? (
            <Button asChild>
              <Link href="/settings/modules">
                <Settings className="mr-2 size-4" />
                {t("enableModule")}
              </Link>
            </Button>
          ) : null
        }
      />
    );
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-y-auto bg-background p-4 sm:p-6 custom-scrollbar">
      <AccountsPageHeader
        canAccessAdministration={canAccessAdministration}
        title={isPatronView ? t("patronsTitle") : t("title")}
        description={
          isPatronView ? t("patronsDescription") : t("description")
        }
        importLabel={t("importCSV")}
        newAccountLabel={t("newAccount")}
        onExport={handleExport}
      />

      <AccountsSearchToolbar
        isPatronView={isPatronView}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder={
          isPatronView
            ? t("patronsSearchPlaceholder")
            : t("searchPlaceholder")
        }
        accountTypeFilter={accountTypeFilter}
        onAccountTypeFilterChange={setAccountTypeFilter}
        filterLabels={{
          allTypes: t("filters.allTypes"),
          lenders: t("filters.lenders"),
          borrowers: t("filters.borrowers"),
          both: t("filters.both"),
          institutions: t("filters.institutions"),
          patrons: t("filters.patrons"),
        }}
      />

      <div className="mt-5 min-h-0 flex-1">
        <AccountList
          organizationId={currentOrganizationId}
          searchQuery={searchQuery}
          canAccessAdministration={canAccessAdministration}
          isPatronView={isPatronView}
          accountType={resolveListAccountType(isPatronView, accountTypeFilter)}
        />
      </div>
    </div>
  );
}

function resolveListAccountType(
  isPatronView: boolean,
  accountTypeFilter: AccountTypeFilter,
): AccountType | undefined {
  if (isPatronView) return "patron";
  if (accountTypeFilter !== "all") return accountTypeFilter;
  return undefined;
}

function getTone(tones: Record<string, string>, key: string | undefined) {
  return tones[key ?? ""] ?? DEFAULT_TONE;
}

function getAccountDisplayName(
  account: AccountListItem,
  unnamedPatron: string,
  unnamedAccount: string,
) {
  if (account.accountType === "patron") {
    return (
      `${account.firstName ?? ""} ${account.lastName ?? ""}`.trim() ||
      unnamedPatron
    );
  }
  return account.businessName ?? unnamedAccount;
}

function AccountsPageHeader({
  canAccessAdministration,
  title,
  description,
  importLabel,
  newAccountLabel,
  onExport,
}: {
  canAccessAdministration: boolean;
  title: string;
  description: string;
  importLabel: string;
  newAccountLabel: string;
  onExport: () => Promise<unknown[]>;
}) {
  return (
    <section className="border-b border-border/60 pb-6 dark:border-white/10">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xl font-medium tracking-tight text-foreground">
            {title}
          </h2>
          <p className="mt-1.5 text-sm text-muted-foreground">{description}</p>
        </div>

        {canAccessAdministration ? (
          <AccountsHeaderActions
            importLabel={importLabel}
            newAccountLabel={newAccountLabel}
            onExport={onExport}
          />
        ) : null}
      </div>
    </section>
  );
}

function AccountsHeaderActions({
  importLabel,
  newAccountLabel,
  onExport,
}: {
  importLabel: string;
  newAccountLabel: string;
  onExport: () => Promise<unknown[]>;
}) {
  const actionClassName =
    "h-8 gap-1.5 border-border/60 px-3 text-xs font-medium tracking-normal dark:border-white/10 [&_svg]:size-3.5";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <PermissionGate permission="accounts.read">
        <ExportCSVButton
          onExport={onExport}
          filename="accounts"
          size="sm"
          className={actionClassName}
        />
      </PermissionGate>
      <PermissionGate permission="accounts.write">
        <Button asChild variant="outline" size="sm" className={actionClassName}>
          <Link href="/accounts/import">
            <FileUp strokeWidth={1.75} />
            <span className="hidden sm:inline">{importLabel}</span>
          </Link>
        </Button>
      </PermissionGate>
      <PermissionGate permission="accounts.write">
        <Button asChild size="sm" className={actionClassName}>
          <Link href="/accounts/new">
            <Plus strokeWidth={1.75} />
            <span className="hidden sm:inline">{newAccountLabel}</span>
          </Link>
        </Button>
      </PermissionGate>
    </div>
  );
}

function AccountsSearchToolbar({
  isPatronView,
  searchQuery,
  onSearchChange,
  searchPlaceholder,
  accountTypeFilter,
  onAccountTypeFilterChange,
  filterLabels,
}: {
  isPatronView: boolean;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder: string;
  accountTypeFilter: AccountTypeFilter;
  onAccountTypeFilterChange: (value: AccountTypeFilter) => void;
  filterLabels: {
    allTypes: string;
    lenders: string;
    borrowers: string;
    both: string;
    institutions: string;
    patrons: string;
  };
}) {
  return (
    <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="relative min-w-0 flex-1 sm:max-w-md">
        <Search
          className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
          strokeWidth={1.75}
        />
        <Input
          placeholder={searchPlaceholder}
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="h-9 border-border/60 pl-9 dark:border-white/10"
        />
      </div>
      {!isPatronView ? (
        <Select
          value={accountTypeFilter}
          onValueChange={(value) =>
            onAccountTypeFilterChange(value as AccountTypeFilter)
          }
        >
          <SelectTrigger className="h-9 w-full border-border/60 sm:w-[180px] dark:border-white/10">
            <SelectValue placeholder={filterLabels.allTypes} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{filterLabels.allTypes}</SelectItem>
            <SelectItem value="lender">{filterLabels.lenders}</SelectItem>
            <SelectItem value="borrower">{filterLabels.borrowers}</SelectItem>
            <SelectItem value="both">{filterLabels.both}</SelectItem>
            <SelectItem value="institution">
              {filterLabels.institutions}
            </SelectItem>
            <SelectItem value="patron">{filterLabels.patrons}</SelectItem>
          </SelectContent>
        </Select>
      ) : null}
    </div>
  );
}

function CenteredMessage({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex size-full items-center justify-center bg-background px-6 py-8">
      <div className="flex flex-col items-center gap-4 rounded-xl border border-border bg-card p-8">
        <Icon className="size-12 text-muted-foreground" strokeWidth={1.5} />
        <div className="text-center">
          <h3 className="text-lg font-semibold text-foreground">{title}</h3>
          <p className="mt-2 text-sm text-muted-foreground">{description}</p>
        </div>
        {action}
      </div>
    </div>
  );
}

function ToneBadge({
  tone,
  className,
  children,
}: {
  tone: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span className={cn(TONE_BADGE, tone, className)}>{children}</span>
  );
}

function ContactLine({
  icon: Icon,
  value,
}: {
  icon: LucideIcon;
  value: string;
}) {
  return (
    <p className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
      <Icon className="size-3 shrink-0 opacity-60" />
      <span className="truncate">{value}</span>
    </p>
  );
}

function ContactLines({
  email,
  phone,
}: {
  email?: string;
  phone?: string;
}) {
  if (!email && !phone)
    return <span className="text-xs text-muted-foreground/50">—</span>;

  return (
    <div className="space-y-0.5">
      {email ? <ContactLine icon={Mail} value={email} /> : null}
      {phone ? <ContactLine icon={Phone} value={phone} /> : null}
    </div>
  );
}

function AccountListEmpty({
  isPatronView,
  searchQuery,
  canAccessAdministration,
  noSearchResultsLabel,
  noAccountsFoundLabel,
  createFirstLabel,
}: {
  isPatronView: boolean;
  searchQuery: string;
  canAccessAdministration: boolean;
  noSearchResultsLabel: string;
  noAccountsFoundLabel: string;
  createFirstLabel: string;
}) {
  return (
    <div className="flex min-h-64 flex-col items-center justify-center rounded-xl border border-border/60 dark:border-white/10">
      <EmptyState
        icon={isPatronView ? User : Users}
        title={searchQuery ? noSearchResultsLabel : noAccountsFoundLabel}
        description={createFirstLabel}
        variant="card"
        size="md"
      />
      {canAccessAdministration ? (
        <PermissionGate permission="loans.create">
          <Button asChild className="mt-4" size="sm">
            <Link href="/accounts/new">
              <Plus className="mr-2 size-3.5" />
              {createFirstLabel}
            </Link>
          </Button>
        </PermissionGate>
      ) : null}
    </div>
  );
}

function AccountList({
  organizationId,
  searchQuery,
  canAccessAdministration,
  isPatronView,
  accountType,
}: {
  organizationId: Id<"organizations">;
  searchQuery: string;
  canAccessAdministration: boolean;
  isPatronView: boolean;
  accountType?: AccountType;
}) {
  const t = useScopedI18n("accounts");
  const accountsResult = useQuery(api.accounts.list, {
    organizationId,
    paginationOpts: { numItems: 50, cursor: null },
    search: searchQuery || undefined,
    accountType,
  });

  if (accountsResult === undefined)
    return <AccountsListSkeleton isPatronView={isPatronView} />;

  const accounts = accountsResult.page as AccountListItem[];

  if (accounts.length === 0) {
    return (
      <AccountListEmpty
        isPatronView={isPatronView}
        searchQuery={searchQuery}
        canAccessAdministration={canAccessAdministration}
        noSearchResultsLabel={t("emptyState.noSearchResults")}
        noAccountsFoundLabel={t("emptyState.noAccountsFound")}
        createFirstLabel={t("emptyState.createFirst")}
      />
    );
  }

  const gridClass = isPatronView ? PATRON_GRID : ACCOUNT_GRID;
  const headers = isPatronView
    ? PATRON_COLUMN_HEADERS
    : ACCOUNT_COLUMN_HEADERS;

  return (
    <div className="overflow-hidden rounded-xl border border-border/60 dark:border-white/10 dark:bg-zinc-900/40">
      <div className="flex items-center justify-between gap-3 border-b border-border/60 bg-background/90 px-4 py-2.5 dark:border-white/10 dark:bg-zinc-950/80">
        <h3 className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
          {isPatronView ? "Members" : "Accounts"}
        </h3>
        <span className="font-mono text-[10px] tabular-nums text-muted-foreground/70">
          {accounts.length}
        </span>
      </div>

      <div className={cn(COLUMN_HEADER, gridClass)}>
        {headers.map((label) => (
          <span key={label}>{label}</span>
        ))}
        <span className="w-8" />
      </div>

      <div className="divide-y divide-border/60 dark:divide-white/10">
        {accounts.map((account) => (
          <AccountRow
            key={account._id}
            account={account}
            isPatronView={isPatronView}
            gridClass={gridClass}
            displayName={getAccountDisplayName(
              account,
              t("list.unnamedPatron"),
              t("list.unnamedAccount"),
            )}
            typeLabel={
              account.accountType ? t(`types.${account.accountType}`) : "—"
            }
          />
        ))}
      </div>
    </div>
  );
}

function AccountRow({
  account,
  isPatronView,
  gridClass,
  displayName,
  typeLabel,
}: {
  account: AccountListItem;
  isPatronView: boolean;
  gridClass: string;
  displayName: string;
  typeLabel: string;
}) {
  const isPatron = account.accountType === "patron";
  const identifier = isPatron ? account.cardNumber : account.accountNumber;
  const Icon = isPatron ? User : Users;
  const typeTone = getTone(TYPE_TONES, account.accountType);
  const statusTone = getTone(STATUS_TONES, account.status);

  return (
    <Link
      href={`/accounts/${account._id}`}
      className={cn(
        "group grid w-full items-center gap-3 px-4 py-3.5 transition-[background-color] duration-150 ease-[cubic-bezier(0.2,0,0,1)] hover:bg-muted/40 md:gap-4",
        gridClass,
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-md border border-border/60 bg-muted/40 dark:border-white/10">
          <Icon className="size-4 text-muted-foreground" strokeWidth={1.75} />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium tracking-tight text-foreground transition-colors group-hover:text-indigo-300">
            {displayName}
          </p>
          <p className="mt-0.5 truncate font-mono text-[10px] tracking-wide text-muted-foreground md:hidden">
            {identifier}
          </p>
          {account.email ? (
            <p className="mt-0.5 truncate text-xs text-muted-foreground md:hidden">
              {account.email}
            </p>
          ) : null}
        </div>
      </div>

      {isPatronView ? (
        <span className="hidden truncate font-mono text-xs text-muted-foreground md:block">
          {identifier ?? "—"}
        </span>
      ) : (
        <ToneBadge
          tone={typeTone}
          className="hidden uppercase tracking-wider md:inline-flex"
        >
          {typeLabel}
        </ToneBadge>
      )}

      <div className="hidden min-w-0 md:block">
        <ContactLines email={account.email} phone={account.phone} />
      </div>

      {isPatronView ? (
        <ToneBadge tone={statusTone} className="gap-1.5 capitalize">
          <span className="size-1 rounded-full bg-current" />
          {account.status ?? "unknown"}
        </ToneBadge>
      ) : (
        <ToneBadge
          tone={typeTone}
          className="uppercase tracking-wider md:hidden"
        >
          {typeLabel}
        </ToneBadge>
      )}

      <div className="ml-auto hidden items-center justify-end md:flex">
        <ArrowRight className="size-3.5 text-muted-foreground/40 transition-[color,transform] duration-150 group-hover:translate-x-0.5 group-hover:text-foreground" />
      </div>
    </Link>
  );
}
