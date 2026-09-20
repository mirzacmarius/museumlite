"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { KpiCard } from "@v1/ui/kpi-card";
import { cn } from "@v1/ui/utils";
import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import {
  ArrowLeftRight,
  Building2,
  CalendarClock,
  CreditCard,
  Eye,
  FileClock,
  type LucideIcon,
  MapPin,
  Package,
  PackagePlus,
  Plus,
  Warehouse,
} from "lucide-react";
import Link from "next/link";
import { useOrganization } from "@/components/organization-provider";
import { usePermission } from "@/components/permission-gate";
import { PlanUsageStats } from "@/components/plan-usage-stats";
import { formatDate } from "@/lib/format-date";
import { formatNumber } from "@/lib/format-number";
import { useCurrentLocale, useScopedI18n } from "@/locales/client";
import {
  CollectionGroupsGridSkeleton,
  DashboardPageSkeleton,
} from "./dashboard-page-skeleton";

type SubscriptionTier = "free" | "pro" | "enterprise";
type OrganizationSubscription = FunctionReturnType<
  typeof api.subscriptions.getOrganizationSubscription
>;
type BillingInterval =
  NonNullable<OrganizationSubscription>["recurringInterval"];
type BillingStatus = NonNullable<OrganizationSubscription>["status"];
type KpiAccentColor = "indigo" | "emerald" | "amber" | "blue";
const COLLECTION_GROUP_COLORS = [
  "#d97706",
  "#059669",
  "#2563eb",
  "#e11d48",
  "#7c3aed",
  "#0891b2",
] as const;
const VISIBLE_COLLECTION_GROUPS = 8;
const COLLECTION_GROUP_LIST_CLASS_NAME =
  "mt-3 flex flex-wrap items-center justify-start gap-1.5";
const COLLECTION_GROUP_CARD_CLASS_NAME = cn(
  "inline-flex w-fit max-w-full items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1",
  "transition-[border-color,background-color] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:border-border/80 hover:bg-muted/40",
);

interface BillingOverviewSectionProps {
  canManageBilling: boolean;
  locale: string;
  organizationId: Id<"organizations">;
  organizationSubscription: OrganizationSubscription | undefined;
  subscriptionTier: SubscriptionTier;
}

interface MetricLinkCardProps {
  href: string;
  title: string;
  value: string;
  icon: LucideIcon;
  accentColor: KpiAccentColor;
}

const DASHBOARD_CARD_PADDING_CLASS_NAME = "px-3.5 py-3";
const INTERACTIVE_METRIC_CARD_CLASS_NAME = cn(
  "w-full p-0 px-3.5 py-2.5",
  "transition-[border-color,background-color] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:border-border/80 hover:bg-muted/40",
);
const METRIC_LINK_CLASS_NAME =
  "inline-flex w-full transition-[background-color] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]";
const METRIC_GRID_CLASS_NAME =
  "mt-3 inline-grid grid-cols-1 gap-3 sm:auto-cols-fr sm:grid-flow-col sm:grid-cols-none";
const CREATE_REVIEW_CARD_CLASS_NAME = cn(
  "group inline-flex w-full rounded-lg border border-border bg-card",
  DASHBOARD_CARD_PADDING_CLASS_NAME,
  "transition-[border-color,background-color] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:border-border/80 hover:bg-muted/40",
);

function MetricLinkCard({
  href,
  title,
  value,
  icon,
  accentColor,
}: MetricLinkCardProps) {
  return (
    <Link href={href} className={METRIC_LINK_CLASS_NAME}>
      <KpiCard
        title={title}
        value={value}
        icon={icon}
        accentColor={accentColor}
        className={INTERACTIVE_METRIC_CARD_CLASS_NAME}
      />
    </Link>
  );
}

interface MetricLinkSectionProps {
  title: string;
  metrics: MetricLinkCardProps[];
  className?: string;
}

function MetricLinkSection({
  title,
  metrics,
  className,
}: MetricLinkSectionProps) {
  return (
    <section className={className}>
      <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground">
        {title}
      </h3>
      <div className={METRIC_GRID_CLASS_NAME}>
        {metrics.map((metric) => (
          <MetricLinkCard key={metric.title} {...metric} />
        ))}
      </div>
    </section>
  );
}

function CollectionGroupsOverviewSection({
  organizationId,
  canCreate,
}: {
  organizationId: Id<"organizations">;
  canCreate: boolean;
}) {
  const t = useScopedI18n("collections");
  const kpi = useScopedI18n("kpi");
  const groups = useQuery(api.collectionGroups.list, { organizationId });

  const viewAllLabel =
    groups && groups.length > 0 ? `View all (${groups.length})` : "View all";

  return (
    <section className="mt-6">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground">
          {kpi("totalCollectionGroups")}
        </h3>
        <div className="flex items-center gap-2">
          {canCreate ? (
            <Button asChild variant="outline" size="sm" className="h-7 text-xs">
              <Link href="/collections/new">
                <Plus className="mr-1.5 size-3.5" />
                {t("newCollection")}
              </Link>
            </Button>
          ) : null}
          <Button asChild variant="ghost" size="sm" className="h-7 text-xs">
            <Link href="/collections">{viewAllLabel}</Link>
          </Button>
        </div>
      </div>

      {groups === undefined ? (
        <CollectionGroupsGridSkeleton />
      ) : groups.length === 0 ? (
        <div className="mt-3 flex flex-col items-start gap-3 rounded-lg border border-border bg-card px-3.5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">{t("noCollections")}</p>
          {canCreate ? (
            <Button asChild size="sm">
              <Link href="/collections/new">
                <Plus className="mr-1.5 size-3.5" />
                {t("createFirst")}
              </Link>
            </Button>
          ) : null}
        </div>
      ) : (
        <div className={COLLECTION_GROUP_LIST_CLASS_NAME}>
          {groups.slice(0, VISIBLE_COLLECTION_GROUPS).map((group, index) => (
            <Link
              key={group._id}
              href={`/objects?collectionGroupId=${group._id}`}
              className={COLLECTION_GROUP_CARD_CLASS_NAME}
            >
              <span
                className="size-1.5 shrink-0 rounded-full"
                style={{
                  backgroundColor:
                    COLLECTION_GROUP_COLORS[
                      index % COLLECTION_GROUP_COLORS.length
                    ] ?? "#d97706",
                }}
              />
              <span className="truncate text-xs font-medium text-foreground">
                {group.name}
              </span>
              {group.itemsCount !== undefined ? (
                <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
                  {group.itemsCount}
                </span>
              ) : null}
            </Link>
          ))}
          {groups.length > VISIBLE_COLLECTION_GROUPS ? (
            <Link
              href="/collections"
              className={cn(
                COLLECTION_GROUP_CARD_CLASS_NAME,
                "border-dashed text-xs font-medium text-muted-foreground hover:text-foreground",
              )}
            >
              View all {groups.length} groups
            </Link>
          ) : null}
        </div>
      )}
    </section>
  );
}

function formatMetricValue(count: number | undefined, locale: string): string {
  return count === undefined ? "—" : formatNumber(count, locale);
}

function getPlanDisplayName(tier: SubscriptionTier): string {
  return `${tier.charAt(0).toUpperCase()}${tier.slice(1)} plan`;
}

function getBillingStatusLabel(
  organizationSubscription: OrganizationSubscription | undefined,
  locale: string,
): string {
  if (organizationSubscription === undefined) return "Loading billing status";
  if (!organizationSubscription) return "No active paid subscription";
  if (!organizationSubscription.isEntitled)
    return "Subscription needs attention";

  if (organizationSubscription.currentPeriodEnd) {
    const date = formatDate(
      new Date(organizationSubscription.currentPeriodEnd),
      locale,
    );
    return organizationSubscription.cancelAtPeriodEnd
      ? `Expires on ${date}`
      : `Renews on ${date}`;
  }

  return "Active subscription";
}

function getBillingIntervalLabel(
  recurringInterval: BillingInterval | undefined,
): string {
  if (!recurringInterval) return "Included";
  return `${recurringInterval}ly`;
}

function getBillingStatusBadgeLabel(status: BillingStatus | undefined): string {
  if (!status) return "Free";
  if (status === "past_due") return "Past due";
  return status.replace("_", " ");
}

function getBillingActionLabel(subscriptionTier: SubscriptionTier): string {
  if (subscriptionTier === "free") return "Review plans";
  return "Manage billing";
}

function BillingOverviewSection({
  canManageBilling,
  locale,
  organizationId,
  organizationSubscription,
  subscriptionTier,
}: BillingOverviewSectionProps) {
  const currentPlan =
    organizationSubscription?.productName ??
    getPlanDisplayName(subscriptionTier);
  const billingStatus = getBillingStatusLabel(organizationSubscription, locale);
  const billingInterval = getBillingIntervalLabel(
    organizationSubscription?.recurringInterval,
  );
  const statusLabel = getBillingStatusBadgeLabel(
    organizationSubscription?.status,
  );
  const actionLabel = getBillingActionLabel(subscriptionTier);

  return (
    <section className="mt-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground">
            Billing overview
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Keep an eye on plan status and usage from the overview page.
          </p>
        </div>
        {canManageBilling ? (
          <Button asChild size="sm" variant="outline">
            <Link href="/settings/billing">{actionLabel}</Link>
          </Button>
        ) : null}
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,0.9fr)_minmax(22rem,1.1fr)]">
        <div className="rounded-lg border border-border bg-card p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="rounded-md border border-primary/20 bg-primary/10 p-2 text-primary">
                <CreditCard className="size-4" />
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Current plan
                </p>
                <p className="mt-1 text-base font-semibold text-foreground">
                  {currentPlan}
                </p>
              </div>
            </div>
            <span className="rounded-md bg-primary/10 px-2 py-1 text-xs font-medium capitalize text-primary">
              {statusLabel}
            </span>
          </div>

          <div className="mt-5 space-y-3 text-sm">
            <div className="flex items-center justify-between gap-4 rounded-md border border-border/60 bg-muted/30 px-3 py-2">
              <span className="text-muted-foreground">Billing cycle</span>
              <span className="font-medium capitalize text-foreground">
                {billingInterval}
              </span>
            </div>
            <div className="flex items-start justify-between gap-4 rounded-md border border-border/60 bg-muted/30 px-3 py-2">
              <span className="flex items-center gap-2 text-muted-foreground">
                <CalendarClock className="size-4" />
                Status
              </span>
              <span className="text-right font-medium text-foreground">
                {billingStatus}
              </span>
            </div>
          </div>

          {!canManageBilling ? (
            <p className="mt-4 text-xs text-muted-foreground">
              Billing changes are managed by organization administrators.
            </p>
          ) : null}
        </div>

        <PlanUsageStats
          organizationId={organizationId}
          showUpgradeLink={canManageBilling}
        />
      </div>
    </section>
  );
}

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
  const canManageBilling = usePermission(
    currentOrganizationId,
    "organization.manage_settings",
  );
  const canCreateCollectionGroup = usePermission(
    currentOrganizationId,
    "collections.create",
  );

  const analytics = useQuery(
    api.dashboard.getAnalytics,
    currentOrganizationId && hasAnalyticsPermission
      ? { organizationId: currentOrganizationId }
      : "skip",
  );
  const organizationSubscription = useQuery(
    api.subscriptions.getOrganizationSubscription,
    currentOrganizationId ? { organizationId: currentOrganizationId } : "skip",
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

  const canViewAnalytics = hasAnalyticsPermission === true;
  const analyticsData = canViewAnalytics ? analytics : undefined;
  const subscriptionTier = currentOrganization?.subscriptionTier ?? "free";

  const liveMetrics: MetricLinkCardProps[] = [
    {
      href: "/objects",
      title: kpi("totalObjects"),
      value: formatMetricValue(analyticsData?.objects.total, locale),
      icon: Package,
      accentColor: "indigo",
    },
    {
      href: "/objects?status=active&displayStatus=on_display",
      title: kpi("itemsOnDisplay"),
      value: formatMetricValue(analyticsData?.objects.onDisplay, locale),
      icon: Eye,
      accentColor: "emerald",
    },
    {
      href: "/loans",
      title: kpi("activeLoans"),
      value: formatMetricValue(analyticsData?.loans.active, locale),
      icon: ArrowLeftRight,
      accentColor: "blue",
    },
    {
      href: "/locations",
      title: kpi("totalLocations"),
      value: formatMetricValue(analyticsData?.locations.total, locale),
      icon: MapPin,
      accentColor: "amber",
    },
  ];

  const operationalMetrics: MetricLinkCardProps[] = [
    {
      href: "/accessions/transfers",
      title: "Pending transfer approvals",
      value: formatMetricValue(analyticsData?.transfers.pending, locale),
      icon: ArrowLeftRight,
      accentColor: "blue",
    },
    {
      href: "/accessions",
      title: "Pending accessions",
      value: formatMetricValue(analyticsData?.accessions.pending, locale),
      icon: FileClock,
      accentColor: "amber",
    },
    {
      href: "/deaccessions",
      title: "Pending deaccessions",
      value: formatMetricValue(analyticsData?.deaccessions.pending, locale),
      icon: Package,
      accentColor: "indigo",
    },
    {
      href: "/loans",
      title: "Pending loans",
      value: formatMetricValue(analyticsData?.loans.pending, locale),
      icon: ArrowLeftRight,
      accentColor: "blue",
    },
  ];

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

      <MetricLinkSection
        className="mt-8"
        title="Live metrics"
        metrics={liveMetrics}
      />

      <CollectionGroupsOverviewSection
        organizationId={currentOrganizationId}
        canCreate={canCreateCollectionGroup === true}
      />

      <section className="mt-6">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground">
          Create and review
        </h3>

        <div className="mt-3 inline-grid grid-cols-1 gap-3 sm:grid-cols-3">
          {commandQuickActions.map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className={CREATE_REVIEW_CARD_CLASS_NAME}
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

      <MetricLinkSection
        className="mt-6"
        title="Operational flow"
        metrics={operationalMetrics}
      />

      <BillingOverviewSection
        canManageBilling={canManageBilling}
        locale={locale}
        organizationId={currentOrganizationId}
        organizationSubscription={organizationSubscription}
        subscriptionTier={subscriptionTier}
      />
    </div>
  );
}
