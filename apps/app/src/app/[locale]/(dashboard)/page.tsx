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
  const common = useScopedI18n("common");

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
    return (
      <div className="flex h-full w-full items-center justify-center bg-background">
        <p className="text-muted-foreground">{common("loading")}</p>
      </div>
    );
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
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
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
      <div className="flex h-full w-full flex-col bg-background p-4 sm:p-6">
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
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <KpiCard title="" value="" loading />
            <KpiCard title="" value="" loading />
            <KpiCard title="" value="" loading />
            <KpiCard title="" value="" loading />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col bg-background p-4 sm:p-6">
      <section className="mt-6">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 xl:grid-cols-4 sm:gap-4">
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
          <KpiCard
            title={kpi("pendingAccessions")}
            value={formatNumber(analytics.accessions.pending, locale)}
            icon={FileClock}
            accentColor="amber"
          />
          <KpiCard
            title={kpi("activeLoans")}
            value={formatNumber(analytics.loans.active, locale)}
            icon={ArrowLeftRight}
            accentColor="blue"
          />
        </div>
      </section>

      <section className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-white/10 bg-card p-5">
          <h3 className="text-sm font-semibold text-foreground">
            Objects overview
          </h3>
          <div className="mt-4 space-y-3 text-sm">
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <span className="text-muted-foreground">Active records</span>
              <span className="font-medium text-foreground">
                {formatNumber(analytics.objects.active, locale)}
              </span>
            </div>
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <span className="text-muted-foreground">On display</span>
              <span className="font-medium text-foreground">
                {formatNumber(analytics.objects.onDisplay, locale)}
              </span>
            </div>
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <span className="text-muted-foreground">On loan</span>
              <span className="font-medium text-foreground">
                {formatNumber(analytics.objects.loaned, locale)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Deaccessioned</span>
              <span className="font-medium text-foreground">
                {formatNumber(analytics.objects.deaccessioned, locale)}
              </span>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-card p-5">
          <h3 className="text-sm font-semibold text-foreground">
            Workflow queues
          </h3>
          <div className="mt-4 space-y-3 text-sm">
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <span className="text-muted-foreground">Pending accessions</span>
              <span className="font-medium text-foreground">
                {formatNumber(analytics.accessions.pending, locale)}
              </span>
            </div>
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <span className="text-muted-foreground">
                Pending deaccessions
              </span>
              <span className="font-medium text-foreground">
                {formatNumber(analytics.deaccessions.pending, locale)}
              </span>
            </div>
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <span className="text-muted-foreground">Pending loans</span>
              <span className="font-medium text-foreground">
                {formatNumber(analytics.loans.pending, locale)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Active loans</span>
              <span className="font-medium text-foreground">
                {formatNumber(analytics.loans.active, locale)}
              </span>
            </div>
          </div>
        </div>
      </section>

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
            {
              href: "/collections/new",
              title: "New Collection",
              description: "Create a new collection item.",
              icon: Warehouse,
            },
            {
              href: "/accessions/new",
              title: "New Accession",
              description: "Start a new accession workflow.",
              icon: FileClock,
            },
            {
              href: "/analytics",
              title: "Analytics",
              description: "Open detailed reports and trends.",
              icon: Eye,
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
