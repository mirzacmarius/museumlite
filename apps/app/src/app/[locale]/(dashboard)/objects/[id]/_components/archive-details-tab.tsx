"use client";

import { EmptyState } from "@v1/ui/empty-state";
import { FeatureGuard } from "@v1/ui/feature-guard";
import { useFeatureAccess } from "@/hooks/use-feature-access";
import { useScopedI18n } from "@/locales/client";
import { ArchiveDetailsContent } from "./archive-details-content";
import type { TypeDetailsRecord } from "./types";

interface ArchiveDetailsTabProps {
  details: TypeDetailsRecord<"archive"> | null;
}

export function ArchiveDetailsTab({ details }: ArchiveDetailsTabProps) {
  const t = useScopedI18n("modules.archive");
  const common = useScopedI18n("modules.common");
  const { hasModule } = useFeatureAccess();
  const hasModuleAccess = hasModule("archive");

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
          title={common("noDetailsYet", { module: "archive" })}
        />
      </div>
    );
  }

  return <ArchiveDetailsContent details={details} />;
}
