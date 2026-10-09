"use client";

import { FeatureGuard } from "@v1/ui/feature-guard";
import { useOrganization } from "@/components/organization-provider";
import { MultiPermissionGate } from "@/components/permission-gate";
import { useFeatureAccess } from "@/hooks/use-feature-access";
import { useScopedI18n } from "@/locales/client";
import { TemplatesManager } from "./templates-manager";

export default function LoanAgreementsSettingsPage() {
  const t = useScopedI18n("loanAgreementTemplates");
  const { currentOrganization } = useOrganization();
  const { hasFeature } = useFeatureAccess();

  if (!currentOrganization) return null;

  return (
    <FeatureGuard
      featureName={t("title")}
      isLocked={!hasFeature("loans")}
      tierNeeded="pro"
    >
      <MultiPermissionGate
        permissions={["organization.manage_settings", "loans.read"]}
        mode="all"
      >
        <TemplatesManager
          organizationId={currentOrganization._id}
          organizationName={currentOrganization.name}
        />
      </MultiPermissionGate>
    </FeatureGuard>
  );
}
