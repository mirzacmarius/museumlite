"use client";

import { EmptyState } from "@v1/ui/empty-state";
import { FeatureGuard } from "@v1/ui/feature-guard";
import { useFeatureAccess } from "@/hooks/use-feature-access";
import { useScopedI18n } from "@/locales/client";
import { NaturalHistoryDetailsContent } from "./natural-history-details-content";
import type { TypeDetailsRecord } from "./types";

interface NaturalHistoryDetailsTabProps {
  details: TypeDetailsRecord<"natural_history"> | null;
}

export function NaturalHistoryDetailsTab({
  details,
}: NaturalHistoryDetailsTabProps) {
  const t = useScopedI18n("modules.naturalHistory");
  const common = useScopedI18n("modules.common");
  const { hasModule } = useFeatureAccess();
  const hasModuleAccess = hasModule("natural_history");

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
          title={common("noDetailsYet", { module: "natural history" })}
        />
      </div>
    );
  }

  return <NaturalHistoryDetailsContent details={details} />;
}
