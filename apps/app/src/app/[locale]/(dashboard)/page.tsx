"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
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
import { MetricsUnavailableNotice } from "@/components/metrics-unavailable-notice";
import { useOrganization } from "@/components/organization-provider";
import { usePermission } from "@/components/permission-gate";
import { PlanUsageStats } from "@/components/plan-usage-stats";
import { useCapabilities } from "@/hooks/use-capabilities";
import { navigationAccess } from "@/lib/capability-access";
import { formatDate } from "@/lib/format-date";
import { type FormatLocale, formatNumber } from "@/lib/format-number";
import { readyResult, unavailableReason } from "@/lib/projection-availability";
import { useCurrentLocale, useI18n, useScopedI18n } from "@/locales/client";
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
  const Icon = icon;
  return (
    <Link
      href={href}
      className="flex min-w-0 items-center gap-3 rounded-md border border-border px-3 py-2.5 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span
        className={cn(
          "shrink-0 rounded-md border p-2",
          METRIC_ICON_CLASS_NAMES[accentColor],
        )}
      >
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1 text-xs font-medium text-foreground">
        {title}
      </span>
      <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
        {value}
      </span>
      <ChevronRight
        className="size-3.5 shrink-0 text-muted-foreground"
        aria-hidden="true"
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
  const tRoot = useI18n();
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
              {tRoot("untranslatedDashboard.dashboardBilling.viewAllGroups", {
                count: groups.length,
              })}
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

type BillingTranslate = ReturnType<
  typeof useScopedI18n<"untranslatedDashboard.dashboardBilling">
>;

function getPlanDisplayName(
  t: BillingTranslate,
  tier: SubscriptionTier,
): string {
  return t(`plans.${tier}`);
}

function getBillingStatusLabel(
  t: BillingTranslate,
  organizationSubscription: OrganizationSubscription | undefined,
  locale: string,
): string {
  if (organizationSubscription === undefined) return t("loadingStatus");
  if (!organizationSubscription) return t("noActiveSubscription");
  if (!organizationSubscription.isEntitled)
    return t("subscriptionNeedsAttention");

  if (organizationSubscription.currentPeriodEnd) {
    const date = formatDate(
      new Date(organizationSubscription.currentPeriodEnd),
      locale,
    );
    return organizationSubscription.cancelAtPeriodEnd
      ? t("expiresOn", { date })
      : t("renewsOn", { date });
  }

  return t("activeSubscription");
}

function getBillingIntervalLabel(
  t: BillingTranslate,
  recurringInterval: BillingInterval | undefined,
): string {
  if (!recurringInterval) return t("included");
  return t(`billingIntervals.${recurringInterval}`);
}

function getBillingStatusBadgeLabel(
  t: BillingTranslate,
  status: BillingStatus | undefined,
): string {
  if (!status) return t("statuses.free");
  return t(`statuses.${status}`);
}

function getBillingActionLabel(
  t: BillingTranslate,
  subscriptionTier: SubscriptionTier,
): string {
  if (subscriptionTier === "free") return t("reviewPlans");
  return t("manageBilling");
}

function BillingOverviewSection({
  canManageBilling,
  locale,
  organizationId,
  organizationSubscription,
  subscriptionTier,
}: BillingOverviewSectionProps) {
  const t = useScopedI18n("untranslatedDashboard.dashboardBilling");
  const currentPlan =
    organizationSubscription?.productName ??
    getPlanDisplayName(t, subscriptionTier);
  const billingStatus = getBillingStatusLabel(
    t,
    organizationSubscription,
    locale,
  );
  const billingInterval = getBillingIntervalLabel(
    t,
    organizationSubscription?.recurringInterval,
  );
  const statusLabel = getBillingStatusBadgeLabel(
    t,
    organizationSubscription?.status,
  );
  const actionLabel = getBillingActionLabel(t, subscriptionTier);

  return (
    <section
      aria-label={t("overview")}
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
            {t("billingCycle")}:{" "}
            <span className="capitalize">{billingInterval}</span>
          </p>
          {canManageBilling ? (
            <Button asChild size="sm" variant="outline" className="mt-3">
              <Link href="/settings/billing">{actionLabel}</Link>
            </Button>
          ) : (
            <p className="mt-3 text-xs text-muted-foreground">
              {t("adminManagedBilling")}
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
  const tRoot = useI18n();
  const kpi = useScopedI18n("kpi");

  const hasAnalyticsPermission = usePermission(
    currentOrganizationId,
    "organization.view_analytics",
  );
  const showReportsLink =
    navigationAccess(useCapabilities().stateOf("reporting")) !== "hidden";
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
  const analyticsData = canViewAnalytics ? readyResult(analytics) : undefined;
  const analyticsUnavailableReason = canViewAnalytics
    ? unavailableReason(analytics)
    : undefined;
  const subscriptionTier = currentOrganization?.subscriptionTier ?? "free";

  const liveMetrics: MetricLinkCardProps[] = [
    {
      href: "/objects?inventory=owned",
      title: kpi("totalObjects"),
      value: formatMetricValue(analyticsData?.objects.total, locale),
      icon: Package,
      accentColor: "indigo",
    },
    {
      href: "/objects?inventory=owned&status=active&displayStatus=on_display",
      title: kpi("itemsOnDisplay"),
      value: formatMetricValue(analyticsData?.objects.onDisplay, locale),
      icon: Eye,
      accentColor: "emerald",
    },
    {
      href: "/loans?status=active",
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
      href: "/accessions/transfers?status=pending_source_approval",
      title: tRoot("dashboard.pendingOutgoingTransferApprovals"),
      value: formatMetricValue(analyticsData?.transfers.pending, locale),
      icon: ArrowLeftRight,
      accentColor: "blue",
    },
    {
      href: "/accessions?status=pending",
      title: tRoot("untranslatedDashboard.dashboardBilling.pendingAccessions"),
      value: formatMetricValue(analyticsData?.accessions.pending, locale),
      icon: FileClock,
      accentColor: "amber",
    },
    {
      href: "/deaccessions?status=pending",
      title: tRoot(
        "untranslatedDashboard.dashboardBilling.pendingDeaccessions",
      ),
      value: formatMetricValue(analyticsData?.deaccessions.pending, locale),
      icon: Package,
      accentColor: "indigo",
    },
    {
      href: "/loans?status=pending",
      title: tRoot("untranslatedDashboard.dashboardBilling.pendingLoans"),
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
                {t("addNewObject")}
              </Link>
            </Button>
            {canCreateCollectionGroup === true ? (
              <Button asChild size="sm" variant="outline">
                <Link href="/collections/new">
                  <Plus className="size-4" aria-hidden="true" />
                  {tRoot(
                    "untranslatedDashboard.dashboardBilling.newCollectionButton",
                  )}
                </Link>
              </Button>
            ) : null}
          </div>
        </header>

        {analyticsUnavailableReason ? (
          <MetricsUnavailableNotice reason={analyticsUnavailableReason} />
        ) : null}

        <section
          aria-label={tRoot(
            "untranslatedDashboard.dashboardBilling.liveMetrics",
          )}
          className="grid grid-cols-1 gap-2 rounded-lg border border-border bg-card p-5 @min-[20rem]:grid-cols-2 @min-[44rem]:grid-cols-4"
        >
          {liveMetrics.map((metric) => (
            <MetricLinkCard key={metric.title} {...metric} />
          ))}
        </section>

        {analyticsData && (
          <p className="text-xs text-muted-foreground">
            {tRoot("dashboard.inventoryDefinition")}{" "}
            <Link href="/objects?inventory=incoming">
              {tRoot("dashboard.inventoryIncomingExcluded", {
                count: analyticsData.objects.incomingLoanExcluded,
              })}
            </Link>
            {" · "}
            <Link href="/objects?inventory=unclassified">
              {tRoot("dashboard.inventoryUnclassified", {
                count: analyticsData.objects.ownershipUnclassified,
              })}
            </Link>
          </p>
        )}

        <PendingReviewsSection
          metrics={operationalMetrics}
          total={formatMetricValue(pendingTotal, locale)}
        />

        <CollectionGroupsOverviewSection
          organizationId={currentOrganizationId}
          canCreate={canCreateCollectionGroup === true}
        />

        {showReportsLink ? (
          <section className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-border bg-card p-5">
            <div className="flex items-center gap-3">
              <div className="shrink-0 rounded-md border border-primary/20 bg-primary/10 p-2 text-primary">
                <Eye className="size-4" aria-hidden="true" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-foreground">
                  {tRoot("analytics.title")}
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
        ) : null}

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
