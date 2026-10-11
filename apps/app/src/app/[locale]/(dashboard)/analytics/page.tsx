"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { ANALYTICS_SECTION_PERMISSIONS } from "@v1/backend/convex/utils/analyticsSections";
import { Skeleton } from "@v1/ui/skeleton";
import { useQuery } from "convex/react";
import { BarChart3 } from "lucide-react";
import dynamic from "next/dynamic";
import { CapabilityGuard } from "@/components/capability-guard";
import { ClientTime } from "@/components/client-date";
import { MetricsUnavailableNotice } from "@/components/metrics-unavailable-notice";
import { useOrganization } from "@/components/organization-provider";
import { usePermissions } from "@/components/permission-gate";
import { useCapabilities } from "@/hooks/use-capabilities";
import { useClientNow } from "@/hooks/use-client-date-format";
import { useFeatureAccess } from "@/hooks/use-feature-access";
import { readyResult, unavailableReason } from "@/lib/projection-availability";
import { useI18n } from "@/locales/client";

const chartFallback = () => (
  <Skeleton className="h-[400px] w-full rounded-xl bg-muted/20" />
);

const InventoryValuationCard = dynamic(
  () =>
    import("./_components/inventory-valuation-card").then(
      (mod) => mod.InventoryValuationCard,
    ),
  { loading: chartFallback },
);

const LoanCalendarCard = dynamic(
  () =>
    import("./_components/loan-calendar-card").then(
      (mod) => mod.LoanCalendarCard,
    ),
  { loading: chartFallback },
);

const ExhibitionPipelineCard = dynamic(
  () =>
    import("./_components/exhibition-pipeline-card").then(
      (mod) => mod.ExhibitionPipelineCard,
    ),
  { loading: chartFallback },
);

const ComplianceReportCard = dynamic(
  () =>
    import("./_components/compliance-report-card").then(
      (mod) => mod.ComplianceReportCard,
    ),
  { loading: chartFallback },
);

const AuditTrailCard = dynamic(
  () =>
    import("./_components/audit-trail-card").then((mod) => mod.AuditTrailCard),
  { loading: chartFallback },
);

const LocationUtilizationCard = dynamic(
  () =>
    import("./_components/location-utilization-card").then(
      (mod) => mod.LocationUtilizationCard,
    ),
  { loading: chartFallback },
);

const ReportExportsCard = dynamic(
  () =>
    import("./_components/report-exports-card").then(
      (mod) => mod.ReportExportsCard,
    ),
  {
    loading: () => (
      <Skeleton className="h-[350px] w-full rounded-xl bg-muted/20" />
    ),
  },
);

const RegisterExportsCard = dynamic(
  () =>
    import("./_components/register-exports-card").then(
      (mod) => mod.RegisterExportsCard,
    ),
  {
    loading: () => (
      <Skeleton className="h-[280px] w-full rounded-xl bg-muted/20" />
    ),
  },
);

const ScheduledReportsCard = dynamic(
  () =>
    import("./_components/scheduled-reports-card").then(
      (mod) => mod.ScheduledReportsCard,
    ),
  {
    loading: () => (
      <Skeleton className="h-[280px] w-full rounded-xl bg-muted/20" />
    ),
  },
);

export default function AnalyticsPage() {
  const t = useI18n();
  const { currentOrganizationId } = useOrganization();
  const { hasFeature, hasModule } = useFeatureAccess();
  const hasReporting = useCapabilities().isAvailable("reporting");
  const hasCompliance = hasFeature("compliance");
  const hasInventoryValuation = hasModule("inventory_valuation");
  const { hasPermission, isLoading: permissionsLoading } = usePermissions();
  const canReadLocations = hasPermission(
    ANALYTICS_SECTION_PERMISSIONS.locationUtilization,
  );
  const now = useClientNow();

  const kpis = useQuery(
    api.dashboard.getOperationalKpis,
    currentOrganizationId && hasReporting
      ? {
          organizationId: currentOrganizationId as Id<"organizations">,
        }
      : "skip",
  );

  const compliance = useQuery(
    api.dashboard.getComplianceReport,
    currentOrganizationId && hasCompliance && now !== undefined
      ? {
          organizationId: currentOrganizationId as Id<"organizations">,
          now,
        }
      : "skip",
  );

  const locationUtilization = useQuery(
    api.dashboard.getLocationUtilization,
    currentOrganizationId &&
      hasReporting &&
      canReadLocations &&
      now !== undefined
      ? {
          organizationId: currentOrganizationId as Id<"organizations">,
          now,
        }
      : "skip",
  );

  if (!currentOrganizationId) return null;

  if (!hasReporting) {
    return (
      <CapabilityGuard
        capability="reporting"
        featureName={t("analytics.featureName")}
      >
        <div className="p-6" />
      </CapabilityGuard>
    );
  }

  const isLoading =
    !kpis ||
    permissionsLoading ||
    (canReadLocations && !locationUtilization) ||
    (hasCompliance && !compliance);

  if (isLoading) {
    return (
      <div className="flex flex-col h-full gap-y-6 p-6 overflow-hidden">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
          <Skeleton className="h-4 w-32" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          <Skeleton className="h-[400px] w-full rounded-xl bg-muted/20" />
          <Skeleton className="h-[400px] w-full rounded-xl bg-muted/20" />
          <Skeleton className="h-[400px] w-full rounded-xl bg-muted/20" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-[400px] w-full rounded-xl bg-muted/20" />
          <Skeleton className="h-[400px] w-full rounded-xl bg-muted/20" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-[350px] w-full lg:col-span-2 rounded-xl bg-muted/20" />
        </div>
      </div>
    );
  }

  if (!kpis) {
    return null;
  }

  const kpiData = readyResult(kpis);
  const locationData = readyResult(locationUtilization);
  const complianceData = hasCompliance ? readyResult(compliance) : undefined;
  const metricsUnavailableReason =
    unavailableReason(kpis) ??
    unavailableReason(locationUtilization) ??
    (hasCompliance ? unavailableReason(compliance) : undefined);
  const reports =
    kpiData &&
    (!canReadLocations || locationData) &&
    (!hasCompliance || complianceData)
      ? {
          kpis: kpiData,
          compliance: complianceData,
          locationUtilization: locationData,
          hasInventoryValuation,
        }
      : null;

  return (
    <div className="flex flex-col h-full gap-y-6 p-6 overflow-y-auto">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h2 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <BarChart3 className="size-6 text-primary" />
            {t("analytics.title")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t("analytics.description")}
          </p>
        </div>
        {kpiData ? (
          <div className="text-xs text-muted-foreground font-mono bg-muted/30 px-2 py-1 rounded border border-border">
            {t("analytics.updatedAt")}{" "}
            <ClientTime timestamp={kpiData.generatedAt} />
          </div>
        ) : null}
      </div>

      {metricsUnavailableReason ? (
        <MetricsUnavailableNotice reason={metricsUnavailableReason} />
      ) : null}

      {kpiData ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {hasInventoryValuation && (
            <InventoryValuationCard data={kpiData.inventory} />
          )}
          <LoanCalendarCard data={kpiData.loans} />
          <ExhibitionPipelineCard
            data={{ ...kpiData.exhibitions, asOf: kpiData.asOf }}
          />
        </div>
      ) : null}

      {complianceData && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ComplianceReportCard
            data={{
              accessions: complianceData.accessions,
              deaccessions: complianceData.deaccessions,
            }}
          />
          <AuditTrailCard data={complianceData.auditTrail} />
        </div>
      )}

      {locationData || !canReadLocations ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <CapabilityGuard
            capability="reporting"
            permission={ANALYTICS_SECTION_PERMISSIONS.locationUtilization}
            featureName={t("analytics.locations.title")}
          >
            {locationData ? (
              <LocationUtilizationCard data={locationData} />
            ) : null}
          </CapabilityGuard>
        </div>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <CapabilityGuard
          capability="reporting"
          permission={ANALYTICS_SECTION_PERMISSIONS.scheduledReports}
          featureName={t("analytics.scheduledReports.title")}
        >
          <ScheduledReportsCard organizationId={currentOrganizationId} />
        </CapabilityGuard>
        <ReportExportsCard
          organizationId={currentOrganizationId}
          reports={reports}
          unavailableReason={metricsUnavailableReason}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RegisterExportsCard organizationId={currentOrganizationId} />
      </div>
    </div>
  );
}
