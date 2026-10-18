"use client";

import { EmptyState } from "@v1/ui/empty-state";
import { FeatureGuard } from "@v1/ui/feature-guard";
import { useFeatureAccess } from "@/hooks/use-feature-access";
import { useScopedI18n } from "@/locales/client";
import type { TypeDetailsRecord } from "./types";
import { VehicleDetailsContent } from "./vehicle-details-content";

interface VehicleDetailsTabProps {
  details: TypeDetailsRecord<"automotive"> | null;
}

export function VehicleDetailsTab({ details }: VehicleDetailsTabProps) {
  const t = useScopedI18n("modules.vehicle");
  const common = useScopedI18n("modules.common");
  const { hasModule } = useFeatureAccess();
  const hasModuleAccess = hasModule("automotive");

  if (!hasModuleAccess) {
    return (
      <FeatureGuard
        featureName={t("moduleName")}
        reason={{ kind: "module_disabled" }}
        description={t("moduleDescription")}
        showAction={false}
      >
        <div />
      </FeatureGuard>
    );
  }

  if (details === null) {
    return (
      <div className="space-y-6">
        <EmptyState
          variant="card"
          size="sm"
          title={common("noDetailsYet", { module: "vehicle" })}
        />
      </div>
    );
  }

  return <VehicleDetailsContent details={details} />;
}
