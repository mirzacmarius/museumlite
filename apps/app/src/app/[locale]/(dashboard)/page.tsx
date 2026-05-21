"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { KpiCard } from "@v1/ui/kpi-card";
import { useQuery } from "convex/react";
import {
  ArrowLeftRight,
  Building2,
  Eye,
  FileClock,
  Package,
  PackagePlus,
  Warehouse,
} from "lucide-react";
import Link from "next/link";
import { useOrganization } from "@/components/organization-provider";
import { usePermission } from "@/components/permission-gate";
import { formatNumber } from "@/lib/format-number";
import { useCurrentLocale, useScopedI18n } from "@/locales/client";
import { DashboardPageSkeleton } from "./dashboard-page-skeleton";

export default function DashboardPage() {
  const {
    currentOrganizationId,
    currentOrganization,
    organizations,
    isLoading,
  } = useOrganization();
  const locale = useCurrentLocale();
  const t = useScopedI18n("dashboard");
  const kpi = useScopedI18n("kpi");

  const hasAnalyticsPermission = usePermission(
    currentOrganizationId,
    "organization.view_analytics",
  );

  const analytics = useQuery(
    api.dashboard.getAnalytics,
    currentOrganizationId && hasAnalyticsPermission
      ? { organizationId: currentOrganizationId as Id<"organizations"> }
      : "skip",
  );

  if (isLoading) {
    return <DashboardPageSkeleton />;
  }

  if (!organizations || organizations.length === 0) {
    return (
      <div className="flex size-full items-center justify-center bg-background px-4">
        <div className="flex flex-col items-center gap-4 rounded-lg border border-border bg-card p-8">
          <Building2 className="size-12 text-muted-foreground" />
          <div className="text-center">
            <h3 className="text-lg font-semibold text-foreground">
              {t("noOrganizationTitle")}
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {t("noOrganizationDescription")}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!currentOrganizationId) {
    return (
      <div className="flex size-full items-center justify-center bg-background px-6">
        <div className="flex flex-col items-center gap-4 rounded-lg border border-border bg-card p-8">
          <Building2 className="size-12 text-muted-foreground" />
          <div className="text-center">
            <h3 className="text-lg font-semibold text-foreground">
              {t("selectOrganizationTitle")}
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {t("selectOrganizationDescription")}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const commandQuickActions = [
    {
      href: "/objects/new",
      title: "Add Object",
      icon: PackagePlus,
    },
    {
      href: "/collections/new",
      title: "New Collection",
      icon: Warehouse,
    },
    {
      href: "/analytics",
      title: "Analytics",
      icon: Eye,
    },
  ];

  const canViewAnalytics = hasAnalyticsPermission === true;
  const analyticsData = canViewAnalytics ? analytics : undefined;
  const metricCardClassName = "w-full px-3.5 py-3";
  const interactiveMetricCardClassName =
    "w-full px-3.5 py-3 transition-[border-color,background-color] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:border-border/80 hover:bg-muted/40";
  const metricLinkClassName =
    "inline-flex w-full transition-[background-color] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]";

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-y-auto bg-background p-4 sm:p-6 custom-scrollbar">
      <div>
        <h2 className="text-lg font-semibold text-foreground">
          {currentOrganization?.name ?? "Museum"}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Navigate key museum pages from here.
        </p>
      </div>

      <section className="mt-8">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground">
          Live metrics
        </h3>

        <div className="mt-3 inline-grid grid-cols-1 gap-3 sm:auto-cols-fr sm:grid-flow-col sm:grid-cols-none">
          <KpiCard
            title={kpi("totalObjects")}
            value={
              analyticsData
                ? formatNumber(analyticsData.objects.total, locale)
                : "—"
            }
            icon={Package}
            accentColor="indigo"
            className={metricCardClassName}
          />
          <KpiCard
            title="Items on Display"
            value={
              analyticsData
                ? formatNumber(analyticsData.objects.onDisplay, locale)
                : "—"
            }
            icon={Eye}
            accentColor="emerald"
            className={metricCardClassName}
          />
          <Link href="/loans" className="w-full">
            <KpiCard
              title={kpi("activeLoans")}
              value={
                analyticsData
                  ? formatNumber(analyticsData.loans.active, locale)
                  : "—"
              }
              icon={ArrowLeftRight}
              accentColor="blue"
              className={interactiveMetricCardClassName}
            />
          </Link>
        </div>
      </section>

      <section className="mt-6">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground">
          Create and review
        </h3>

        <div className="mt-3 inline-grid grid-cols-1 gap-3 sm:grid-cols-3">
          {commandQuickActions.map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className="group inline-flex w-full rounded-lg border border-border bg-card px-3.5 py-3 transition-[border-color,background-color] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:border-border/80 hover:bg-muted/40"
            >
              <div className="flex items-center gap-3">
                <div className="rounded-md border border-primary/20 bg-primary/10 p-2 text-primary transition-colors group-hover:border-primary/30 group-hover:bg-primary/15">
                  <action.icon className="size-4" />
                </div>
                <p className="text-sm font-semibold tracking-tight text-foreground">
                  {action.title}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="mt-6">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground">
          Operational flow
        </h3>

        <div className="mt-3 inline-grid grid-cols-1 gap-3 sm:auto-cols-fr sm:grid-flow-col sm:grid-cols-none">
          <Link href="/accessions/transfers" className={metricLinkClassName}>
            <KpiCard
              title="Pending transfer approvals"
              value={
                analyticsData
                  ? formatNumber(analyticsData.transfers.pending, locale)
                  : "—"
              }
              icon={ArrowLeftRight}
              accentColor="blue"
              className={interactiveMetricCardClassName}
            />
          </Link>
          <Link href="/accessions" className={metricLinkClassName}>
            <KpiCard
              title="Pending accessions"
              value={
                analyticsData
                  ? formatNumber(analyticsData.accessions.pending, locale)
                  : "—"
              }
              icon={FileClock}
              accentColor="amber"
              className={interactiveMetricCardClassName}
            />
          </Link>
          <Link href="/deaccessions" className={metricLinkClassName}>
            <KpiCard
              title="Pending deaccessions"
              value={
                analyticsData
                  ? formatNumber(analyticsData.deaccessions.pending, locale)
                  : "—"
              }
              icon={Package}
              accentColor="indigo"
              className={interactiveMetricCardClassName}
            />
          </Link>
          <Link href="/loans" className={metricLinkClassName}>
            <KpiCard
              title="Pending loans"
              value={
                analyticsData
                  ? formatNumber(analyticsData.loans.pending, locale)
                  : "—"
              }
              icon={ArrowLeftRight}
              accentColor="blue"
              className={interactiveMetricCardClassName}
            />
          </Link>
        </div>
      </section>
    </div>
  );
}
