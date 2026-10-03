import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Badge } from "@v1/ui/badge";
import { Button } from "@v1/ui/button";
import { Bookmark, CheckCircle, Clock, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export type Translate = (key: string) => string;

interface AccessStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
}

export function AccessState({
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

export function HoldsStatisticsGrid({
  statistics,
  tHolds,
}: HoldsStatisticsGridProps) {
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
        <p className="text-sm text-muted-foreground">
          {tHolds("stats.fulfilled")}
        </p>
        <p className="mt-2 text-2xl font-medium">{statistics.fulfilled}</p>
      </div>
      <div className="rounded-lg border border-border bg-card p-4">
        <p className="text-sm text-muted-foreground">
          {tHolds("stats.expired")}
        </p>
        <p className="mt-2 text-2xl font-medium">{statistics.expired}</p>
      </div>
      <div className="rounded-lg border border-border bg-card p-4">
        <p className="text-sm text-muted-foreground">
          {tHolds("stats.placedToday")}
        </p>
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

export function HoldsList({
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

export function getHoldStatusBadge(status: string, tHolds: Translate) {
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
}
