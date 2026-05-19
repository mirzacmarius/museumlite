"use client";

import { ExportCSVButton } from "@/components/export-csv-button";
import { useOrganization } from "@/components/organization-provider";
import { PermissionGate } from "@/components/permission-gate";
import { useFeatureAccess } from "@/hooks/use-feature-access";
import { formatDate } from "@/lib/format-date";
import { useCurrentLocale, useI18n, useScopedI18n } from "@/locales/client";
import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { Checkbox } from "@v1/ui/checkbox";
import { DataTable } from "@v1/ui/data-table";
import { FeatureGuard } from "@v1/ui/feature-guard";
import { Input } from "@v1/ui/input";
import { useMutation, useQuery } from "convex/react";
import {
  AlertCircle,
  ArrowDownLeft,
  ArrowRightLeft,
  ArrowUpRight,
  Boxes,
  Building2,
  ChevronRight,
  Handshake,
  Plus,
  Search,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { LoansBulkActionsBar } from "./_components/loans-bulk-actions-bar";
import { LoansPageSkeleton } from "./loans-page-skeleton";

type LoanStatus =
  | "pending"
  | "active"
  | "dispatched"
  | "returned"
  | "cancelled"
  | "all";
type LoanType = "incoming" | "outgoing" | "all";

export default function LoansPage() {
  const t = useScopedI18n("loans");
  const tToast = useScopedI18n("common.toast");
  const { currentOrganizationId, organizations, isLoading } = useOrganization();
  const { hasFeature } = useFeatureAccess();
  const [statusFilter, setStatusFilter] = useState<LoanStatus>("all");
  const [typeFilter, setTypeFilter] = useState<LoanType>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const exportLoans = useMutation(api.imports.exportLoans);

  const handleExport = useCallback(async () => {
    if (!currentOrganizationId) return [];
    return exportLoans({ organizationId: currentOrganizationId });
  }, [currentOrganizationId, exportLoans]);

  if (isLoading) {
    return <LoansPageSkeleton />;
  }

  if (!organizations || organizations.length === 0) {
    return (
      <div className="flex size-full items-center justify-center bg-background px-6 py-8">
        <div className="flex flex-col items-center gap-4 rounded-lg border border-border bg-card p-8">
          <Building2 className="size-12 text-muted-foreground" />
          <div className="text-center">
            <h3 className="text-lg font-semibold">{t("noOrg.title")}</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {t("noOrg.description")}
            </p>
          </div>
          <Button asChild>
            <Link href="/organizations/new">
              <Plus className="mr-2 size-4" />
              {t("noOrg.createButton")}
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  if (!currentOrganizationId) {
    return (
      <div className="flex size-full items-center justify-center bg-background px-6 py-8">
        <div className="flex flex-col items-center gap-4 rounded-lg border border-border bg-card p-8">
          <Handshake className="size-12 text-muted-foreground" />
          <div className="text-center">
            <h3 className="text-lg font-semibold">{t("selectOrg.title")}</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {t("selectOrg.description")}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <FeatureGuard
      featureName={t("title")}
      isLocked={!hasFeature("loans")}
      tierNeeded="pro"
    >
      <div className="flex size-full flex-col overflow-y-auto bg-background">
        <div className="mx-auto w-full max-w-7xl space-y-6 sm:space-y-8 p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="page-title">{t("title")}</h1>
              <p className="page-description mt-1">{t("description")}</p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <PermissionGate permission="loans.read">
                <ExportCSVButton onExport={handleExport} filename="loans" />
              </PermissionGate>
              <PermissionGate permission="loans.create">
                <Button asChild>
                  <Link href="/loans/new">
                    <Plus className="size-3.5 sm:mr-1" />
                    <span className="hidden sm:inline">{t("newLoan")}</span>
                  </Link>
                </Button>
              </PermissionGate>
            </div>
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
    </FeatureGuard>
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
  const t = useScopedI18n("loans");
  const tToast = useScopedI18n("common.toast");
  const tBulk = useScopedI18n("loans.bulkActions");
  const locale = useCurrentLocale();
  const [selectedIds, setSelectedIds] = useState<Set<Id<"loans">>>(new Set());
  const bulkApprove = useMutation(api.loans.bulkApprove);
  const bulkCancel = useMutation(api.loans.bulkCancel);

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

  const getStatusLabel = (status: string): string => {
    switch (status) {
      case "pending":
        return t("status.pendingReview");
      case "active":
        return t("status.active");
      case "dispatched":
        return t("status.dispatched");
      case "returned":
        return t("status.returned");
      case "cancelled":
        return t("status.cancelled");
      default:
        return t("status.draft");
    }
  };

  const getTypeIcon = (type: string) => {
    return type === "incoming" ? (
      <div className="flex size-6 items-center justify-center rounded bg-muted text-foreground/80">
        <ArrowDownLeft className="size-3" strokeWidth={3} />
      </div>
    ) : (
      <div className="flex size-6 items-center justify-center rounded bg-muted text-foreground/80">
        <ArrowUpRight className="size-3" strokeWidth={3} />
      </div>
    );
  };

  const formatDateRange = (startDate: number, endDate?: number) => {
    const start = new Date(startDate);
    const startStr = formatDate(start, locale, {
      month: "short",
      day: "numeric",
    });

    if (!endDate) return startStr;

    const end = new Date(endDate);
    const endStr = formatDate(end, locale, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

    return `${startStr} — ${endStr}`;
  };

  const getInitial = (name: string) => {
    return name.charAt(0).toUpperCase();
  };

  const toggleSelection = (loanId: Id<"loans">) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(loanId)) {
        next.delete(loanId);
      } else {
        next.add(loanId);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === loansPage.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(loansPage.map((loan) => loan._id as Id<"loans">)));
    }
  };

  const handleBulkApprove = async () => {
    const loanIds = Array.from(selectedIds);
    try {
      const result = await bulkApprove({ loanIds });
      if (result.approved > 0) {
        toast.success(tToast("loansApproved", { count: result.approved }));
      }
      if (result.skipped > 0) {
        toast.warning(tToast("someLoansSkipped", { count: result.skipped }));
      }
      if (result.errors.length > 0) {
        for (const error of result.errors.slice(0, 3)) {
          toast.error(error);
        }
      }
      setSelectedIds(new Set());
    } catch (error) {
      toast.error(tToast("loansApproveFailed"));
    }
  };

  const handleBulkCancel = async () => {
    const loanIds = Array.from(selectedIds);
    try {
      const result = await bulkCancel({ loanIds });
      if (result.cancelled > 0) {
        toast.success(tToast("loansCancelled", { count: result.cancelled }));
      }
      if (result.skipped > 0) {
        toast.warning(tToast("loansCancelSkipped", { count: result.skipped }));
      }
      if (result.errors.length > 0) {
        for (const error of result.errors.slice(0, 3)) {
          toast.error(error);
        }
      }
      setSelectedIds(new Set());
    } catch (error) {
      toast.error(tToast("loansCancelFailed"));
    }
  };

  const handleExport = () => {
    const selectedLoans = loansPage.filter((loan) =>
      selectedIds.has(loan._id as Id<"loans">),
    );
    const csvContent = [
      [
        tBulk("csvHeaders.loanNumber"),
        tBulk("csvHeaders.type"),
        tBulk("csvHeaders.partner"),
        tBulk("csvHeaders.startDate"),
        tBulk("csvHeaders.endDate"),
        tBulk("csvHeaders.status"),
        tBulk("csvHeaders.items"),
      ].join(","),
      ...selectedLoans.map((loan) =>
        [
          loan.loanNumber,
          loan.type,
          `"${loan.lenderBorrowerName}"`,
          new Date(loan.startDate).toISOString().split("T")[0],
          loan.endDate
            ? new Date(loan.endDate).toISOString().split("T")[0]
            : "",
          loan.status,
          loan.itemCount,
        ].join(","),
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `loans-export-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(
      t("actions.exportedLoans", {
        count: selectedLoans.length,
        plural: selectedLoans.length !== 1 ? "s" : "",
      }),
    );
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm transition-all duration-300 hover:border-primary/30 hover:ring-1 hover:ring-primary/30">
          <div className="mb-4 flex items-start justify-between">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20">
              <ArrowRightLeft className="size-4" />
            </div>
            <span className="rounded border border-emerald-500/30 bg-emerald-500/20 px-1.5 py-0.5 text-xs font-medium text-emerald-400">
              +{activeLoansCount} active
            </span>
          </div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {t("kpis.activeLoans")}
          </p>
          <p className="mt-1 text-2xl font-bold tracking-tight">
            {activeLoansCount}
          </p>
        </div>

        <div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm transition-all duration-300 hover:border-emerald-500/30 hover:ring-1 hover:ring-emerald-500/30">
          <div className="mb-4 flex items-start justify-between">
            <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Boxes className="size-4" />
            </div>
          </div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {t("kpis.objectsInTransit")}
          </p>
          <p className="mt-1 text-2xl font-bold tracking-tight">
            {totalItemsInTransit}
          </p>
        </div>

        <div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm transition-all duration-300 hover:border-blue-500/30 hover:ring-1 hover:ring-blue-500/30">
          <div className="mb-4 flex items-start justify-between">
            <div className="flex size-8 items-center justify-center rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <ShieldCheck className="size-4" />
            </div>
          </div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {t("kpis.totalInsuredValue")}
          </p>
          <p className="mt-1 text-2xl font-bold tracking-tight">—</p>
        </div>

        <div className="relative overflow-hidden rounded-xl border border-border/60 bg-card p-4 shadow-sm transition-all duration-300 hover:border-rose-500/30 hover:ring-1 hover:ring-rose-500/30">
          <div className="absolute right-0 top-0 size-16 rounded-full bg-rose-500/10 blur-2xl" />
          <div className="mb-4 flex items-start justify-between">
            <div className="flex size-8 items-center justify-center rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20">
              <AlertCircle className="size-4" />
            </div>
            <span className="rounded border border-rose-500/30 bg-rose-500/20 px-1.5 py-0.5 text-xs font-medium text-rose-400">
              {t("kpis.actionRequired")}
            </span>
          </div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {t("kpis.expiringAgreements")}
          </p>
          <p className="mt-1 text-2xl font-bold tracking-tight">—</p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex flex-col gap-4">
          <div className="flex overflow-x-auto scrollbar-none -mx-4 px-4 sm:mx-0 sm:px-0">
            <div className="flex self-start rounded-lg bg-muted p-1 min-w-max">
              <button
                type="button"
                onClick={() => onTypeFilterChange("all")}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all whitespace-nowrap ${
                  typeFilter === "all"
                    ? "bg-card shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t("filters.allLoans")}
              </button>
              <button
                type="button"
                onClick={() => onTypeFilterChange("outgoing")}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all whitespace-nowrap ${
                  typeFilter === "outgoing"
                    ? "bg-card shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t("filters.outgoing")}
              </button>
              <button
                type="button"
                onClick={() => onTypeFilterChange("incoming")}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all whitespace-nowrap ${
                  typeFilter === "incoming"
                    ? "bg-card shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t("filters.incoming")}
              </button>
              <button
                type="button"
                onClick={() => onStatusFilterChange("pending")}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all whitespace-nowrap ${
                  statusFilter === "pending"
                    ? "bg-card shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t("filters.pending")}
              </button>
            </div>
          </div>

          <div className="flex items-center">
            <div className="group relative w-full sm:w-auto">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <Search className="size-3.5 text-muted-foreground transition-colors group-focus-within:text-cyan-500" />
              </div>
              <Input
                type="text"
                className="block w-full sm:w-48 rounded-lg border border-border/60 bg-card p-2 pl-9 text-xs outline-none transition-all focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                placeholder={t("searchPlaceholder")}
                value={searchQuery}
                onChange={(e) => onSearchQueryChange(e.target.value)}
              />
            </div>
          </div>
        </div>

        <DataTable
          loading={isLoading}
          data={loansPage}
          columns={[
            {
              key: "checkbox",
              label: "",
              className: "w-12 flex-none justify-center px-3",
              render: (loan) => {
                const loanId = loan._id as Id<"loans">;
                const isSelected = selectedIds.has(loanId);
                return (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                    role="presentation"
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleSelection(loanId)}
                      aria-label={`Select loan ${loan.loanNumber}`}
                    />
                  </div>
                );
              },
            },
            {
              key: "type",
              label: t("table.type"),
              className: "w-20 flex-none justify-center px-3",
              render: (loan) => getTypeIcon(loan.type),
            },
            {
              key: "loanNumber",
              label: t("table.loanIdTitle"),
              className: "min-w-0 flex-[1.45]",
              render: (loan) => (
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-xs font-semibold">
                    {loan.loanNumber}
                  </span>
                  <span className="mt-0.5 truncate text-xs text-foreground/80">
                    {loan.itemCount}{" "}
                    {loan.itemCount !== 1
                      ? t("table.itemsPlural")
                      : t("table.items")}
                  </span>
                </div>
              ),
            },
            {
              key: "lenderBorrowerName",
              label: t("table.partnerInstitution"),
              className: "min-w-0 flex-[1.25]",
              render: (loan) => (
                <div className="flex min-w-0 items-center gap-2">
                  <div className="flex size-5 shrink-0 items-center justify-center rounded bg-muted text-[9px] font-bold text-muted-foreground">
                    {getInitial(loan.lenderBorrowerName)}
                  </div>
                  <span className="min-w-0 truncate text-xs">
                    {loan.lenderBorrowerName}
                  </span>
                </div>
              ),
            },
            {
              key: "duration",
              label: t("table.duration"),
              className: "w-40 flex-none",
              render: (loan) => (
                <div className="text-xs text-foreground/80">
                  {formatDateRange(loan.startDate, loan.endDate)}
                </div>
              ),
            },
            {
              key: "status",
              label: t("table.status"),
              className: "w-40 flex-none",
              render: (loan) => (
                <span className="truncate text-xs text-foreground/80">
                  {getStatusLabel(loan.status)}
                </span>
              ),
            },
            {
              key: "action",
              label: "",
              className: "w-12 flex-none justify-center px-3 text-right",
              render: () => (
                <ChevronRight className="inline-block size-4 text-foreground/80" />
              ),
            },
          ]}
          rowHref={(loan) => `/loans/${loan._id}`}
          rowAriaLabel={(loan) => `View loan ${loan.loanNumber ?? loan._id}`}
          emptyState={
            <div className="flex flex-col items-center justify-center gap-4 py-8">
              <Handshake className="size-12 text-muted-foreground/50" />
              <div className="text-center">
                <p className="text-muted-foreground">
                  {t("emptyState.noLoansFound")}
                </p>
                <p className="mt-2 text-sm text-muted-foreground/60">
                  {searchQuery
                    ? t("emptyState.adjustSearch")
                    : statusFilter === "all" && typeFilter === "all"
                      ? t("emptyState.createFirst")
                      : `No ${statusFilter !== "all" ? statusFilter : ""} ${typeFilter !== "all" ? typeFilter : ""} loans`}
                </p>
              </div>
              {statusFilter === "all" && typeFilter === "all" && (
                <PermissionGate permission="loans.create">
                  <Button asChild>
                    <Link href="/loans/new">
                      <Plus className="size-4" />
                      {t("createLoan")}
                    </Link>
                  </Button>
                </PermissionGate>
              )}
            </div>
          }
        />

        {!isLoading && loansPage.length > 0 && (
          <>
            <div className="flex items-center justify-between px-2 pt-2 text-xs text-muted-foreground">
              <span>
                {t("pagination.showing", {
                  start: "1",
                  end: loansPage.length.toString(),
                  total: loansPage.length.toString(),
                })}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="rounded border border-border/60 px-2 py-1 hover:bg-card/50 disabled:opacity-50"
                  disabled
                >
                  {t("pagination.previous")}
                </button>
                <button
                  type="button"
                  className="rounded border border-border/60 px-2 py-1 hover:bg-card/50"
                  disabled={!loans?.continueCursor}
                >
                  {t("pagination.next")}
                </button>
              </div>
            </div>

            <LoansBulkActionsBar
              selectedCount={selectedIds.size}
              onClearSelection={() => setSelectedIds(new Set())}
              onBulkApprove={handleBulkApprove}
              onBulkCancel={handleBulkCancel}
              onExport={handleExport}
            />
          </>
        )}
      </div>
    </div>
  );
}
