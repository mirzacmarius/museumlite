"use client";

import { useScopedI18n } from "@/locales/client";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { Loader2, Plus, ShoppingCart } from "lucide-react";
import { AcquisitionRequestRow } from "./acquisition-request-row";

interface AcquisitionRequest {
  _id: Id<"libraryAcquisitionRequests">;
  title: string;
  status: string;
  priority: string;
  authors?: string[];
  requestedAt: number;
  quantity: number;
  estimatedPrice?: number;
  requestedByUser?: { name?: string } | null;
}

interface AcquisitionsRequestsListProps {
  requests:
    | {
        page: AcquisitionRequest[];
      }
    | undefined;
  statusFilter: string;
  priorityFilter: string;
  isProcessing: boolean;
  onNewRequest: () => void;
  onApprove: (requestId: Id<"libraryAcquisitionRequests">) => void;
  onReject: (requestId: Id<"libraryAcquisitionRequests">) => void;
  onStatusChange: (
    requestId: Id<"libraryAcquisitionRequests">,
    newStatus: "ordered" | "received" | "cataloged" | "cancelled",
  ) => void;
}

export function AcquisitionsRequestsList({
  requests,
  statusFilter,
  priorityFilter,
  isProcessing,
  onNewRequest,
  onApprove,
  onReject,
  onStatusChange,
}: AcquisitionsRequestsListProps) {
  const tAcq = useScopedI18n("library.acquisitions");
  const hasFilters = statusFilter !== "all" || priorityFilter !== "all";

  if (requests === undefined) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (requests.page.length === 0) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-4 p-6">
        <ShoppingCart className="size-12 text-muted-foreground" />
        <div className="text-center">
          <p className="font-medium">
            {hasFilters ? tAcq("noRequestsFiltered") : tAcq("noRequests")}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            {hasFilters
              ? tAcq("tryAdjustFilters")
              : tAcq("noRequestsDescription")}
          </p>
        </div>
        {!hasFilters && (
          <Button onClick={onNewRequest}>
            <Plus className="mr-2 size-4" />
            {tAcq("createFirst")}
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="space-y-4">
        {requests.page.map((request) => (
          <AcquisitionRequestRow
            key={request._id}
            request={request}
            isProcessing={isProcessing}
            onApprove={onApprove}
            onReject={onReject}
            onStatusChange={onStatusChange}
          />
        ))}
      </div>
    </div>
  );
}
