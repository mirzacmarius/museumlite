"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { EmptyState } from "@v1/ui/empty-state";
import { FeatureGuard } from "@v1/ui/feature-guard";
import { cn } from "@v1/ui/utils";
import { useQuery } from "convex/react";
import { Stethoscope } from "lucide-react";
import { ClientDate } from "@/components/client-date";

import { useI18n } from "@/locales/client";
import { DetailSection } from "./detail-section";

interface ConservationTabProps {
  collectionId: string;
  locale: string;
  hasAccess: boolean;
}

export function ConservationTab({
  collectionId,
  locale,
  hasAccess,
}: ConservationTabProps) {
  const tRoot = useI18n();
  const treatments = useQuery(
    api.conservationTreatments?.list,
    hasAccess && collectionId
      ? { collectionId: collectionId as Id<"collections"> }
      : "skip",
  );

  if (!hasAccess) {
    return (
      <FeatureGuard
        featureName={tRoot("objects.tabs.conservation")}
        reason={{ kind: "tier_required", tier: "pro" }}
        showAction={false}
      >
        <div />
      </FeatureGuard>
    );
  }

  return (
    <DetailSection
      title={tRoot("untranslatedRecords.objects.conservation.treatmentHistory")}
      icon={Stethoscope}
      bodyClassName="border-0 bg-transparent p-0 sm:p-0"
    >
      {treatments === undefined ? (
        <p className="text-muted-foreground">
          {tRoot("untranslatedRecords.objects.loading.treatments")}
        </p>
      ) : treatments && treatments.length > 0 ? (
        <div className="space-y-4">
          {treatments.map((treatment) => (
            <div
              key={treatment._id}
              className="group overflow-hidden rounded-xl border border-border/60 bg-card"
            >
              <div className="flex items-center justify-between border-b border-border/60 bg-secondary/30 px-4 py-3">
                <div className="flex items-center gap-3">
                  <span
                    className={cn(
                      "rounded px-2 py-0.5 text-xs font-bold uppercase tracking-wide",
                      treatment.treatmentType === "routine"
                        ? "border border-green-500/20 bg-green-500/10 text-green-700 dark:text-green-400"
                        : treatment.treatmentType === "stabilization"
                          ? "border border-blue-500/20 bg-blue-500/10 text-blue-700 dark:text-blue-400"
                          : "border border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-400",
                    )}
                  >
                    {treatment.treatmentType}
                  </span>
                  <span className="text-xs font-medium text-foreground">
                    {treatment.title}
                  </span>
                </div>
                <span className="font-mono text-xs text-muted-foreground">
                  <ClientDate
                    timestamp={treatment.performedAt}
                    locale={locale}
                  />
                </span>
              </div>
              <div className="p-4">
                <p className="mb-3 text-sm text-muted-foreground">
                  {treatment.description}
                </p>
                {treatment.performedByName && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <div className="flex size-5 items-center justify-center rounded-full bg-secondary text-xs">
                      {treatment.performedByName.charAt(0)}
                    </div>
                    <span>
                      {tRoot(
                        "untranslatedRecords.objects.conservation.performedBy",
                      )}{" "}
                      <span className="text-muted-foreground">
                        {treatment.performedByName}
                      </span>
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          variant="card"
          size="sm"
          title={tRoot("untranslatedRecords.objects.conservation.noTreatments")}
        />
      )}
    </DetailSection>
  );
}
