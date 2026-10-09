"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Badge } from "@v1/ui/badge";
import { useQuery } from "convex/react";
import Link from "next/link";
import type { ReactNode } from "react";
import { ClientDate } from "@/components/client-date";
import { CurrencyTotals } from "@/components/currency-totals";
import { CALENDAR_DATE_OPTIONS } from "@/lib/format-date";
import { useScopedI18n } from "@/locales/client";

const severityColor = {
  critical: "border-rose-500/30 text-rose-400",
  warning: "border-amber-500/30 text-amber-400",
  info: "border-blue-500/30 text-blue-400",
} as const;

function Panel({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3 rounded-xl border border-border/60 bg-card/40 p-4">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {description ? (
          <p className="text-xs text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function Count({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border/60 p-3">
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-lg font-semibold tabular-nums text-foreground">
        {value}
      </p>
    </div>
  );
}

export function InsuranceOverviewTab({
  organizationId,
  now,
  locale,
}: {
  organizationId: Id<"organizations">;
  now: number | undefined;
  locale: string;
}) {
  const t = useScopedI18n("untranslatedDashboard.insurance.overview");
  const alerts = useQuery(
    api.insurance.getCoverageAlerts,
    now === undefined ? "skip" : { organizationId, now },
  );

  if (alerts === undefined) {
    return <div className="h-48 w-full animate-pulse rounded-xl bg-card/40" />;
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-4">
        <Count label={t("needsReview")} value={alerts.coveragesNeedingReview} />
        <Count
          label={t("staleAppraisals")}
          value={alerts.staleAppraisalCount}
        />
        <Count label={t("openClaims")} value={alerts.pendingClaimsCount} />
        <Count label={t("disputedClaims")} value={alerts.disputedClaimsCount} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title={t("inForceTitle")} description={t("inForceDescription")}>
          <CurrencyTotals
            totals={alerts.inForceValue}
            emptyLabel={t("noCover")}
          />
        </Panel>

        <Panel title={t("gapsTitle")} description={t("gapsDescription")}>
          <p className="text-sm text-foreground">
            {t("coveredOf", {
              covered: alerts.uncoveredStats.coveredObjects,
              total: alerts.uncoveredStats.totalObjects,
              percentage: alerts.uncoveredStats.coveragePercentage,
            })}
          </p>
          {alerts.uncoveredSample.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noGaps")}</p>
          ) : (
            <ul className="divide-y divide-border/60 text-sm">
              {alerts.uncoveredSample.map((object) => (
                <li key={object._id} className="py-2">
                  <Link
                    href={`/objects/${object._id}`}
                    className="flex justify-between gap-3 hover:text-foreground"
                  >
                    <span className="truncate">{object.title}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {object.accessionNumber}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {alerts.uncoveredStats.uncoveredObjects >
          alerts.uncoveredSample.length ? (
            <p className="text-xs text-muted-foreground">
              {t("moreGaps", { count: alerts.uncoveredSample.length })}
            </p>
          ) : null}
        </Panel>

        <Panel title={t("expiringTitle")}>
          {alerts.expiringPolicies.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noExpiring")}</p>
          ) : (
            <ul className="space-y-3">
              {alerts.expiringPolicies.map((policy) => (
                <li
                  key={policy._id}
                  className="space-y-2 rounded-lg border border-border/60 p-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium text-foreground">
                      {policy.policyNumber} · {policy.carrier}
                    </span>
                    <Badge
                      variant="outline"
                      className={severityColor[policy.severity]}
                    >
                      {t("expiresIn", { days: policy.daysUntilExpiry })}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t("coverageCount", { count: policy.coverageCount })}
                  </p>
                  <CurrencyTotals
                    totals={policy.coveredValue}
                    emptyLabel={t("noCover")}
                  />
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title={t("expiredTitle")}>
          {alerts.expiredPolicies.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noExpired")}</p>
          ) : (
            <ul className="divide-y divide-border/60 text-sm">
              {alerts.expiredPolicies.map((policy) => (
                <li
                  key={policy._id}
                  className="flex flex-wrap items-center justify-between gap-2 py-2"
                >
                  <span className="text-foreground">
                    {policy.policyNumber} · {policy.carrier}
                  </span>
                  <span className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Badge
                      variant="outline"
                      className="border-rose-500/30 text-rose-400"
                    >
                      {t("expiredBadge")}
                    </Badge>
                    <ClientDate
                      timestamp={policy.expirationDate}
                      locale={locale}
                      options={CALENDAR_DATE_OPTIONS}
                    />
                    · {t("coverageCount", { count: policy.coverageCount })}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {alerts.expiredPoliciesCount > alerts.expiredPolicies.length ? (
            <p className="text-xs text-muted-foreground">
              {t("moreExpired", { count: alerts.expiredPoliciesCount })}
            </p>
          ) : null}
        </Panel>
      </div>
    </div>
  );
}
