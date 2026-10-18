"use client";

import { EmptyState } from "@v1/ui/empty-state";
import { FeatureGuard } from "@v1/ui/feature-guard";
import { useFeatureAccess } from "@/hooks/use-feature-access";
import { useScopedI18n } from "@/locales/client";
import type { TypeDetailsRecord } from "./types";
import { WineDetailsContent } from "./wine-details-content";

interface WineDetailsTabProps {
  details: TypeDetailsRecord<"wine"> | null;
}

export function WineDetailsTab({ details }: WineDetailsTabProps) {
  const t = useScopedI18n("modules.wine");
  const common = useScopedI18n("modules.common");
  const { hasModule } = useFeatureAccess();
  const hasModuleAccess = hasModule("wine");

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
          title={common("noDetailsYet", { module: "wine" })}
        />
      </div>
    );
  }

  const currentYear = new Date().getFullYear();
  const isInPeakWindow =
    details.peakWindowStart &&
    details.peakWindowEnd &&
    currentYear >= details.peakWindowStart &&
    currentYear <= details.peakWindowEnd;

  const isPastPeak =
    details.peakWindowEnd && currentYear > details.peakWindowEnd;

  return (
    <WineDetailsContent
      details={details}
      isInPeakWindow={Boolean(isInPeakWindow)}
      isPastPeak={Boolean(isPastPeak)}
    />
  );
}
