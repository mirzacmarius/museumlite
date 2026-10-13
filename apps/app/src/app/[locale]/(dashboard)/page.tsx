"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { cn } from "@v1/ui/utils";
import { useQuery } from "convex/react";
import {
  ArrowLeftRight,
  ArrowRight,
  Building2,
  Eye,
  FolderOpen,
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
import { type FormatLocale, formatNumber } from "@/lib/format-number";
import { readyResult, unavailableReason } from "@/lib/projection-availability";
import { useCurrentLocale, useI18n, useScopedI18n } from "@/locales/client";
import {
  MyRecentObjectsSections,
  PendingApprovalsSection,
} from "./_components/my-assignments-sections";
import { MyWorkSections, WorkSection } from "./_components/my-work-sections";
import {
  CollectionGroupsGridSkeleton,
  DashboardPageSkeleton,
} from "./dashboard-page-skeleton";

type MetricAccentColor = "indigo" | "emerald" | "amber" | "blue";
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

interface MetricChipProps {
  href: string;
  title: string;
  value: string;
  icon: LucideIcon;
  accentColor: MetricAccentColor;
}

const METRIC_ICON_CLASS_NAMES = {
  indigo: "text-primary",
  emerald: "text-emerald-400",
  amber: "text-amber-400",
  blue: "text-blue-400",
} satisfies Record<MetricAccentColor, string>;

function MetricChip({
  href,
  title,
  value,
  icon,
  accentColor,
}: MetricChipProps) {
  const Icon = icon;
  return (
    <Link
      href={href}
      className="flex min-w-0 items-center gap-2 rounded-md border border-border bg-card px-2.5 py-1.5 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Icon
        className={cn(
          "size-3.5 shrink-0",
          METRIC_ICON_CLASS_NAMES[accentColor],
        )}
        aria-hidden="true"
      />
      <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
        {value}
      </span>
      <span className="truncate text-xs text-muted-foreground">{title}</span>
    </Link>
  );
}

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

  const metrics: MetricChipProps[] = [
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
    {
      href: "/accessions/transfers?status=pending_source_approval",
      title: tRoot("dashboard.pendingOutgoingTransferApprovals"),
      value: formatMetricValue(analyticsData?.transfers.pending, locale),
      icon: ArrowLeftRight,
      accentColor: "blue",
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
            <div className="flex flex-wrap gap-2">
              {metrics.map((metric) => (
                <MetricChip key={metric.href} {...metric} />
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

        <div className="grid items-start gap-6 @min-[60rem]:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
          <div className="flex min-w-0 flex-col gap-6">
            <PendingApprovalsSection organizationId={currentOrganizationId} />
            <MyWorkSections organizationId={currentOrganizationId} />
          </div>
          <aside className="flex min-w-0 flex-col gap-6">
            <CollectionGroupsSection
              organizationId={currentOrganizationId}
              canCreate={canCreateCollectionGroup === true}
            />
            <MyRecentObjectsSections organizationId={currentOrganizationId} />
          </aside>
        </div>
      </div>
    </div>
  );
}
