"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { cn } from "@v1/ui/utils";
import { useQuery } from "convex/react";
import Link from "next/link";
import type { ReactNode } from "react";

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

function calculatePercentage(used: number, limit: number | null): number {
  if (limit === null) return 0;
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
  const stats = useQuery(
    api.organizations.getUsageStats,
    organizationId ? { organizationId } : "skip",
  );

  if (!stats) {
    return (
      <div
        className={cn(
          "rounded-lg border border-zinc-800/60 bg-zinc-950 p-5",
          className,
        )}
      >
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-zinc-800" />
            <div className="h-4 w-20 animate-pulse rounded bg-zinc-800" />
          </div>
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i}>
              <div className="mb-1 flex items-end justify-between">
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

  return (
    <div
      className={cn(
        "rounded-lg border border-zinc-800/60 bg-zinc-950 p-5",
        className,
      )}
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <div className="h-1.5 w-1.5 rounded-full bg-gradient-to-r from-indigo-500 to-violet-500" />
          <span className="text-sm font-semibold text-zinc-200">
            {getTierDisplayName(stats.tier)}
          </span>
        </div>
        {showUpgradeLink && !isEnterprise ? (
          <Link
            href="/settings/billing"
            className="text-xs font-medium uppercase tracking-wide text-zinc-500 transition-colors hover:text-indigo-400"
          >
            Upgrade
          </Link>
        ) : null}
      </div>

      <div className="space-y-3">
        <UsageRow
          label="Storage"
          value={
            stats.storage.limit === null ? (
              <span className="text-xs font-mono text-zinc-400">Unlimited</span>
            ) : (
              <span className="text-xs font-mono text-zinc-400">
                {formatBytes(stats.storage.used)}{" "}
                <span className="text-zinc-600">
                  / {formatBytes(stats.storage.limit)}
                </span>
              </span>
            )
          }
          progressClassName="bg-indigo-500"
          percentage={calculatePercentage(
            stats.storage.used,
            stats.storage.limit,
          )}
          showProgress={stats.storage.limit !== null}
        />
        <UsageRow
          label="Object Records"
          value={
            stats.objects.limit === null ? (
              <span className="text-xs font-mono text-zinc-400">Unlimited</span>
            ) : (
              <span className="text-xs font-mono text-zinc-400">
                {formatNumber(stats.objects.used)}{" "}
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
          showProgress={stats.objects.limit !== null}
        />
        <UsageRow
          label="Monthly Exports"
          value={
            stats.exports.limit === null ? (
              <span className="text-xs font-mono text-zinc-400">Unlimited</span>
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
      <div className="mb-1 flex items-end justify-between">
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
