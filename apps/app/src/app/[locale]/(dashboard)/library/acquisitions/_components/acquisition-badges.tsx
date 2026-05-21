"use client";

import { useScopedI18n } from "@/locales/client";
import { Badge } from "@v1/ui/badge";

export function useAcquisitionStatusLabel() {
  const tAcq = useScopedI18n("library.acquisitions");

  return (status: string): string => {
    const statusMap: Record<string, string> = {
      submitted: tAcq("status.submitted"),
      under_review: tAcq("status.underReview"),
      approved: tAcq("status.approved"),
      ordered: tAcq("status.ordered"),
      received: tAcq("status.received"),
      cataloged: tAcq("status.cataloged"),
      rejected: tAcq("status.rejected"),
    };
    return statusMap[status] || status;
  };
}

export function useAcquisitionPriorityLabel() {
  const tAcq = useScopedI18n("library.acquisitions");

  return (priority: string): string => {
    const priorityMap: Record<string, string> = {
      urgent: tAcq("priority.urgent"),
      high: tAcq("priority.high"),
      normal: tAcq("priority.normal"),
      low: tAcq("priority.low"),
    };
    return priorityMap[priority] || priority;
  };
}

interface AcquisitionStatusBadgeProps {
  status: string;
}

export function AcquisitionStatusBadge({
  status,
}: AcquisitionStatusBadgeProps) {
  const getStatusLabel = useAcquisitionStatusLabel();
  const label = getStatusLabel(status);

  switch (status) {
    case "submitted":
      return <Badge variant="secondary">{label}</Badge>;
    case "under_review":
      return (
        <Badge variant="default" className="bg-blue-500">
          {label}
        </Badge>
      );
    case "approved":
      return (
        <Badge variant="default" className="bg-green-500">
          {label}
        </Badge>
      );
    case "ordered":
      return (
        <Badge variant="default" className="bg-purple-500">
          {label}
        </Badge>
      );
    case "received":
      return (
        <Badge variant="default" className="bg-teal-500">
          {label}
        </Badge>
      );
    case "cataloged":
      return (
        <Badge variant="default" className="bg-green-600">
          {label}
        </Badge>
      );
    case "rejected":
      return <Badge variant="destructive">{label}</Badge>;
    case "cancelled":
      return <Badge variant="outline">{label}</Badge>;
    default:
      return <Badge variant="secondary">{label}</Badge>;
  }
}

interface AcquisitionPriorityBadgeProps {
  priority: string;
}

export function AcquisitionPriorityBadge({
  priority,
}: AcquisitionPriorityBadgeProps) {
  const getPriorityLabel = useAcquisitionPriorityLabel();
  const label = getPriorityLabel(priority);

  switch (priority) {
    case "urgent":
      return <Badge variant="destructive">{label}</Badge>;
    case "high":
      return (
        <Badge variant="default" className="bg-orange-500">
          {label}
        </Badge>
      );
    case "normal":
      return <Badge variant="secondary">{label}</Badge>;
    case "low":
      return <Badge variant="outline">{label}</Badge>;
    default:
      return <Badge variant="secondary">{label}</Badge>;
  }
}
