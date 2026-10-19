"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { useStaggeredEntry } from "@v1/ui/hooks";
import { cn } from "@v1/ui/utils";
import { useQuery } from "convex/react";
import {
  ArrowLeftRight,
  ArrowRight,
  Building2,
  Eye,
  EyeOff,
  FolderOpen,
  MapPin,
  Package,
  PackagePlus,
  Plus,
} from "lucide-react";
import Link from "next/link";
import { MetricsUnavailableNotice } from "@/components/metrics-unavailable-notice";
import { useOrganization } from "@/components/organization-provider";
import { usePermission } from "@/components/permission-gate";
import { type FormatLocale, formatNumber } from "@/lib/format-number";
import { readyResult, unavailableReason } from "@/lib/projection-availability";
import { useCurrentLocale, useI18n, useScopedI18n } from "@/locales/client";
import { CatalogedByYouSection } from "./_components/my-assignments-sections";
import { MyWorkSummary } from "./_components/my-work-cards";
import { WorkSection } from "./_components/my-work-sections";
import {
  OVERVIEW_CARD_GRID_STYLE,
  OverviewCard,
  type OverviewCardProps,
} from "./_components/overview-card";
import {
  CollectionGroupsGridSkeleton,
  DashboardPageSkeleton,
} from "./dashboard-page-skeleton";

const COLLECTION_GROUP_COLORS = [
  "#d97706",
  "#059669",
  "#2563eb",
  "#e11d48",
  "#7c3aed",
  "#0891b2",
] as const;
const VISIBLE_COLLECTION_GROUPS = 8;
const COLLECTION_GROUP_CARD_CLASS_NAME = cn(
  "inline-flex w-fit max-w-full items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1",
  "transition-[border-color,background-color] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:border-border/80 hover:bg-muted/40",
);

function CollectionGroupsSection({
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
    <WorkSection
      icon={<FolderOpen className="size-4 text-amber-400" />}
      title={kpi("totalCollectionGroups")}
      badge={
        groups !== undefined ? (
          <span className="text-xs tabular-nums text-muted-foreground">
            {groups.length}
          </span>
        ) : null
      }
    >
      {groups === undefined ? (
        <CollectionGroupsGridSkeleton />
      ) : groups.length === 0 ? (
        <div className="flex flex-col items-start gap-3">
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
        <div className="flex flex-wrap items-center gap-1.5">
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
              <ArrowRight className="size-3" aria-hidden="true" />
            </Link>
          ) : null}
        </div>
      )}
    </WorkSection>
  );
}

function formatMetricValue(
  count: number | undefined,
  locale: FormatLocale,
): string {
  return count === undefined ? "—" : formatNumber(count, locale);
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
  const entry = useStaggeredEntry();

  const hasAnalyticsPermission = usePermission(
    currentOrganizationId,
    "organization.view_analytics",
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

  const metrics: OverviewCardProps[] = [
    {
      href: "/objects?inventory=owned",
      title: kpi("totalObjects"),
      value: formatMetricValue(analyticsData?.objects.total, locale),
      icon: Package,
      accentClassName: "text-primary",
    },
    {
      href: "/objects?inventory=owned&status=active&displayStatus=on_display",
      title: kpi("itemsOnDisplay"),
      value: formatMetricValue(analyticsData?.objects.onDisplay, locale),
      icon: Eye,
      accentClassName: "text-emerald-400",
    },
    {
      href: "/objects?inventory=owned&displayStatus=not_on_display",
      title: kpi("itemsNotOnDisplay"),
      value: formatMetricValue(analyticsData?.objects.notOnDisplay, locale),
      icon: EyeOff,
      accentClassName: "text-muted-foreground",
    },
    {
      href: "/loans?status=active",
      title: kpi("activeLoans"),
      value: formatMetricValue(analyticsData?.loans.active, locale),
      icon: ArrowLeftRight,
      accentClassName: "text-blue-400",
    },
    {
      href: "/locations",
      title: kpi("totalLocations"),
      value: formatMetricValue(analyticsData?.locations.total, locale),
      icon: MapPin,
      accentClassName: "text-amber-400",
    },
    {
      href: "/accessions/transfers?status=pending_source_approval",
      title: tRoot("dashboard.pendingOutgoingTransferApprovals"),
      value: formatMetricValue(analyticsData?.transfers.pending, locale),
      icon: ArrowLeftRight,
      accentClassName: "text-blue-400",
    },
  ];

  return (
    <div className="@container h-full min-h-0 w-full overflow-y-auto bg-background p-4 sm:p-6 custom-scrollbar">
      <div className="flex min-w-0 flex-col gap-5">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">
              {currentOrganization?.name ?? "Museum"}
            </p>
            <h1 className="text-xl font-semibold tracking-tight text-foreground">
              {t("overviewTitle")}
            </h1>
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

        {canViewAnalytics ? (
          <section
            aria-label={tRoot(
              "untranslatedDashboard.dashboardBilling.liveMetrics",
            )}
            className="flex flex-col gap-2"
          >
            <div className="grid" style={OVERVIEW_CARD_GRID_STYLE}>
              {metrics.map((metric, index) => (
                <OverviewCard
                  key={metric.href}
                  {...metric}
                  {...entry(metric.href, index)}
                />
              ))}
            </div>
            {analyticsData ? (
              <p className="text-[11px] text-muted-foreground">
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
            ) : null}
          </section>
        ) : null}

        <MyWorkSummary organizationId={currentOrganizationId} />
        <CatalogedByYouSection organizationId={currentOrganizationId} />
        <CollectionGroupsSection
          organizationId={currentOrganizationId}
          canCreate={canCreateCollectionGroup === true}
        />
      </div>
    </div>
  );
}
