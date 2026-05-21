"use client";

import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { Check, CheckCircle, Package, Truck, X } from "lucide-react";
import { formatDate as formatDateUtil } from "@/lib/format-date";
import { formatCurrency } from "@/lib/format-number";
import { useCurrentLocale, useScopedI18n } from "@/locales/client";
import {
  AcquisitionPriorityBadge,
  AcquisitionStatusBadge,
} from "./acquisition-badges";

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

interface AcquisitionRequestRowProps {
  request: AcquisitionRequest;
  isProcessing: boolean;
  onApprove: (requestId: Id<"libraryAcquisitionRequests">) => void;
  onReject: (requestId: Id<"libraryAcquisitionRequests">) => void;
  onStatusChange: (
    requestId: Id<"libraryAcquisitionRequests">,
    newStatus: "ordered" | "received" | "cataloged" | "cancelled",
  ) => void;
}

export function AcquisitionRequestRow({
  request,
  isProcessing,
  onApprove,
  onReject,
  onStatusChange,
}: AcquisitionRequestRowProps) {
  const locale = useCurrentLocale();
  const tAcq = useScopedI18n("library.acquisitions");

  const formatDate = (timestamp: number) =>
    formatDateUtil(new Date(timestamp), locale);

  return (
    <div className="flex items-center justify-between rounded-lg border border-border p-4">
      <div className="flex items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <p className="font-medium">{request.title}</p>
            <AcquisitionStatusBadge status={request.status} />
            <AcquisitionPriorityBadge priority={request.priority} />
          </div>
          {request.authors && request.authors.length > 0 && (
            <p className="text-sm text-muted-foreground">
              by {request.authors.join(", ")}
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            {tAcq("labels.requestedBy")}{" "}
            {request.requestedByUser?.name || tAcq("labels.unknownUser")}{" "}
            {tAcq("labels.on")} {formatDate(request.requestedAt)}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <div className="text-right">
          <p className="text-sm">
            {tAcq("labels.qty")} {request.quantity}
          </p>
          {request.estimatedPrice && (
            <p className="text-xs text-muted-foreground">
              {tAcq("labels.est")}{" "}
              {formatCurrency(request.estimatedPrice, locale, "USD")}
            </p>
          )}
        </div>
        {request.status === "submitted" && (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onReject(request._id)}
              disabled={isProcessing}
            >
              <X className="mr-1 size-3" />
              {tAcq("actions.reject")}
            </Button>
            <Button
              size="sm"
              onClick={() => onApprove(request._id)}
              disabled={isProcessing}
            >
              <Check className="mr-1 size-3" />
              {tAcq("actions.review")}
            </Button>
          </>
        )}
        {request.status === "under_review" && (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onReject(request._id)}
              disabled={isProcessing}
            >
              <X className="mr-1 size-3" />
              {tAcq("actions.reject")}
            </Button>
            <Button
              size="sm"
              onClick={() => onApprove(request._id)}
              disabled={isProcessing}
            >
              <Check className="mr-1 size-3" />
              {tAcq("actions.approve")}
            </Button>
          </>
        )}
        {request.status === "approved" && (
          <Button
            size="sm"
            onClick={() => onStatusChange(request._id, "ordered")}
            disabled={isProcessing}
          >
            <Truck className="mr-1 size-3" />
            {tAcq("actions.markOrdered")}
          </Button>
        )}
        {request.status === "ordered" && (
          <Button
            size="sm"
            onClick={() => onStatusChange(request._id, "received")}
            disabled={isProcessing}
          >
            <Package className="mr-1 size-3" />
            {tAcq("actions.markReceived")}
          </Button>
        )}
        {request.status === "received" && (
          <Button
            size="sm"
            onClick={() => onStatusChange(request._id, "cataloged")}
            disabled={isProcessing}
          >
            <CheckCircle className="mr-1 size-3" />
            {tAcq("actions.cataloged")}
          </Button>
        )}
      </div>
    </div>
  );
}
