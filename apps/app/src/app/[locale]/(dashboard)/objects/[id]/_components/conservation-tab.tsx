"use client";

import { formatDate } from "@/lib/format-date";
import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { FeatureGuard } from "@v1/ui/feature-guard";
import { cn } from "@v1/ui/utils";
import { useQuery } from "convex/react";
import { Stethoscope } from "lucide-react";

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
  const treatments = useQuery(
    api.conservationTreatments?.list,
    hasAccess && collectionId
      ? { collectionId: collectionId as Id<"collections"> }
      : "skip",
  );

  if (!hasAccess) {
    return (
      <FeatureGuard
        featureName="Conservation"
        isLocked={true}
        tierNeeded="pro"
        showUpgrade={false}
      >
        <div />
      </FeatureGuard>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-xs font-medium text-foreground">
          <Stethoscope className="h-4 w-4 text-rose-500" />
          Treatment History
        </h3>
      </div>

      {treatments === undefined ? (
        <p className="text-muted-foreground">Loading treatments...</p>
      ) : treatments && treatments.length > 0 ? (
        <div className="space-y-4">
          {treatments.map((treatment) => (
            <div
              key={treatment._id}
              className="group overflow-hidden rounded-xl border border-border/60 bg-secondary/20"
            >
              <div className="flex items-center justify-between border-b border-border/60 bg-secondary/30 px-4 py-3">
                <div className="flex items-center gap-3">
                  <span
                    className={cn(
                      "rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                      treatment.treatmentType === "routine"
                        ? "border border-green-500/20 bg-green-500/10 text-green-400"
                        : treatment.treatmentType === "stabilization"
                          ? "border border-blue-500/20 bg-blue-500/10 text-blue-400"
                          : "border border-amber-500/20 bg-amber-500/10 text-amber-400",
                    )}
                  >
                    {treatment.treatmentType}
                  </span>
                  <span className="text-xs font-medium text-foreground">
                    {treatment.title}
                  </span>
                </div>
                <span className="font-mono text-xs text-muted-foreground">
                  {formatDate(new Date(treatment.performedAt), locale)}
                </span>
              </div>
              <div className="p-4">
                <p className="mb-3 text-sm text-muted-foreground">
                  {treatment.description}
                </p>
                {treatment.performedByName && (
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                    <div className="flex size-5 items-center justify-center rounded-full bg-secondary text-[8px]">
                      {treatment.performedByName.charAt(0)}
                    </div>
                    <span>
                      Performed by{" "}
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
        <div className="flex h-32 items-center justify-center rounded-xl border border-dashed border-border">
          <p className="text-sm text-muted-foreground">
            No conservation treatments recorded
          </p>
        </div>
      )}
    </div>
  );
}
