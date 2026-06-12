import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { EmptyState } from "@v1/ui/empty-state";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@v1/ui/select";
import { Bookmark, Filter, Loader2, Plus } from "lucide-react";
import type { Dispatch, ReactNode } from "react";
import {
  STATUS_FILTER_VALUES,
  type HoldsPageAction,
  type HoldsPageState,
  type StatusFilter,
} from "./holds-page-state";
import { HoldsList, type Translate } from "./holds-page-parts";

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

interface HoldsMainCardProps {
  state: HoldsPageState;
  dispatch: Dispatch<HoldsPageAction>;
  holds: { page: HoldListItem[] } | undefined;
  formatDate: (timestamp: number) => string;
  getStatusBadge: (status: string) => ReactNode;
  onCancel: (holdId: Id<"libraryHolds">) => void;
  onFulfill: (holdId: Id<"libraryHolds">) => void;
  tHolds: Translate;
  tLib: Translate;
}

export function HoldsMainCard({
  state,
  dispatch,
  holds,
  formatDate,
  getStatusBadge,
  onCancel,
  onFulfill,
  tHolds,
  tLib,
}: HoldsMainCardProps) {
  const getStatusFilterLabel = (value: string) => {
    if (value === "all") return tHolds("filters.allStatus");
    return tHolds(`status.${value}` as "status.pending");
  };

  return (
    <div className="flex w-full flex-col rounded-lg border border-border bg-card">
      <div className="flex w-full items-center justify-between rounded-lg p-6">
        <div className="flex flex-col gap-2">
          <h2 className="text-xl font-medium text-primary">{tHolds("title")}</h2>
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
              <SelectValue>{getStatusFilterLabel(state.statusFilter)}</SelectValue>
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
          onCancel={onCancel}
          onFulfill={onFulfill}
          tHolds={tHolds}
        />
      )}
    </div>
  );
}
