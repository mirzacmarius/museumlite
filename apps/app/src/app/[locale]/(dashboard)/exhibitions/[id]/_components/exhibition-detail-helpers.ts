import {
  CheckCircle2,
  CircleDot,
  type LucideIcon,
  XCircle,
} from "lucide-react";
import type {
  ExhibitionDetail,
  ExhibitionDurationInfo,
  ExhibitionTimeStatus,
  ExhibitionWorkflowStatusInfo,
} from "./exhibition-detail-types";

export function getTimeStatus(
  exhibition: ExhibitionDetail,
  now: number | undefined,
  t: (key: string) => string,
): ExhibitionTimeStatus {
  const isPast =
    now !== undefined && exhibition.endDate && exhibition.endDate < now;
  const isUpcoming = now !== undefined && exhibition.startDate > now;

  if (isPast) {
    return {
      color: "bg-muted text-muted-foreground border-border",
      text: t("status.past"),
    };
  }

  if (isUpcoming) {
    return {
      color: "bg-blue-500/10 text-blue-400 border-blue-500/20",
      text: t("status.upcoming"),
    };
  }

  return {
    color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    text: t("status.current"),
  };
}

export function getWorkflowStatusInfo(
  exhibition: ExhibitionDetail,
  t: (key: string) => string,
): ExhibitionWorkflowStatusInfo {
  const status = exhibition.status ?? "active";

  switch (status) {
    case "proposed":
      return {
        color: "bg-amber-500/10 text-amber-400 border-amber-500/20",
        icon: CircleDot,
        text: t("status.pendingApproval"),
      };
    case "approved":
      return {
        color: "bg-blue-500/10 text-blue-400 border-blue-500/20",
        icon: CheckCircle2,
        text: t("status.approved"),
      };
    case "active":
      return {
        color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
        icon: CheckCircle2,
        text: t("status.active"),
      };
    case "closed":
      return {
        color: "bg-muted text-muted-foreground border-border",
        icon: CheckCircle2,
        text: t("status.closed"),
      };
    case "rejected":
      return {
        color: "bg-red-500/10 text-red-400 border-red-500/20",
        icon: XCircle,
        text: t("status.rejected"),
      };
    default:
      return {
        color: "bg-muted text-muted-foreground border-border",
        icon: CircleDot,
        text: status,
      };
  }
}

export function calculateDuration(
  exhibition: ExhibitionDetail,
  now: number | undefined,
  t: (key: string) => string,
): ExhibitionDurationInfo {
  const start = exhibition.startDate;
  const end = exhibition.endDate;
  const isPast =
    now !== undefined && exhibition.endDate && exhibition.endDate < now;
  const isUpcoming = now !== undefined && exhibition.startDate > now;

  if (isUpcoming && now !== undefined) {
    const daysUntilStart = Math.ceil((start - now) / (1000 * 60 * 60 * 24));
    return {
      label: t("detail.startsIn"),
      value: `${daysUntilStart} ${t("detail.days")}`,
    };
  }

  if (isPast && end && now !== undefined) {
    const totalDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
    return {
      label: t("detail.duration"),
      value: `${totalDays} ${t("detail.days")}`,
    };
  }

  if (now === undefined) {
    return {
      label: t("detail.activeFor"),
      value: "",
    };
  }

  const daysActive = Math.ceil((now - start) / (1000 * 60 * 60 * 24));
  return {
    label: t("detail.activeFor"),
    value: `${daysActive} ${t("detail.days")}`,
  };
}

export type { LucideIcon };
