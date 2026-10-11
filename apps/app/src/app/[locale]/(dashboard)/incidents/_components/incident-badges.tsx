"use client";

import type {
  IncidentSeverity,
  IncidentStatus,
} from "@v1/backend/convex/utils/incidentValidators";
import { Badge } from "@v1/ui/badge";
import { cn } from "@v1/ui/utils";
import { Lock } from "lucide-react";
import { useScopedI18n } from "@/locales/client";

const STATUS_STYLES: Record<IncidentStatus, string> = {
  reported:
    "border-amber-300 bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
  responding:
    "border-sky-300 bg-sky-50 text-sky-800 dark:bg-sky-950 dark:text-sky-200",
  closed: "border-border bg-muted text-muted-foreground",
};

const SEVERITY_STYLES: Record<IncidentSeverity, string> = {
  minor: "border-border text-muted-foreground",
  moderate: "border-amber-300 text-amber-800 dark:text-amber-200",
  major: "border-orange-400 text-orange-800 dark:text-orange-200",
  critical:
    "border-red-500 bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-200",
};

export function IncidentStatusBadge({ status }: { status: IncidentStatus }) {
  const t = useScopedI18n("incidents.statuses");
  return (
    <Badge variant="outline" className={cn(STATUS_STYLES[status])}>
      {t(status)}
    </Badge>
  );
}

export function IncidentSeverityBadge({
  severity,
}: {
  severity: IncidentSeverity | undefined;
}) {
  const t = useScopedI18n("incidents");
  if (!severity)
    return (
      <Badge variant="outline" className="text-muted-foreground">
        {t("notTriaged")}
      </Badge>
    );
  return (
    <Badge variant="outline" className={cn(SEVERITY_STYLES[severity])}>
      {t(`severities.${severity}`)}
    </Badge>
  );
}

export function SensitiveBadge() {
  const t = useScopedI18n("incidents");
  return (
    <Badge variant="outline" className="gap-1" title={t("sensitiveHint")}>
      <Lock className="size-3" aria-hidden="true" />
      {t("sensitive")}
    </Badge>
  );
}
