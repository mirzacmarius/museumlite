"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { cn } from "@v1/ui/utils";
import { useQuery } from "convex/react";
import Link from "next/link";
import type { ReactNode } from "react";
import { MetricsUnavailableInline } from "@/components/metrics-unavailable-notice";
import { useI18n, useScopedI18n } from "@/locales/client";

const USAGE_METRIC_KEYS = ["storage", "objects", "exports"] as const;

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  const gb = mb / 1024;
  if (gb < 1024) return `${gb.toFixed(1)} GB`;
  const tb = gb / 1024;
  return `${tb.toFixed(1)} TB`;
}

function formatNumber(num: number): string {
  if (num >= 1000) return `${(num / 1000).toFixed(0)}k`;
  return num.toString();
}

function calculatePercentage(
  used: number | null,
  limit: number | null,
): number {
  if (limit === null || used === null) return 0;
  return Math.min((used / limit) * 100, 100);
}

function getTierDisplayName(tier: "free" | "pro" | "enterprise"): string {
  return `${tier.charAt(0).toUpperCase()}${tier.slice(1)} Plan`;
}

export function PlanUsageStats({
  organizationId,
  className,
  showUpgradeLink = true,
}: {
  organizationId: Id<"organizations"> | undefined;
  className?: string;
  showUpgradeLink?: boolean;
}) {
  const translate = useI18n();
  const stats = useQuery(
    api.organizations.getUsageStats,
    organizationId ? { organizationId } : "skip",
  );
  const containerClassName = cn(
    "rounded-lg border border-zinc-800/60 bg-zinc-950 p-5",
    className,
  );

  if (!stats) {
    return (
      <div className={containerClassName}>
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <div className="size-1.5 animate-pulse rounded-full bg-zinc-800" />
            <div className="h-4 w-20 animate-pulse rounded bg-zinc-800" />
          </div>
        </div>
        <div className="space-y-3">
          {USAGE_METRIC_KEYS.map((metric) => (
            <div key={metric}>
              <div className="mb-1 flex items-end justify-between gap-2">
                <div className="h-3 w-16 animate-pulse rounded bg-zinc-800" />
                <div className="h-3 w-20 animate-pulse rounded bg-zinc-800" />
              </div>
              <div className="h-1.5 w-full rounded-full bg-zinc-900" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const isEnterprise = stats.tier === "enterprise";
  const metricsUnavailable = stats.metrics.availability === "unavailable";
  const unavailableLabel = translate("projectionHealth.unavailable.short");

  return (
    <div className={containerClassName}>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <div className="size-1.5 rounded-full bg-primary" />
          <span className="text-sm font-semibold text-zinc-200">
            {getTierDisplayName(stats.tier)}
          </span>
        </div>
        {showUpgradeLink && !isEnterprise ? (
          <Link
            href="/settings/billing"
            className="text-xs font-medium uppercase tracking-wide text-zinc-500 transition-colors hover:text-primary"
          >
            {translate("untranslatedComponents.labels.upgrade")}
          </Link>
        ) : null}
      </div>

      <div className="space-y-3">
        <UsageRow
          label={translate("untranslatedComponents.labels.storage")}
          value={
            stats.storage.limit === null ? (
              <span className="text-xs font-mono text-zinc-400">
                {translate("untranslatedComponents.labels.unlimited")}
              </span>
            ) : (
              <span className="text-xs font-mono text-zinc-400">
                {stats.storage.used === null
                  ? unavailableLabel
                  : formatBytes(stats.storage.used)}{" "}
                <span className="text-zinc-600">
                  / {formatBytes(stats.storage.limit)}
                </span>
              </span>
            )
          }
          progressClassName="bg-primary"
          percentage={calculatePercentage(
            stats.storage.used,
            stats.storage.limit,
          )}
          showProgress={
            stats.storage.limit !== null && stats.storage.used !== null
          }
        />
        <UsageRow
          label={translate("untranslatedComponents.labels.objectRecords")}
          value={
            stats.objects.limit === null ? (
              <span className="text-xs font-mono text-zinc-400">
                {translate("untranslatedComponents.labels.unlimited")}
              </span>
            ) : (
              <span className="text-xs font-mono text-zinc-400">
                {stats.objects.used === null
                  ? unavailableLabel
                  : formatNumber(stats.objects.used)}{" "}
                <span className="text-zinc-600">
                  / {formatNumber(stats.objects.limit)}
                </span>
              </span>
            )
          }
          progressClassName="bg-amber-500/80"
          percentage={calculatePercentage(
            stats.objects.used,
            stats.objects.limit,
          )}
          showProgress={
            stats.objects.limit !== null && stats.objects.used !== null
          }
        />
        <UsageRow
          label={translate("untranslatedComponents.labels.monthlyExports")}
          value={
            stats.exports.limit === null ? (
              <span className="text-xs font-mono text-zinc-400">
                {translate("untranslatedComponents.labels.unlimited")}
              </span>
            ) : (
              <span className="text-xs font-mono text-zinc-400">
                {formatNumber(stats.exports.used)}{" "}
                <span className="text-zinc-600">
                  / {formatNumber(stats.exports.limit)}
                </span>
              </span>
            )
          }
          progressClassName="bg-emerald-500/80"
          percentage={calculatePercentage(
            stats.exports.used,
            stats.exports.limit,
          )}
          showProgress={stats.exports.limit !== null}
        />
      </div>
      {metricsUnavailable ? (
        <MetricsUnavailableInline
          className="mt-3 block"
          label={translate("projectionHealth.unavailable.usage")}
        />
      ) : null}
    </div>
  );
}

function UsageRow({
  label,
  value,
  percentage,
  showProgress,
  progressClassName,
}: {
  label: string;
  value: ReactNode;
  percentage: number;
  showProgress: boolean;
  progressClassName: string;
}) {
  return (
    <div>
      <div className="mb-1 flex items-end justify-between gap-2">
        <span className="text-xs font-medium text-zinc-500">{label}</span>
        {value}
      </div>
      {showProgress ? (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-900">
          <div
            className={cn(
              "h-1.5 rounded-full transition-all duration-300",
              progressClassName,
            )}
            style={{ width: `${percentage}%` }}
          />
        </div>
      ) : null}
    </div>
  );
}

interface SidebarUsageMetric {
  key: (typeof USAGE_METRIC_KEYS)[number];
  label: string;
  value: string;
  percentage: number | null;
  barClassName: string;
}

function usageMetric(
  key: SidebarUsageMetric["key"],
  label: string,
  used: number | null,
  limit: number | null,
  format: (value: number) => string,
  labels: { unlimited: string; unavailable: string },
  barClassName: string,
): SidebarUsageMetric {
  if (limit === null) {
    return {
      key,
      label,
      value: labels.unlimited,
      percentage: null,
      barClassName,
    };
  }
  if (used === null) {
    return {
      key,
      label,
      value: labels.unavailable,
      percentage: null,
      barClassName,
    };
  }
  return {
    key,
    label,
    value: `${format(used)} / ${format(limit)}`,
    percentage: calculatePercentage(used, limit),
    barClassName,
  };
}

/** Plan usage condensed for the sidebar footer, with a link to billing. */
export function SidebarPlanUsage({
  organizationId,
  onNavigate,
  className,
}: {
  organizationId: Id<"organizations">;
  onNavigate?: () => void;
  className?: string;
}) {
  const translate = useI18n();
  const t = useScopedI18n("untranslatedDashboard.dashboardBilling");
  const stats = useQuery(api.organizations.getUsageStats, { organizationId });

  if (!stats) {
    // Placeholders reuse the loaded text sizes so the sidebar footer keeps its height when usage arrives.
    return (
      <div
        className={cn("space-y-1.5 px-2 py-1", className)}
        aria-hidden="true"
      >
        <div className="flex items-baseline justify-between gap-2">
          <span className="inline-block w-16 animate-pulse rounded bg-sidebar-accent text-xs font-medium text-transparent">
            &nbsp;
          </span>
          <span className="inline-block w-10 animate-pulse rounded bg-sidebar-accent text-[11px] font-medium text-transparent">
            &nbsp;
          </span>
        </div>
        {USAGE_METRIC_KEYS.map((metric) => (
          <div key={metric} className="space-y-1 text-[11px]">
            <div className="flex items-baseline justify-between gap-2">
              <span className="inline-block w-14 animate-pulse rounded bg-sidebar-accent text-transparent">
                &nbsp;
              </span>
              <span className="inline-block w-12 animate-pulse rounded bg-sidebar-accent text-transparent">
                &nbsp;
              </span>
            </div>
            <div className="h-0.5 rounded-full bg-sidebar-accent" />
          </div>
        ))}
      </div>
    );
  }

  const labels = {
    unlimited: translate("untranslatedComponents.labels.unlimited"),
    unavailable: translate("projectionHealth.unavailable.short"),
  };
  const metrics = [
    usageMetric(
      "storage",
      translate("untranslatedComponents.labels.storage"),
      stats.storage.used,
      stats.storage.limit,
      formatBytes,
      labels,
      "bg-primary",
    ),
    usageMetric(
      "objects",
      translate("untranslatedComponents.labels.objectRecords"),
      stats.objects.used,
      stats.objects.limit,
      formatNumber,
      labels,
      "bg-amber-500/80",
    ),
    usageMetric(
      "exports",
      translate("untranslatedComponents.labels.monthlyExports"),
      stats.exports.used,
      stats.exports.limit,
      formatNumber,
      labels,
      "bg-emerald-500/80",
    ),
  ];

  return (
    <div className={cn("space-y-1.5 px-2 py-1", className)}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="truncate text-xs font-medium text-sidebar-foreground/80">
          {t(`plans.${stats.tier}`)}
        </span>
        <Link
          href="/settings/billing"
          onClick={onNavigate}
          className="shrink-0 text-[11px] font-medium text-primary underline-offset-2 hover:underline dark:text-violet-300"
        >
          {translate("settings.sidebar.billing")}
        </Link>
      </div>
      {metrics.map((metric) => (
        <div key={metric.key} className="space-y-1 text-[11px]">
          <div className="flex items-baseline justify-between gap-2">
            <span className="truncate text-sidebar-foreground/60">
              {metric.label}
            </span>
            <span className="shrink-0 tabular-nums text-sidebar-foreground/70">
              {metric.value}
            </span>
          </div>
          <div className="h-0.5 overflow-hidden rounded-full bg-sidebar-accent">
            {metric.percentage === null ? null : (
              <div
                className={cn("h-0.5 rounded-full", metric.barClassName)}
                style={{ width: `${metric.percentage}%` }}
              />
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
