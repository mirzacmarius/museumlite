"use client";

import { Suspense } from "react";
import { CapabilityGuard } from "@/components/capability-guard";
import { useOrganization } from "@/components/organization-provider";
import { useScopedI18n } from "@/locales/client";
import { AccessionsPageSkeleton } from "../accessions/accessions-page-skeleton";
import { ConditionAssessmentsPageClient } from "./condition-assessments-page-client";

const pageSkeleton = (
  <AccessionsPageSkeleton
    actionsCount={0}
    showWorkbenchNav={false}
    statsCount={3}
  />
);

export default function ConditionAssessmentsPage() {
  const t = useScopedI18n("conditionAssessments");
  const { currentOrganizationId, isLoading } = useOrganization();

  if (isLoading || !currentOrganizationId) {
    return pageSkeleton;
  }

  return (
    <div className="flex size-full flex-col bg-background">
      <CapabilityGuard
        capability="condition_assessments"
        featureName={t("title")}
        loadingFallback={pageSkeleton}
      >
        <Suspense fallback={pageSkeleton}>
          <ConditionAssessmentsPageClient
            organizationId={currentOrganizationId}
          />
        </Suspense>
      </CapabilityGuard>
    </div>
  );
}
