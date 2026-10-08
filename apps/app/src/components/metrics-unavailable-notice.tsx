"use client";

import { cn } from "@v1/ui/utils";
import { AlertTriangle } from "lucide-react";
import Link from "next/link";
import { usePermissions } from "@/components/permission-gate";
import type { ProjectionUnavailableReason } from "@/lib/projection-availability";
import { useScopedI18n } from "@/locales/client";

export const METRICS_HEALTH_PATH = "/settings/metrics";
const EMPTY_VALUE = "\u2014";

type Translate = ReturnType<typeof useScopedI18n<"projectionHealth">>;

export function unavailableReasonLabel(
  reason: ProjectionUnavailableReason,
  t: Translate,
): string {
  switch (reason) {
    case "not_built":
      return t("reasons.not_built");
    case "building":
      return t("reasons.building");
    case "invalidated":
      return t("reasons.invalidated");
    case "definition_changed":
      return t("reasons.definition_changed");
    case "rebuild_failed":
      return t("reasons.rebuild_failed");
  }
}

function RecoveryGuidance({ t }: { t: Translate }) {
  const { hasPermission, isLoading } = usePermissions();
  if (isLoading) return null;
  return hasPermission("organization.manage_settings") ? (
    <Link
      href={METRICS_HEALTH_PATH}
      className="font-medium text-foreground underline underline-offset-4"
    >
      {t("unavailable.openHealth")}
    </Link>
  ) : (
    <span>{t("unavailable.askAdministrator")}</span>
  );
}

export function MetricsUnavailableNotice({
  reason,
  className,
}: {
  reason: ProjectionUnavailableReason;
  className?: string;
}) {
  const t = useScopedI18n("projectionHealth");
  return (
    <div
      role="status"
      className={cn(
        "flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 text-sm",
        className,
      )}
    >
      <AlertTriangle
        className="mt-0.5 size-4 shrink-0 text-amber-400"
        aria-hidden="true"
      />
      <div className="space-y-1">
        <p className="font-medium text-foreground">{t("unavailable.title")}</p>
        <p className="text-muted-foreground">
          {unavailableReasonLabel(reason, t)}
        </p>
        <p className="text-muted-foreground">
          <RecoveryGuidance t={t} />
        </p>
      </div>
    </div>
  );
}

export function MetricsUnavailableInline({
  label,
  className,
}: {
  label: string;
  className?: string;
}) {
  const t = useScopedI18n("projectionHealth");
  return (
    <span role="status" className={cn("text-xs text-zinc-500", className)}>
      {label} · <RecoveryGuidance t={t} />
    </span>
  );
}

export function UnavailableKpiCard({ title }: { title: string }) {
  const t = useScopedI18n("projectionHealth");
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
      <div>
        <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          {title}
        </div>
        <div className="text-lg font-semibold text-foreground">
          {EMPTY_VALUE}
        </div>
        <div className="text-xs text-muted-foreground">
          {t("unavailable.short")} · <RecoveryGuidance t={t} />
        </div>
      </div>
    </div>
  );
}
