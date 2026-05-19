"use client";

import { useOrganization } from "@/components/organization-provider";
import { useFeatureAccess } from "@/hooks/use-feature-access";
import { useI18n } from "@/locales/client";
import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { FeatureGuard } from "@v1/ui/feature-guard";
import { Skeleton } from "@v1/ui/skeleton";
import { useQuery } from "convex/react";
import { BarChart3 } from "lucide-react";
import dynamic from "next/dynamic";

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

export default function AnalyticsPage() {
  const t = useI18n();
  const { currentOrganizationId } = useOrganization();
  const { hasFeature } = useFeatureAccess();
  const hasReporting = hasFeature("reporting");
  const hasCompliance = hasFeature("compliance");

  const kpis = useQuery(
    api.dashboard.getOperationalKpis,
    currentOrganizationId && hasReporting
      ? { organizationId: currentOrganizationId as Id<"organizations"> }
      : "skip",
  );

  const compliance = useQuery(
    api.dashboard.getComplianceReport,
    currentOrganizationId && hasCompliance
      ? { organizationId: currentOrganizationId as Id<"organizations"> }
      : "skip",
  );

  const locationUtilization = useQuery(
    api.dashboard.getLocationUtilization,
    currentOrganizationId && hasReporting
      ? { organizationId: currentOrganizationId as Id<"organizations"> }
      : "skip",
  );

  if (!currentOrganizationId) return null;

  if (!hasReporting) {
    return (
      <FeatureGuard
        featureName={t("analytics.featureName")}
        isLocked={true}
        tierNeeded="pro"
      >
        <div className="p-6" />
      </FeatureGuard>
    );
  }

  const isLoading =
    !kpis || !locationUtilization || (hasCompliance && !compliance);

  if (isLoading) {
    return (
      <div className="flex flex-col h-full space-y-6 p-6 overflow-hidden">
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

  if (!kpis || !locationUtilization) {
    return null;
  }

  const complianceData = hasCompliance ? compliance : undefined;

  return (
    <FeatureGuard
      featureName={t("analytics.featureName")}
      isLocked={!hasFeature("reporting")}
      tierNeeded="pro"
    >
      <div className="flex flex-col h-full space-y-6 p-6 overflow-y-auto">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <BarChart3 className="size-6 text-primary" />
              {t("analytics.title")}
            </h2>
            <p className="text-sm text-muted-foreground">
              {t("analytics.description")}
            </p>
          </div>
          <div className="text-xs text-muted-foreground font-mono bg-muted/30 px-2 py-1 rounded border border-border">
            {t("analytics.updatedAt")}{" "}
            {new Date(kpis.generatedAt).toLocaleTimeString()}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          <InventoryValuationCard data={kpis.inventory} />
          <LoanCalendarCard data={kpis.loans} />
          <ExhibitionPipelineCard data={kpis.exhibitions} />
        </div>

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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <LocationUtilizationCard data={locationUtilization} />
        </div>

        <ReportExportsCard
          kpis={kpis}
          compliance={complianceData}
          locationUtilization={locationUtilization}
        />
      </div>
    </FeatureGuard>
  );
}
