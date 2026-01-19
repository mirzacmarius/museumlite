"use client";

import { PermissionGate } from "@/components/permission-gate";
import { formatDate } from "@/lib/format-date";
import { useCurrentLocale } from "@/locales/client";
import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Timeline } from "@v1/ui/timeline";
import { useQuery } from "convex/react";

interface TransportStatusProps {
  loanId: Id<"loans">;
}

export function TransportStatus({ loanId }: TransportStatusProps) {
  return (
    <PermissionGate permission="loans.view_transport">
      <TransportStatusContent loanId={loanId} />
    </PermissionGate>
  );
}

function TransportStatusContent({ loanId }: TransportStatusProps) {
  const locale = useCurrentLocale();
  const transitRecords = useQuery(api.transit.getTransitForLoanWithHistory, {
    loanId,
    limit: 5,
  });

  if (transitRecords === undefined) {
    return <TransportStatusSkeleton />;
  }

  if (transitRecords.length === 0) {
    return (
      <div className="rounded-lg border border-white/10 bg-black p-6">
        <h3 className="text-sm font-medium text-white/80 mb-4">
          Transport Status
        </h3>
        <p className="text-xs text-white/60">No transport records</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-white/10 bg-black p-6">
      <h3 className="text-sm font-medium text-white/80 mb-4">
        Transport Status
      </h3>
      <div className="space-y-6">
        {transitRecords.map((record) => (
          <div key={record._id} className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-white/70">
                {record.transitNumber}
              </span>
              <span className="text-xs text-white/60">{record.carrier}</span>
            </div>
            {record.statusHistory.length > 0 && (
              <Timeline
                items={record.statusHistory.map((update) => ({
                  title: formatStatus(update.status),
                  description: update.description,
                  date: formatDate(new Date(update.reportedAt), locale),
                  status: mapStatusToTimelineStatus(update.status),
                }))}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function TransportStatusSkeleton() {
  return (
    <div className="rounded-lg border border-white/10 bg-black p-6">
      <div className="h-4 w-32 bg-white/10 rounded animate-pulse mb-4" />
      <div className="space-y-3">
        <div className="h-3 w-full bg-white/10 rounded animate-pulse" />
        <div className="h-3 w-3/4 bg-white/10 rounded animate-pulse" />
        <div className="h-3 w-5/6 bg-white/10 rounded animate-pulse" />
      </div>
    </div>
  );
}

function formatStatus(
  status:
    | "draft"
    | "scheduled"
    | "in_transit"
    | "out_for_delivery"
    | "delivered"
    | "delayed"
    | "held"
    | "returned"
    | "cancelled",
): string {
  const statusMap: Record<string, string> = {
    draft: "Draft",
    scheduled: "Scheduled",
    in_transit: "In Transit",
    out_for_delivery: "Out for Delivery",
    delivered: "Delivered",
    delayed: "Delayed",
    held: "Held",
    returned: "Returned",
    cancelled: "Cancelled",
  };
  return statusMap[status] ?? status;
}

function mapStatusToTimelineStatus(
  status:
    | "draft"
    | "scheduled"
    | "in_transit"
    | "out_for_delivery"
    | "delivered"
    | "delayed"
    | "held"
    | "returned"
    | "cancelled",
): "pending" | "active" | "completed" | "overdue" | undefined {
  const statusMap: Record<
    string,
    "pending" | "active" | "completed" | "overdue" | undefined
  > = {
    draft: undefined,
    scheduled: "pending",
    in_transit: "active",
    out_for_delivery: "active",
    delivered: "completed",
    delayed: "overdue",
    held: "overdue",
    returned: "completed",
    cancelled: undefined,
  };
  return statusMap[status];
}
