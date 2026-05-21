"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { FeatureGuard } from "@v1/ui/feature-guard";
import { useQuery } from "convex/react";
import { Plus } from "lucide-react";
import { useFeatureAccess } from "@/hooks/use-feature-access";
import { useCurrentLocale, useScopedI18n } from "@/locales/client";
import { WineDetailsContent } from "./wine-details-content";

interface WineDetailsTabProps {
  collectionId: string;
  organizationId: Id<"organizations">;
}

export function WineDetailsTab({ collectionId }: WineDetailsTabProps) {
  const _locale = useCurrentLocale();
  const t = useScopedI18n("modules.wine");
  const common = useScopedI18n("modules.common");
  const { hasModule } = useFeatureAccess();
  const hasModuleAccess = hasModule("wine");
  const details = useQuery(
    api.wineDetails.get,
    hasModuleAccess
      ? { collectionId: collectionId as Id<"collections"> }
      : "skip",
  );

  if (!hasModuleAccess) {
    return (
      <FeatureGuard
        featureName={t("moduleName")}
        isLocked={true}
        description={t("moduleDescription")}
        showUpgrade={false}
      >
        <div />
      </FeatureGuard>
    );
  }

  if (details === undefined) {
    return (
      <div className="flex h-32 items-center justify-center">
        <p className="text-sm text-muted-foreground">
          {common("loading", { module: "wine" })}
        </p>
      </div>
    );
  }

  if (details === null) {
    return (
      <div className="space-y-6">
        <div className="flex h-32 flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-border">
          <p className="text-sm text-muted-foreground">
            {common("noDetailsYet", { module: "wine" })}
          </p>
          <Button variant="outline" size="sm">
            <Plus className="mr-2 size-4" />
            {common("addDetails", { module: "Wine" })}
          </Button>
        </div>
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
