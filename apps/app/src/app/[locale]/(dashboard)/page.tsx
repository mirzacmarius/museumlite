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
  ArrowRight,
  Building2,
  ChevronRight,
  CreditCard,
  Eye,
  FileClock,
  type LucideIcon,
  MapPin,
  Package,
  PackagePlus,
  Plus,
} from "lucide-react";
import Link from "next/link";
import { useOrganization } from "@/components/organization-provider";
import { usePermission } from "@/components/permission-gate";
import { PlanUsageStats } from "@/components/plan-usage-stats";
import { formatDate } from "@/lib/format-date";
import { type FormatLocale, formatNumber } from "@/lib/format-number";
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

const INTERACTIVE_METRIC_CARD_CLASS_NAME = cn(
  "h-full w-full rounded-none border-0 px-5 py-4",
  "transition-[border-color,background-color] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:border-border/80 hover:bg-muted/40",
);
const METRIC_LINK_CLASS_NAME =
  "min-w-0 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring";
const METRIC_ICON_CLASS_NAMES = {
  indigo: "border-primary/20 bg-primary/10 text-primary",
  emerald: "border-emerald-500/20 bg-emerald-500/10 text-emerald-400",
  amber: "border-amber-500/20 bg-amber-500/10 text-amber-400",
  blue: "border-blue-500/20 bg-blue-500/10 text-blue-400",
} satisfies Record<KpiAccentColor, string>;

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

interface PendingReviewsSectionProps {
  metrics: MetricLinkCardProps[];
  total: string;
}

function PendingReviewsSection({ metrics, total }: PendingReviewsSectionProps) {
  const t = useScopedI18n("dashboard");
  return (
    <section className="min-w-0 rounded-lg border border-border bg-card p-5">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-semibold text-foreground">
          {t("needsReview")}
        </h2>
        <span className="rounded-md border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-xs font-medium tabular-nums text-amber-400">
          {total}
        </span>
      </div>
      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 @min-[44rem]:grid-cols-4">
        {metrics.map((metric) => (
          <Link
            key={metric.title}
            href={metric.href}
            className="flex min-w-0 items-center gap-3 rounded-md border border-border px-3 py-2.5 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span
              className={cn(
                "shrink-0 rounded-md border p-2",
                METRIC_ICON_CLASS_NAMES[metric.accentColor],
              )}
            >
              <metric.icon className="size-4" aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1 text-xs font-medium text-foreground">
              {metric.title}
            </span>
            <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
              {metric.value}
            </span>
            <ChevronRight
              className="size-3.5 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
          </Link>
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

  return (
    <section className="min-w-0 rounded-lg border border-border bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-foreground">
            {kpi("totalCollectionGroups")}
          </h2>
          {groups !== undefined ? (
            <span className="rounded-md border border-border px-2 py-0.5 text-xs tabular-nums text-muted-foreground">
              {groups.length}
            </span>
          ) : null}
        </div>
        {canCreate ? (
          <Button asChild variant="outline" size="sm" className="h-7 text-xs">
            <Link href="/collections/new">
              <Plus className="mr-1.5 size-3.5" />
              {t("newCollection")}
            </Link>
          </Button>
        ) : null}
      </div>

      {groups === undefined ? (
        <CollectionGroupsGridSkeleton />
      ) : groups.length === 0 ? (
        <div className="mt-4 flex flex-col items-start gap-3">
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

function formatMetricValue(
  count: number | undefined,
  locale: FormatLocale,
): string {
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
    <section
      aria-label="Billing overview"
      className="grid gap-6 rounded-lg border border-border bg-card p-5 @min-[56rem]:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] @min-[56rem]:items-center"
    >
      <div className="flex min-w-0 items-start gap-3">
        <div className="shrink-0 rounded-md border border-primary/20 bg-primary/10 p-2 text-primary">
          <CreditCard className="size-4" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold text-foreground">
              {currentPlan}
            </h2>
            <span className="rounded-md bg-primary/10 px-2 py-1 text-xs font-medium capitalize text-primary">
              {statusLabel}
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{billingStatus}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Billing cycle: <span className="capitalize">{billingInterval}</span>
          </p>
          {canManageBilling ? (
            <Button asChild size="sm" variant="outline" className="mt-3">
              <Link href="/settings/billing">{actionLabel}</Link>
            </Button>
          ) : (
            <p className="mt-3 text-xs text-muted-foreground">
              Billing changes are managed by organization administrators.
            </p>
          )}
        </div>
      </div>
      <PlanUsageStats
        organizationId={organizationId}
        layout="inline"
        showUpgradeLink={false}
        className="border-t border-border pt-5 @min-[56rem]:border-s @min-[56rem]:border-t-0 @min-[56rem]:ps-6 @min-[56rem]:pt-0"
      />
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

  const pendingTotal = analyticsData
    ? analyticsData.transfers.pending +
      analyticsData.accessions.pending +
      analyticsData.deaccessions.pending +
      analyticsData.loans.pending
    : undefined;

  return (
    <div className="@container h-full min-h-0 w-full overflow-y-auto bg-background p-4 sm:p-6 custom-scrollbar">
      <div className="flex min-w-0 flex-col gap-5">
        <header className="flex flex-wrap items-center justify-between gap-4 pb-1">
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground">
              {currentOrganization?.name ?? "Museum"}
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
              {t("overviewTitle")}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {t("overviewDescription")}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild size="sm">
              <Link href="/objects/new">
                <PackagePlus className="size-4" aria-hidden="true" />
                Add Object
              </Link>
            </Button>
            {canCreateCollectionGroup === true ? (
              <Button asChild size="sm" variant="outline">
                <Link href="/collections/new">
                  <Plus className="size-4" aria-hidden="true" />
                  New Collection
                </Link>
              </Button>
            ) : null}
          </div>
        </header>

        <section
          aria-label="Live metrics"
          className="grid grid-cols-1 gap-px overflow-hidden rounded-lg border border-border bg-border @min-[20rem]:grid-cols-2 @min-[44rem]:grid-cols-4"
        >
          {liveMetrics.map((metric) => (
            <MetricLinkCard key={metric.title} {...metric} />
          ))}
        </section>

        <PendingReviewsSection
          metrics={operationalMetrics}
          total={formatMetricValue(pendingTotal, locale)}
        />

        <CollectionGroupsOverviewSection
          organizationId={currentOrganizationId}
          canCreate={canCreateCollectionGroup === true}
        />

        <section className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-border bg-card p-5">
          <div className="flex items-center gap-3">
            <div className="shrink-0 rounded-md border border-primary/20 bg-primary/10 p-2 text-primary">
              <Eye className="size-4" aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-foreground">
                Analytics
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                {t("analyticsDescription")}
              </p>
            </div>
          </div>
          <Button asChild size="sm" variant="outline">
            <Link href="/analytics">
              {t("viewReports")}
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </Button>
        </section>

        <BillingOverviewSection
          canManageBilling={canManageBilling}
          locale={locale}
          organizationId={currentOrganizationId}
          organizationSubscription={organizationSubscription}
          subscriptionTier={subscriptionTier}
        />
      </div>
    </div>
  );
}
