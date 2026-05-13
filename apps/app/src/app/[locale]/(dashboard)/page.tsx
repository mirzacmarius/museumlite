"use client";

import { useOrganization } from "@/components/organization-provider";
import { usePermission } from "@/components/permission-gate";
import { formatNumber } from "@/lib/format-number";
import { useCurrentLocale, useScopedI18n } from "@/locales/client";
import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { KpiCard } from "@v1/ui/kpi-card";
import { useQuery } from "convex/react";
import {
  ArrowLeftRight,
  Building2,
  Eye,
  FileClock,
  FolderKanban,
  MapPin,
  Package,
  PackagePlus,
  Warehouse,
} from "lucide-react";
import Link from "next/link";
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
      <div className="flex h-full w-full items-center justify-center bg-background px-4">
        <div className="flex flex-col items-center gap-4 rounded-lg border border-border bg-card p-8">
          <Building2 className="h-12 w-12 text-muted-foreground" />
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
      <div className="flex h-full w-full items-center justify-center bg-background px-6">
        <div className="flex flex-col items-center gap-4 rounded-lg border border-border bg-card p-8">
          <Building2 className="h-12 w-12 text-muted-foreground" />
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

  if (hasAnalyticsPermission === undefined) {
    return (
      <div className="flex h-full w-full flex-col bg-background">
        <div className="px-6 py-4 border-b border-border bg-background/50 backdrop-blur-sm">
          <div className="flex flex-wrap items-start justify-start gap-4 [&>*]:shrink-0">
            <KpiCard title="" value="" loading />
            <KpiCard title="" value="" loading />
            <KpiCard title="" value="" loading />
            <KpiCard title="" value="" loading />
          </div>
        </div>
      </div>
    );
  }

  if (!hasAnalyticsPermission) {
    return (
      <div className="flex h-full min-h-0 w-full flex-col overflow-y-auto bg-background p-4 sm:p-6 custom-scrollbar">
        <div className="rounded-xl border border-white/10 bg-card p-5 sm:p-6">
          <h2 className="text-lg font-semibold text-foreground">
            {currentOrganization?.name ?? "Museum"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            You do not have access to analytics, but you can still navigate key
            museum pages from here.
          </p>
        </div>

        <section className="mt-6">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("quickAction")}
          </h3>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                href: "/objects",
                title: "Objects",
                description: "Browse and search object records.",
                icon: Package,
              },
              {
                href: "/collections",
                title: "Collections",
                description: "Open collection groups and departments.",
                icon: FolderKanban,
              },
              {
                href: "/accessions",
                title: "Accessions",
                description: "Review incoming acquisitions.",
                icon: FileClock,
              },
              {
                href: "/loans",
                title: "Loans",
                description: "Track incoming and outgoing loans.",
                icon: ArrowLeftRight,
              },
              {
                href: "/locations",
                title: "Locations",
                description: "Manage storage and display locations.",
                icon: MapPin,
              },
              {
                href: "/objects/new",
                title: "Add Object",
                description: "Create a new object record.",
                icon: PackagePlus,
              },
            ].map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-xl border border-white/10 bg-card p-4 transition-colors hover:border-white/20 hover:bg-muted/30"
              >
                <link.icon className="h-4 w-4 text-muted-foreground" />
                <p className="mt-3 text-sm font-medium text-foreground">
                  {link.title}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {link.description}
                </p>
              </Link>
            ))}
          </div>
        </section>
      </div>
    );
  }

  if (analytics === undefined) {
    return (
      <div className="flex h-full w-full flex-col bg-background">
        <div className="px-6 py-4 border-b border-border bg-background/50 backdrop-blur-sm">
          <div className="flex flex-wrap items-start justify-start gap-4 [&>*]:shrink-0">
            <KpiCard title="" value="" loading />
            <KpiCard title="" value="" loading />
            <KpiCard title="" value="" loading />
            <KpiCard title="" value="" loading />
          </div>
        </div>
      </div>
    );
  }

  const commandQuickActions = [
    {
      href: "/objects/new",
      title: "Add Object",
      description: "Create a new object record.",
      label: "Create",
      icon: PackagePlus,
    },
    {
      href: "/collections/new",
      title: "New Collection",
      description: "Create a new collection item.",
      label: "Create",
      icon: Warehouse,
    },
    {
      href: "/analytics",
      title: "Analytics",
      description: "Open detailed reports and trends.",
      label: "Review",
      icon: Eye,
    },
  ];

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-y-auto bg-background p-4 sm:p-6 custom-scrollbar">
      <section>
        <div className="flex flex-wrap items-start justify-start gap-3 sm:gap-4 [&>*]:shrink-0">
          <KpiCard
            title={kpi("totalObjects")}
            value={formatNumber(analytics.objects.total, locale)}
            icon={Package}
            accentColor="indigo"
          />
          <KpiCard
            title="Items on Display"
            value={formatNumber(analytics.objects.onDisplay, locale)}
            icon={Eye}
            accentColor="emerald"
          />
          <Link href="/accessions">
            <KpiCard
              title="Pending Accessions"
              value={formatNumber(analytics.accessions.pending, locale)}
              icon={FileClock}
              accentColor="amber"
              className="transition-[transform,border-color,background-color] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-[2px] hover:border-border/80 hover:bg-muted/40 active:translate-y-px"
            />
          </Link>
          <Link href="/loans">
            <KpiCard
              title={kpi("activeLoans")}
              value={formatNumber(analytics.loans.active, locale)}
              icon={ArrowLeftRight}
              accentColor="blue"
              className="transition-[transform,border-color,background-color] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-[2px] hover:border-border/80 hover:bg-muted/40 active:translate-y-px"
            />
          </Link>
        </div>
      </section>

      <div className="mt-4 flex flex-wrap items-start justify-start gap-3 [&>*]:shrink-0">
        {commandQuickActions.map((action) => (
          <Link
            key={action.href}
            href={action.href}
            className="group inline-flex min-w-[13rem] rounded-[1.05rem] border border-white/10 bg-transparent px-3.5 py-3 transition-[transform,border-color,background-color] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-[2px] hover:border-white/20 hover:bg-white/[0.03] active:translate-y-px"
          >
            <div className="flex items-center gap-3">
              <div className="rounded-lg border border-white/10 bg-white/[0.03] p-2 text-white/60 transition-colors group-hover:text-white">
                <action.icon className="h-4 w-4" />
              </div>
              <p className="text-sm font-semibold tracking-tight text-foreground">
                {action.title}
              </p>
            </div>
          </Link>
        ))}
      </div>

      <section className="mt-6">
        <div className="flex min-h-[14.5rem] flex-col rounded-[1.5rem] border border-white/10 bg-[linear-gradient(160deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="rounded-xl border border-amber-400/20 bg-amber-400/10 p-2.5 text-amber-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                <FileClock className="h-4.5 w-4.5" />
              </div>
              <h3 className="text-xl font-semibold tracking-tight text-foreground">
                Workflow queues
              </h3>
            </div>
            <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-white/45">
              Operational flow
            </span>
          </div>

          <p className="mt-6 text-sm leading-relaxed text-white/55">
            Review pending approvals and active circulation from the same
            overview panel.
          </p>

          <div className="mt-auto grid gap-2 pt-5 sm:grid-cols-2 xl:grid-cols-5">
            <Link
              href="/accessions/transfers"
              className="flex min-w-0 flex-col rounded-xl border border-border bg-card px-3.5 py-2.5 transition-colors hover:border-border/80 hover:bg-muted/40"
            >
              <span className="min-w-0 truncate text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                Pending transfer approvals
              </span>
              <span className="mt-1.5 text-base font-semibold text-foreground">
                {formatNumber(analytics.transfers.pending, locale)}
              </span>
            </Link>
            <div className="flex min-w-0 flex-col rounded-xl border border-border bg-card px-3.5 py-2.5">
              <span className="min-w-0 truncate text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                Pending accessions
              </span>
              <span className="mt-1.5 text-base font-semibold text-foreground">
                {formatNumber(analytics.accessions.pending, locale)}
              </span>
            </div>
            <div className="flex min-w-0 flex-col rounded-xl border border-border bg-card px-3.5 py-2.5">
              <span className="min-w-0 truncate text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                Pending deaccessions
              </span>
              <span className="mt-1.5 text-base font-semibold text-foreground">
                {formatNumber(analytics.deaccessions.pending, locale)}
              </span>
            </div>
            <div className="flex min-w-0 flex-col rounded-xl border border-border bg-card px-3.5 py-2.5">
              <span className="min-w-0 truncate text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                Pending loans
              </span>
              <span className="mt-1.5 text-base font-semibold text-foreground">
                {formatNumber(analytics.loans.pending, locale)}
              </span>
            </div>
            <div className="flex min-w-0 flex-col rounded-xl border border-border bg-card px-3.5 py-2.5">
              <span className="min-w-0 truncate text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                Active loans
              </span>
              <span className="mt-1.5 text-base font-semibold text-foreground">
                {formatNumber(analytics.loans.active, locale)}
              </span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
