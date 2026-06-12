"use client";

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
import { useMutation, useQuery } from "convex/react";
import {
  Bookmark,
  Building2,
  CheckCircle,
  Clock,
  Filter,
  Library,
  Loader2,
  Plus,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { type ReactNode, useReducer } from "react";
import { DashboardListPageSkeleton } from "@/components/dashboard-list-page-skeleton";
import { useOrganization } from "@/components/organization-provider";
import { useFeatureAccess } from "@/hooks/use-feature-access";
import { formatDate as formatDateUtil } from "@/lib/format-date";
import { useCurrentLocale, useScopedI18n } from "@/locales/client";

const STATUS_FILTER_VALUES = [
  "all",
  "pending",
  "available",
  "fulfilled",
  "cancelled",
  "expired",
] as const;

type StatusFilter = (typeof STATUS_FILTER_VALUES)[number];
type HoldStatus =
  | "pending"
  | "available"
  | "fulfilled"
  | "cancelled"
  | "expired";
type Translate = (key: string) => string;

interface HoldsPageState {
  statusFilter: StatusFilter;
  isPlaceHoldDialogOpen: boolean;
  patronCardNumber: string;
  itemSearch: string;
  selectedPatronId: Id<"accounts"> | null;
  selectedItemId: Id<"libraryItems"> | null;
  isProcessing: boolean;
}

type HoldsPageAction =
  | { type: "setStatusFilter"; value: StatusFilter }
  | { type: "openPlaceHoldDialog" }
  | { type: "closePlaceHoldDialog" }
  | { type: "setPatronCardNumber"; value: string }
  | { type: "setItemSearch"; value: string }
  | { type: "selectPatron"; patronId: Id<"accounts"> }
  | { type: "selectItem"; itemId: Id<"libraryItems"> }
  | { type: "setProcessing"; value: boolean };

const initialHoldsPageState: HoldsPageState = {
  statusFilter: "all",
  isPlaceHoldDialogOpen: false,
  patronCardNumber: "",
  itemSearch: "",
  selectedPatronId: null,
  selectedItemId: null,
  isProcessing: false,
};

function holdsPageReducer(
  state: HoldsPageState,
  action: HoldsPageAction,
): HoldsPageState {
  switch (action.type) {
    case "setStatusFilter":
      return { ...state, statusFilter: action.value };
    case "openPlaceHoldDialog":
      return {
        ...state,
        isPlaceHoldDialogOpen: true,
        patronCardNumber: "",
        itemSearch: "",
        selectedPatronId: null,
        selectedItemId: null,
      };
    case "closePlaceHoldDialog":
      return {
        ...state,
        isPlaceHoldDialogOpen: false,
        patronCardNumber: "",
        itemSearch: "",
        selectedPatronId: null,
        selectedItemId: null,
      };
    case "setPatronCardNumber":
      return { ...state, patronCardNumber: action.value, selectedPatronId: null };
    case "setItemSearch":
      return { ...state, itemSearch: action.value, selectedItemId: null };
    case "selectPatron":
      return { ...state, selectedPatronId: action.patronId };
    case "selectItem":
      return { ...state, selectedItemId: action.itemId };
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

interface HoldsStatistics {
  total: number;
  pending: number;
  available: number;
  fulfilled: number;
  expired: number;
  placedToday: number;
}

interface HoldsStatisticsGridProps {
  statistics: HoldsStatistics;
  tHolds: Translate;
}

function HoldsStatisticsGrid({ statistics, tHolds }: HoldsStatisticsGridProps) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Bookmark className="size-4" />
          <span className="text-sm">{tHolds("stats.total")}</span>
        </div>
        <p className="mt-2 text-2xl font-medium">{statistics.total}</p>
      </div>
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Clock className="size-4" />
          <span className="text-sm">{tHolds("stats.pending")}</span>
        </div>
        <p className="mt-2 text-2xl font-medium">{statistics.pending}</p>
      </div>
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-center gap-2 text-green-500">
          <CheckCircle className="size-4" />
          <span className="text-sm">{tHolds("stats.available")}</span>
        </div>
        <p className="mt-2 text-2xl font-medium">{statistics.available}</p>
      </div>
      <div className="rounded-lg border border-border bg-card p-4">
        <p className="text-sm text-muted-foreground">{tHolds("stats.fulfilled")}</p>
        <p className="mt-2 text-2xl font-medium">{statistics.fulfilled}</p>
      </div>
      <div className="rounded-lg border border-border bg-card p-4">
        <p className="text-sm text-muted-foreground">{tHolds("stats.expired")}</p>
        <p className="mt-2 text-2xl font-medium">{statistics.expired}</p>
      </div>
      <div className="rounded-lg border border-border bg-card p-4">
        <p className="text-sm text-muted-foreground">{tHolds("stats.placedToday")}</p>
        <p className="mt-2 text-2xl font-medium">{statistics.placedToday}</p>
      </div>
    </div>
  );
}

interface HoldListItem {
  _id: Id<"libraryHolds">;
  status: string;
  queuePosition: number;
  holdDate: number;
  account?: {
    firstName?: string;
    lastName?: string;
    cardNumber?: string;
  } | null;
  item?: {
    title?: string;
    authors?: string[];
  } | null;
}

interface HoldsListProps {
  holds: HoldListItem[];
  formatDate: (timestamp: number) => string;
  getStatusBadge: (status: string) => ReactNode;
  isProcessing: boolean;
  onCancel: (holdId: Id<"libraryHolds">) => void;
  onFulfill: (holdId: Id<"libraryHolds">) => void;
  tHolds: Translate;
}

function HoldsList({
  holds,
  formatDate,
  getStatusBadge,
  isProcessing,
  onCancel,
  onFulfill,
  tHolds,
}: HoldsListProps) {
  return (
    <div className="space-y-4 p-6">
      {holds.map((hold) => (
        <div
          key={hold._id}
          className="flex items-center justify-between rounded-lg border border-border p-4"
        >
          <div>
            <div className="flex items-center gap-2">
              <p className="font-medium">
                {hold.account?.firstName} {hold.account?.lastName}
              </p>
              {getStatusBadge(hold.status)}
              <Badge variant="outline">
                {tHolds("labels.queue")} #{hold.queuePosition}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">{hold.item?.title}</p>
            {hold.item?.authors?.length ? (
              <p className="text-xs text-muted-foreground">
                {hold.item.authors.join(", ")}
              </p>
            ) : null}
            <p className="text-xs text-muted-foreground">
              {tHolds("labels.placed")} {formatDate(hold.holdDate)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {hold.status === "available" && (
              <Button
                size="sm"
                onClick={() => onFulfill(hold._id)}
                disabled={isProcessing}
              >
                {tHolds("actions.fulfill")}
              </Button>
            )}
            {(hold.status === "pending" || hold.status === "available") && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onCancel(hold._id)}
                disabled={isProcessing}
              >
                {tHolds("actions.cancel")}
              </Button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export function LibraryHoldsPageClient() {
  const { currentOrganizationId, organizations, isLoading } = useOrganization();
  const { hasModule } = useFeatureAccess();
  const locale = useCurrentLocale();
  const tLib = useScopedI18n("library");
  const tHolds = useScopedI18n("library.holds");
  const [state, dispatch] = useReducer(holdsPageReducer, initialHoldsPageState);

  const isLibraryEnabled = hasModule("library");

  const statistics = useQuery(
    api.library.holds.getStatistics,
    currentOrganizationId && isLibraryEnabled
      ? { organizationId: currentOrganizationId as Id<"organizations"> }
      : "skip",
  );

  const holds = useQuery(
    api.library.holds.list,
    currentOrganizationId && isLibraryEnabled
      ? {
          organizationId: currentOrganizationId as Id<"organizations">,
          paginationOpts: { numItems: 50, cursor: null },
          status:
            state.statusFilter !== "all"
              ? (state.statusFilter as HoldStatus)
              : undefined,
        }
      : "skip",
  );

  const patronLookup = useQuery(
    api.accounts.getByCardNumber,
    currentOrganizationId &&
      state.isPlaceHoldDialogOpen &&
      state.patronCardNumber.trim() &&
      isLibraryEnabled
      ? {
          organizationId: currentOrganizationId as Id<"organizations">,
          cardNumber: state.patronCardNumber.trim(),
        }
      : "skip",
  );

  const itemResults = useQuery(
    api.library.items.list,
    currentOrganizationId &&
      state.isPlaceHoldDialogOpen &&
      state.itemSearch.trim() &&
      isLibraryEnabled
      ? {
          organizationId: currentOrganizationId as Id<"organizations">,
          paginationOpts: { numItems: 10, cursor: null },
          search: state.itemSearch.trim(),
        }
      : "skip",
  );

  const placeHold = useMutation(api.library.holds.place);
  const cancelHold = useMutation(api.library.holds.cancel);
  const fulfillHold = useMutation(api.library.holds.fulfill);

  const handlePlaceHold = async () => {
    if (!state.selectedPatronId || !state.selectedItemId) return;
    dispatch({ type: "setProcessing", value: true });
    try {
      await placeHold({
        accountId: state.selectedPatronId,
        itemId: state.selectedItemId,
      });
      dispatch({ type: "closePlaceHoldDialog" });
    } catch (error) {
      console.error("Place hold failed:", error);
    } finally {
      dispatch({ type: "setProcessing", value: false });
    }
  };

  const handleCancel = async (holdId: Id<"libraryHolds">) => {
    dispatch({ type: "setProcessing", value: true });
    try {
      await cancelHold({ holdId });
    } catch (error) {
      console.error("Cancel hold failed:", error);
    } finally {
      dispatch({ type: "setProcessing", value: false });
    }
  };

  const handleFulfill = async (holdId: Id<"libraryHolds">) => {
    dispatch({ type: "setProcessing", value: true });
    try {
      await fulfillHold({ holdId });
    } catch (error) {
      console.error("Fulfill hold failed:", error);
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
        title={tHolds("noOrganization")}
        description={tHolds("noOrganizationDescription")}
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
        title={tHolds("selectOrganization")}
        description={tHolds("selectOrganizationDescription")}
      />
    );
  }

  if (isLibraryEnabled === false) {
    return (
      <AccessState
        icon={Library}
        title={tHolds("notEnabled")}
        description={tHolds("notEnabledDescription")}
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

  const formatDate = (timestamp: number) =>
    formatDateUtil(new Date(timestamp), locale);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="secondary">{tHolds("status.pending")}</Badge>;
      case "available":
        return (
          <Badge variant="default" className="bg-green-500">
            {tHolds("status.available")}
          </Badge>
        );
      case "fulfilled":
        return <Badge variant="outline">{tHolds("status.fulfilled")}</Badge>;
      case "cancelled":
        return <Badge variant="outline">{tHolds("status.cancelled")}</Badge>;
      case "expired":
        return <Badge variant="destructive">{tHolds("status.expired")}</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getStatusFilterLabel = (value: string) => {
    if (value === "all") return tHolds("filters.allStatus");
    return tHolds(`status.${value}` as "status.pending");
  };

  const itemPage = itemResults?.page ?? [];

  return (
    <div className="flex size-full bg-background px-6">
      <div className="z-10 mx-auto flex size-full max-w-screen-xl flex-col gap-6 py-6">
        {statistics && (
          <HoldsStatisticsGrid statistics={statistics} tHolds={tHolds} />
        )}

        <div className="flex w-full flex-col rounded-lg border border-border bg-card">
          <div className="flex w-full items-center justify-between rounded-lg p-6">
            <div className="flex flex-col gap-2">
              <h2 className="text-xl font-medium text-primary">
                {tHolds("title")}
              </h2>
              <p className="text-sm font-normal text-primary/60">
                {tHolds("description")}
              </p>
            </div>
            <Button onClick={() => dispatch({ type: "openPlaceHoldDialog" })}>
              <Plus className="mr-2 size-4" />
              {tHolds("actions.placeHold")}
            </Button>
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
              <Select
                value={state.statusFilter}
                onValueChange={(value) =>
                  dispatch({
                    type: "setStatusFilter",
                    value: value as StatusFilter,
                  })
                }
              >
                <SelectTrigger className="w-44">
                  <SelectValue>
                    {getStatusFilterLabel(state.statusFilter)}
                  </SelectValue>
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

          {holds === undefined ? (
            <div className="flex h-64 items-center justify-center">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : holds.page.length === 0 ? (
            <div className="flex h-64 items-center justify-center p-6">
              <EmptyState
                icon={Bookmark}
                title={
                  state.statusFilter !== "all"
                    ? tHolds("emptyState.noHoldsFiltered")
                    : tHolds("emptyState.noHolds")
                }
                description={
                  state.statusFilter !== "all"
                    ? tHolds("emptyState.tryAdjustFilters")
                    : tHolds("emptyState.noHoldsDescription")
                }
              />
            </div>
          ) : (
            <HoldsList
              holds={holds.page}
              formatDate={formatDate}
              getStatusBadge={getStatusBadge}
              isProcessing={state.isProcessing}
              onCancel={handleCancel}
              onFulfill={handleFulfill}
              tHolds={tHolds}
            />
          )}
        </div>

        <Dialog
          open={state.isPlaceHoldDialogOpen}
          onOpenChange={(open) =>
            !open && dispatch({ type: "closePlaceHoldDialog" })
          }
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{tHolds("placeDialog.title")}</DialogTitle>
              <DialogDescription>
                {tHolds("placeDialog.description")}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>{tHolds("placeDialog.patronCard")}</Label>
                <Input
                  value={state.patronCardNumber}
                  onChange={(event) =>
                    dispatch({
                      type: "setPatronCardNumber",
                      value: event.target.value,
                    })
                  }
                  placeholder={tLib("placeholders.scanPatronOrBarcode")}
                />
                {patronLookup && (
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() =>
                      dispatch({
                        type: "selectPatron",
                        patronId: patronLookup._id,
                      })
                    }
                  >
                    {patronLookup.firstName} {patronLookup.lastName}
                    {patronLookup.cardNumber
                      ? ` (${patronLookup.cardNumber})`
                      : ""}
                  </Button>
                )}
              </div>
              <div className="space-y-2">
                <Label>{tHolds("placeDialog.itemSearch")}</Label>
                <Input
                  value={state.itemSearch}
                  onChange={(event) =>
                    dispatch({
                      type: "setItemSearch",
                      value: event.target.value,
                    })
                  }
                  placeholder={tLib("placeholders.searchCatalog")}
                />
                {itemPage.length > 0 && (
                  <div className="max-h-40 space-y-1 overflow-y-auto">
                    {itemPage.map((item) => (
                      <Button
                        key={item._id}
                        type="button"
                        variant={
                          state.selectedItemId === item._id
                            ? "default"
                            : "outline"
                        }
                        className="w-full justify-start"
                        onClick={() =>
                          dispatch({
                            type: "selectItem",
                            itemId: item._id,
                          })
                        }
                      >
                        {item.title}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => dispatch({ type: "closePlaceHoldDialog" })}
              >
                {tLib("cancel")}
              </Button>
              <Button
                onClick={() => void handlePlaceHold()}
                disabled={
                  state.isProcessing ||
                  !state.selectedPatronId ||
                  !state.selectedItemId
                }
              >
                {state.isProcessing && (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                )}
                {tHolds("actions.placeHold")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
