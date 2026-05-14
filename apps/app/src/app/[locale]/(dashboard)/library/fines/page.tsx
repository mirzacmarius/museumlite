"use client";

import { DashboardListPageSkeleton } from "@/components/dashboard-list-page-skeleton";
import { useOrganization } from "@/components/organization-provider";
import { useFeatureAccess } from "@/hooks/use-feature-access";
import { formatDate as formatDateUtil } from "@/lib/format-date";
import { formatCurrency } from "@/lib/format-number";
import { useCurrentLocale, useScopedI18n } from "@/locales/client";
import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Badge } from "@v1/ui/badge";
import { Button } from "@v1/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@v1/ui/dialog";
import { EmptyState } from "@v1/ui/empty-state";
import { Input } from "@v1/ui/input";
import { Label } from "@v1/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@v1/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@v1/ui/tabs";
import { useMutation, useQuery } from "convex/react";
import {
  AlertTriangle,
  Building2,
  CheckCircle,
  CreditCard,
  DollarSign,
  Filter,
  Library,
  Loader2,
  type LucideIcon,
  Search,
  X,
} from "lucide-react";
import Link from "next/link";
import { type ReactNode, useReducer } from "react";

const STATUS_FILTER_VALUES = ["all", "outstanding", "paid", "waived"] as const;

type StatusFilter = (typeof STATUS_FILTER_VALUES)[number];
type FineStatus = "outstanding" | "paid" | "waived" | "forgiven" | "refunded";
type PaymentMethod = "cash" | "card" | "check" | "online" | "other";
type Translate = (key: string) => string;
type AppLocale = ReturnType<typeof useCurrentLocale>;

interface SelectedFine {
  _id: Id<"libraryFines">;
  accountId: Id<"accounts">;
  description: string;
  balance: number;
}

interface FinesPageState {
  statusFilter: StatusFilter;
  isPaymentDialogOpen: boolean;
  selectedFine: SelectedFine | null;
  paymentAmount: string;
  paymentMethod: PaymentMethod;
  isProcessing: boolean;
}

type FinesPageAction =
  | { type: "setStatusFilter"; value: StatusFilter }
  | { type: "openPaymentDialog"; fine: SelectedFine }
  | { type: "closePaymentDialog" }
  | { type: "setPaymentAmount"; value: string }
  | { type: "setPaymentMethod"; value: PaymentMethod }
  | { type: "setProcessing"; value: boolean };

const initialFinesPageState: FinesPageState = {
  statusFilter: "all",
  isPaymentDialogOpen: false,
  selectedFine: null,
  paymentAmount: "",
  paymentMethod: "cash",
  isProcessing: false,
};

function finesPageReducer(
  state: FinesPageState,
  action: FinesPageAction,
): FinesPageState {
  switch (action.type) {
    case "setStatusFilter":
      return { ...state, statusFilter: action.value };
    case "openPaymentDialog":
      return {
        ...state,
        isPaymentDialogOpen: true,
        selectedFine: action.fine,
        paymentAmount: action.fine.balance.toString(),
      };
    case "closePaymentDialog":
      return {
        ...state,
        isPaymentDialogOpen: false,
        selectedFine: null,
        paymentAmount: "",
      };
    case "setPaymentAmount":
      return { ...state, paymentAmount: action.value };
    case "setPaymentMethod":
      return { ...state, paymentMethod: action.value };
    case "setProcessing":
      return { ...state, isProcessing: action.value };
  }
}

interface AccessStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
}

function AccessState({
  icon: Icon,
  title,
  description,
  action,
}: AccessStateProps) {
  return (
    <div className="flex size-full items-center justify-center bg-background px-6 py-8">
      <div className="flex flex-col items-center gap-4 rounded-lg border border-border bg-card p-8">
        <Icon className="size-12 text-muted-foreground" />
        <div className="text-center">
          <h3 className="text-lg font-semibold">{title}</h3>
          <p className="mt-2 text-sm text-muted-foreground">{description}</p>
        </div>
        {action}
      </div>
    </div>
  );
}

interface FinesStatistics {
  totalOutstanding: number;
  outstandingCount: number;
  totalCollected: number;
  paidCount: number;
  totalWaived: number;
  waivedCount: number;
  collectedToday: number;
  createdToday: number;
}

interface FinesStatisticsGridProps {
  statistics: FinesStatistics;
  locale: AppLocale;
  tFines: Translate;
}

function FinesStatisticsGrid({
  statistics,
  locale,
  tFines,
}: FinesStatisticsGridProps) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      <div className="rounded-lg border border-destructive bg-destructive/10 p-4">
        <div className="flex items-center gap-2 text-destructive">
          <AlertTriangle className="size-4" />
          <span className="text-sm">{tFines("stats.outstanding")}</span>
        </div>
        <p className="mt-2 text-2xl font-medium text-destructive">
          {formatCurrency(statistics.totalOutstanding, locale, "USD")}
        </p>
        <p className="text-xs text-muted-foreground">
          {statistics.outstandingCount} {tFines("stats.fines")}
        </p>
      </div>
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-center gap-2 text-green-500">
          <CheckCircle className="size-4" />
          <span className="text-sm">{tFines("stats.collected")}</span>
        </div>
        <p className="mt-2 text-2xl font-medium">
          {formatCurrency(statistics.totalCollected, locale, "USD")}
        </p>
        <p className="text-xs text-muted-foreground">
          {statistics.paidCount} {tFines("stats.paid")}
        </p>
      </div>
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-center gap-2 text-muted-foreground">
          <X className="size-4" />
          <span className="text-sm">{tFines("stats.waived")}</span>
        </div>
        <p className="mt-2 text-2xl font-medium">
          {formatCurrency(statistics.totalWaived, locale, "USD")}
        </p>
        <p className="text-xs text-muted-foreground">
          {statistics.waivedCount} {tFines("stats.waivedCount")}
        </p>
      </div>
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-center gap-2 text-muted-foreground">
          <CreditCard className="size-4" />
          <span className="text-sm">{tFines("stats.today")}</span>
        </div>
        <p className="mt-2 text-2xl font-medium">
          {formatCurrency(statistics.collectedToday, locale, "USD")}
        </p>
        <p className="text-xs text-muted-foreground">
          {statistics.createdToday} {tFines("stats.createdToday")}
        </p>
      </div>
    </div>
  );
}

interface FineListItem {
  _id: Id<"libraryFines">;
  accountId: Id<"accounts">;
  account?: {
    firstName?: string;
    lastName?: string;
  } | null;
  amountPaid: number;
  balance: number;
  createdAt: number;
  description: string;
  fineType: string;
  status: string;
}

interface FinesListProps {
  fines: FineListItem[];
  formatDate: (timestamp: number) => string;
  getFineTypeBadge: (type: string) => ReactNode;
  getStatusBadge: (status: string) => ReactNode;
  isProcessing: boolean;
  locale: AppLocale;
  onOpenPayment: (fine: SelectedFine) => void;
  onWaive: (fine: { _id: Id<"libraryFines"> }) => void;
  tFines: Translate;
}

function FinesList({
  fines,
  formatDate,
  getFineTypeBadge,
  getStatusBadge,
  isProcessing,
  locale,
  onOpenPayment,
  onWaive,
  tFines,
}: FinesListProps) {
  return (
    <div className="p-6">
      <div className="space-y-4">
        {fines.map((fine) => (
          <div
            key={fine._id}
            className="flex items-center justify-between rounded-lg border border-border p-4"
          >
            <div className="flex items-center gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-medium">
                    {fine.account?.firstName} {fine.account?.lastName}
                  </p>
                  {getStatusBadge(fine.status)}
                  {getFineTypeBadge(fine.fineType)}
                </div>
                <p className="text-sm text-muted-foreground">
                  {fine.description}
                </p>
                <p className="text-xs text-muted-foreground">
                  {tFines("labels.created")} {formatDate(fine.createdAt)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-lg font-medium">
                  {formatCurrency(fine.balance, locale, "USD")}
                </p>
                {fine.amountPaid > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {tFines("labels.paid")}{" "}
                    {formatCurrency(fine.amountPaid, locale, "USD")}
                  </p>
                )}
              </div>
              {fine.status === "outstanding" && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onWaive(fine)}
                    disabled={isProcessing}
                  >
                    {tFines("actions.waive")}
                  </Button>
                  <Button
                    size="sm"
                    onClick={() =>
                      onOpenPayment({
                        _id: fine._id,
                        accountId: fine.accountId,
                        description: fine.description,
                        balance: fine.balance,
                      })
                    }
                  >
                    <CreditCard className="mr-2 size-4" />
                    {tFines("actions.pay")}
                  </Button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

interface FinesPanelProps {
  fines:
    | {
        page: FineListItem[];
      }
    | undefined;
  formatDate: (timestamp: number) => string;
  getFineTypeBadge: (type: string) => ReactNode;
  getStatusBadge: (status: string) => ReactNode;
  getStatusFilterLabel: (value: string) => string;
  isProcessing: boolean;
  locale: AppLocale;
  onOpenPayment: (fine: SelectedFine) => void;
  onStatusFilterChange: (value: StatusFilter) => void;
  onWaive: (fine: { _id: Id<"libraryFines"> }) => void;
  statusFilter: StatusFilter;
  tFines: Translate;
  tLib: Translate;
}

function FinesPanel({
  fines,
  formatDate,
  getFineTypeBadge,
  getStatusBadge,
  getStatusFilterLabel,
  isProcessing,
  locale,
  onOpenPayment,
  onStatusFilterChange,
  onWaive,
  statusFilter,
  tFines,
  tLib,
}: FinesPanelProps) {
  return (
    <div className="flex w-full flex-col rounded-lg border border-border bg-card">
      <div className="flex w-full items-center justify-between rounded-lg p-6">
        <div className="flex flex-col gap-2">
          <h2 className="text-xl font-medium text-primary">
            {tFines("title")}
          </h2>
          <p className="text-sm font-normal text-primary/60">
            {tFines("description")}
          </p>
        </div>
      </div>
      <div className="flex w-full px-6">
        <div className="w-full border-b border-border" />
      </div>

      <div className="border-b border-border px-6 py-4">
        <div className="flex gap-4">
          <div className="flex items-center gap-2">
            <Filter className="size-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              {tLib("filters")}:
            </span>
          </div>
          <Select value={statusFilter} onValueChange={onStatusFilterChange}>
            <SelectTrigger className="w-40">
              <SelectValue>{getStatusFilterLabel(statusFilter)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {STATUS_FILTER_VALUES.map((value) => (
                <SelectItem key={value} value={value}>
                  {getStatusFilterLabel(value)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {fines === undefined ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : fines.page.length === 0 ? (
        <div className="flex h-64 items-center justify-center p-6">
          <EmptyState
            icon={DollarSign}
            title={
              statusFilter !== "all"
                ? tFines("emptyState.noFinesFiltered")
                : tFines("emptyState.noFines")
            }
            description={
              statusFilter !== "all"
                ? tFines("emptyState.tryAdjustFilters")
                : tFines("emptyState.noFinesDescription")
            }
          />
        </div>
      ) : (
        <FinesList
          fines={fines.page}
          formatDate={formatDate}
          getFineTypeBadge={getFineTypeBadge}
          getStatusBadge={getStatusBadge}
          isProcessing={isProcessing}
          locale={locale}
          onOpenPayment={onOpenPayment}
          onWaive={onWaive}
          tFines={tFines}
        />
      )}
    </div>
  );
}

interface PaymentDialogProps {
  isOpen: boolean;
  isProcessing: boolean;
  locale: AppLocale;
  paymentAmount: string;
  paymentMethod: PaymentMethod;
  selectedFine: SelectedFine | null;
  onClose: () => void;
  onPaymentAmountChange: (value: string) => void;
  onPaymentMethodChange: (value: PaymentMethod) => void;
  onRecordPayment: () => void;
  tFines: Translate;
  tLib: Translate;
}

function PaymentDialog({
  isOpen,
  isProcessing,
  locale,
  paymentAmount,
  paymentMethod,
  selectedFine,
  onClose,
  onPaymentAmountChange,
  onPaymentMethodChange,
  onRecordPayment,
  tFines,
  tLib,
}: PaymentDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{tFines("paymentDialog.title")}</DialogTitle>
          <DialogDescription>
            {tFines("paymentDialog.description")}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {selectedFine && (
            <div className="rounded-lg border border-border p-4">
              <p className="font-medium">{selectedFine.description}</p>
              <p className="text-sm text-muted-foreground">
                {tFines("labels.balance")}{" "}
                {formatCurrency(selectedFine.balance, locale, "USD")}
              </p>
            </div>
          )}
          <div className="space-y-2">
            <Label>{tFines("paymentDialog.amount")}</Label>
            <Input
              type="number"
              step="0.01"
              value={paymentAmount}
              onChange={(event) => onPaymentAmountChange(event.target.value)}
              placeholder={tFines("paymentDialog.amountPlaceholder")}
            />
          </div>
          <div className="space-y-2">
            <Label>{tFines("paymentDialog.paymentMethod")}</Label>
            <Select value={paymentMethod} onValueChange={onPaymentMethodChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">
                  {tFines("paymentMethods.cash")}
                </SelectItem>
                <SelectItem value="card">
                  {tFines("paymentMethods.card")}
                </SelectItem>
                <SelectItem value="check">
                  {tFines("paymentMethods.check")}
                </SelectItem>
                <SelectItem value="online">
                  {tFines("paymentMethods.online")}
                </SelectItem>
                <SelectItem value="other">
                  {tFines("paymentMethods.other")}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {tLib("cancel")}
          </Button>
          <Button
            onClick={onRecordPayment}
            disabled={isProcessing || !paymentAmount}
          >
            {isProcessing && <Loader2 className="mr-2 size-4 animate-spin" />}
            {tFines("paymentDialog.recordPayment")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function LibraryFinesPage() {
  const { currentOrganizationId, organizations, isLoading } = useOrganization();
  const { hasModule } = useFeatureAccess();
  const locale = useCurrentLocale();
  const tLib = useScopedI18n("library");
  const tFines = useScopedI18n("library.fines");
  const [state, dispatch] = useReducer(finesPageReducer, initialFinesPageState);

  const isLibraryEnabled = hasModule("library");

  const statistics = useQuery(
    api.library.fines.getStatistics,
    currentOrganizationId && isLibraryEnabled
      ? { organizationId: currentOrganizationId as Id<"organizations"> }
      : "skip",
  );

  const fines = useQuery(
    api.library.fines.list,
    currentOrganizationId && isLibraryEnabled
      ? {
          organizationId: currentOrganizationId as Id<"organizations">,
          paginationOpts: { numItems: 50, cursor: null },
          status:
            state.statusFilter !== "all"
              ? (state.statusFilter as FineStatus)
              : undefined,
        }
      : "skip",
  );

  const recordPayment = useMutation(api.library.fines.recordPayment);
  const waiveFine = useMutation(api.library.fines.waive);

  const handlePayment = async () => {
    if (!state.selectedFine || !state.paymentAmount) return;
    dispatch({ type: "setProcessing", value: true });
    try {
      await recordPayment({
        accountId: state.selectedFine.accountId,
        amount: Number.parseFloat(state.paymentAmount),
        paymentMethod: state.paymentMethod,
        fineIds: [state.selectedFine._id],
      });
      dispatch({ type: "closePaymentDialog" });
    } catch (error) {
      console.error("Payment failed:", error);
    } finally {
      dispatch({ type: "setProcessing", value: false });
    }
  };

  const handleWaive = async (fine: { _id: Id<"libraryFines"> }) => {
    dispatch({ type: "setProcessing", value: true });
    try {
      await waiveFine({ fineId: fine._id });
    } catch (error) {
      console.error("Waive failed:", error);
    } finally {
      dispatch({ type: "setProcessing", value: false });
    }
  };

  if (isLoading) {
    return <DashboardListPageSkeleton actionsCount={1} showStats />;
  }

  if (!organizations || organizations.length === 0) {
    return (
      <AccessState
        icon={Building2}
        title={tFines("noOrganization")}
        description={tFines("noOrganizationDescription")}
        action={
          <Button asChild>
            <Link href="/organizations/new">{tLib("createOrganization")}</Link>
          </Button>
        }
      />
    );
  }

  if (!currentOrganizationId) {
    return (
      <AccessState
        icon={Library}
        title={tFines("selectOrganization")}
        description={tFines("selectOrganizationDescription")}
      />
    );
  }

  if (isLibraryEnabled === false) {
    return (
      <AccessState
        icon={Library}
        title={tFines("notEnabled")}
        description={tFines("notEnabledDescription")}
        action={
          <Button asChild>
            <Link href="/settings/integrations">
              {tLib("enableIntegration")}
            </Link>
          </Button>
        }
      />
    );
  }

  const formatDate = (timestamp: number) => {
    return formatDateUtil(new Date(timestamp), locale);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "outstanding":
        return (
          <Badge variant="destructive">{tFines("status.outstanding")}</Badge>
        );
      case "paid":
        return (
          <Badge variant="default" className="bg-green-500">
            {tFines("status.paid")}
          </Badge>
        );
      case "waived":
        return <Badge variant="secondary">{tFines("status.waived")}</Badge>;
      case "forgiven":
        return <Badge variant="outline">{tFines("status.forgiven")}</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getFineTypeBadge = (type: string) => {
    switch (type) {
      case "overdue":
        return <Badge variant="outline">{tFines("fineTypes.overdue")}</Badge>;
      case "lost_item":
        return (
          <Badge variant="destructive">{tFines("fineTypes.lostItem")}</Badge>
        );
      case "damaged_item":
        return (
          <Badge variant="default" className="bg-orange-500">
            {tFines("fineTypes.damaged")}
          </Badge>
        );
      default:
        return <Badge variant="secondary">{type}</Badge>;
    }
  };

  const getStatusFilterLabel = (value: string) => {
    switch (value) {
      case "all":
        return tFines("filters.allStatus");
      case "outstanding":
        return tFines("status.outstanding");
      case "paid":
        return tFines("status.paid");
      case "waived":
        return tFines("status.waived");
      default:
        return value;
    }
  };

  return (
    <div className="flex size-full bg-background px-6">
      <div className="z-10 mx-auto flex size-full max-w-screen-xl flex-col gap-6 py-6">
        {statistics && (
          <FinesStatisticsGrid
            statistics={statistics}
            locale={locale}
            tFines={tFines}
          />
        )}

        <FinesPanel
          fines={fines}
          formatDate={formatDate}
          getFineTypeBadge={getFineTypeBadge}
          getStatusBadge={getStatusBadge}
          getStatusFilterLabel={getStatusFilterLabel}
          isProcessing={state.isProcessing}
          locale={locale}
          onOpenPayment={(fine) =>
            dispatch({ type: "openPaymentDialog", fine })
          }
          onStatusFilterChange={(value) =>
            dispatch({ type: "setStatusFilter", value })
          }
          onWaive={handleWaive}
          statusFilter={state.statusFilter}
          tFines={tFines}
          tLib={tLib}
        />

        <PaymentDialog
          isOpen={state.isPaymentDialogOpen}
          isProcessing={state.isProcessing}
          locale={locale}
          paymentAmount={state.paymentAmount}
          paymentMethod={state.paymentMethod}
          selectedFine={state.selectedFine}
          onClose={() => dispatch({ type: "closePaymentDialog" })}
          onPaymentAmountChange={(value) =>
            dispatch({ type: "setPaymentAmount", value })
          }
          onPaymentMethodChange={(value) =>
            dispatch({ type: "setPaymentMethod", value })
          }
          onRecordPayment={handlePayment}
          tFines={tFines}
          tLib={tLib}
        />
      </div>
    </div>
  );
}
