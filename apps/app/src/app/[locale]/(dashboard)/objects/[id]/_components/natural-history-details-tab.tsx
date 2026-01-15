"use client";

import { useFeatureAccess } from "@/hooks/use-feature-access";
import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { FeatureGuard } from "@v1/ui/feature-guard";
import { cn } from "@v1/ui/utils";
import { useQuery } from "convex/react";
import { format } from "date-fns";
import { Calendar, MapPin, Plus, TreePine, User } from "lucide-react";

interface NaturalHistoryDetailsTabProps {
  collectionId: string;
  organizationId: Id<"organizations">;
}

export function NaturalHistoryDetailsTab({
  collectionId,
  organizationId,
}: NaturalHistoryDetailsTabProps) {
  const { hasModule } = useFeatureAccess();
  const hasModuleAccess = hasModule("natural_history");
  const details = useQuery(
    api.naturalHistoryDetails.get,
    hasModuleAccess
      ? { collectionId: collectionId as Id<"collections"> }
      : "skip",
  );

  if (!hasModuleAccess) {
    return (
      <FeatureGuard
        featureName="Natural History Module"
        isLocked={true}
        description="Enable the Natural History module to track taxonomy, geolocation, and more."
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
          Loading natural history details...
        </p>
      </div>
    );
  }

  if (details === null) {
    return (
      <div className="space-y-6">
        <div className="flex h-32 flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-border">
          <p className="text-sm text-muted-foreground">
            No natural history details recorded yet
          </p>
          <Button variant="outline" size="sm">
            <Plus className="mr-2 h-4 w-4" />
            Add Natural History Details
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-border/60 bg-secondary/20 p-4">
          <div className="mb-2 flex items-center gap-2">
            <TreePine className="h-4 w-4 text-green-500" />
            <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
              Species
            </span>
          </div>
          <span className="text-lg font-light text-foreground">
            {details.species ? `${details.genus} ${details.species}` : "—"}
          </span>
          {details.commonName && (
            <p className="mt-1 text-xs text-muted-foreground">
              {details.commonName}
            </p>
          )}
        </div>

        <div className="rounded-xl border border-border/60 bg-secondary/20 p-4">
          <div className="mb-2 flex items-center gap-2">
            <MapPin className="h-4 w-4 text-blue-500" />
            <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
              Location
            </span>
          </div>
          <span className="text-sm font-medium text-foreground">
            {details.latitude && details.longitude
              ? `${details.latitude.toFixed(2)}, ${details.longitude.toFixed(2)}`
              : "—"}
          </span>
          {details.locality && (
            <p className="mt-1 text-xs text-muted-foreground truncate">
              {details.locality}
            </p>
          )}
        </div>

        <div className="rounded-xl border border-border/60 bg-secondary/20 p-4">
          <div className="mb-2 flex items-center gap-2">
            <Calendar className="h-4 w-4 text-purple-500" />
            <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
              Collected
            </span>
          </div>
          <span className="text-sm font-medium text-foreground">
            {details.collectionDate
              ? format(new Date(details.collectionDate), "MMM yyyy")
              : "—"}
          </span>
          {details.collectorName && (
            <p className="mt-1 text-xs text-muted-foreground">
              {details.collectorName}
            </p>
          )}
        </div>

        <div className="rounded-xl border border-border/60 bg-secondary/20 p-4">
          <div className="mb-2 flex items-center gap-2">
            <TreePine className="h-4 w-4 text-amber-500" />
            <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
              Preservation
            </span>
          </div>
          <span className="text-sm font-medium text-foreground">
            {details.preservationMethod || "—"}
          </span>
          {details.storageMedium && (
            <p className="mt-1 text-xs text-muted-foreground truncate">
              {details.storageMedium}
            </p>
          )}
        </div>
      </div>

      <div>
        <h3 className="mb-4 flex items-center gap-2 text-xs font-medium text-foreground">
          <TreePine className="h-4 w-4 text-green-500" />
          Taxonomic Classification
        </h3>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <div className="rounded-lg border border-border/60 bg-secondary/20 p-3">
            <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground mb-1">
              Kingdom
            </div>
            <div className="text-sm font-medium text-foreground">
              {details.kingdom || "—"}
            </div>
          </div>
          <div className="rounded-lg border border-border/60 bg-secondary/20 p-3">
            <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground mb-1">
              Phylum
            </div>
            <div className="text-sm font-medium text-foreground">
              {details.phylum || "—"}
            </div>
          </div>
          <div className="rounded-lg border border-border/60 bg-secondary/20 p-3">
            <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground mb-1">
              Class
            </div>
            <div className="text-sm font-medium text-foreground">
              {details.taxonomyClass || "—"}
            </div>
          </div>
          <div className="rounded-lg border border-border/60 bg-secondary/20 p-3">
            <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground mb-1">
              Order
            </div>
            <div className="text-sm font-medium text-foreground">
              {details.order || "—"}
            </div>
          </div>
          <div className="rounded-lg border border-border/60 bg-secondary/20 p-3">
            <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground mb-1">
              Family
            </div>
            <div className="text-sm font-medium text-foreground">
              {details.family || "—"}
            </div>
          </div>
          <div className="rounded-lg border border-border/60 bg-secondary/20 p-3">
            <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground mb-1">
              Genus
            </div>
            <div className="text-sm font-medium text-foreground">
              {details.genus || "—"}
            </div>
          </div>
          <div className="rounded-lg border border-border/60 bg-secondary/20 p-3">
            <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground mb-1">
              Species
            </div>
            <div className="text-sm font-medium text-foreground">
              {details.species || "—"}
            </div>
          </div>
          <div className="rounded-lg border border-border/60 bg-secondary/20 p-3">
            <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground mb-1">
              Subspecies
            </div>
            <div className="text-sm font-medium text-foreground">
              {details.subspecies || "—"}
            </div>
          </div>
        </div>
      </div>

      <div>
        <h3 className="mb-4 flex items-center gap-2 text-xs font-medium text-foreground">
          <MapPin className="h-4 w-4 text-blue-500" />
          Geolocation Data
        </h3>

        <div className="rounded-lg border border-border/60 bg-secondary/20 p-4">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <div>
              <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground mb-1">
                Latitude
              </div>
              <div className="text-sm font-medium text-foreground">
                {details.latitude || "—"}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground mb-1">
                Longitude
              </div>
              <div className="text-sm font-medium text-foreground">
                {details.longitude || "—"}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground mb-1">
                Altitude
              </div>
              <div className="text-sm font-medium text-foreground">
                {details.altitude ? `${details.altitude}m` : "—"}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground mb-1">
                Habitat
              </div>
              <div className="text-sm font-medium text-foreground">
                {details.habitat || "—"}
              </div>
            </div>
          </div>
          {details.locality && (
            <div className="mt-4 pt-4 border-t border-border/40">
              <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground mb-2">
                Locality Description
              </div>
              <p className="text-sm text-muted-foreground">
                {details.locality}
              </p>
            </div>
          )}
        </div>
      </div>

      <div>
        <h3 className="mb-4 flex items-center gap-2 text-xs font-medium text-foreground">
          <Calendar className="h-4 w-4 text-purple-500" />
          Collection Information
        </h3>

        <div className="rounded-lg border border-border/60 bg-secondary/20 p-4">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <div>
              <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground mb-1">
                Collection Date
              </div>
              <div className="text-sm font-medium text-foreground">
                {details.collectionDate
                  ? format(new Date(details.collectionDate), "MMM d, yyyy")
                  : "—"}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground mb-1">
                Collection Method
              </div>
              <div className="text-sm font-medium text-foreground">
                {details.collectionMethod || "—"}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground mb-1">
                Collector
              </div>
              <div className="text-sm font-medium text-foreground">
                {details.collectorName || "—"}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground mb-1">
                Specimen Type
              </div>
              <div className="text-sm font-medium text-foreground">
                {details.specimenType || "—"}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div>
        <h3 className="mb-4 flex items-center gap-2 text-xs font-medium text-foreground">
          <TreePine className="h-4 w-4 text-amber-500" />
          Preservation & Storage
        </h3>

        <div className="rounded-lg border border-border/60 bg-secondary/20 p-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground mb-1">
                Preservation Method
              </div>
              <div className="text-sm font-medium text-foreground">
                {details.preservationMethod || "—"}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground mb-1">
                Storage Medium
              </div>
              <div className="text-sm font-medium text-foreground">
                {details.storageMedium || "—"}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3 mt-4">
            <div>
              <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground mb-1">
                Container Type
              </div>
              <div className="text-sm font-medium text-foreground">
                {details.containerType || "—"}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground mb-1">
                Sex
              </div>
              <div className="text-sm font-medium text-foreground">
                {details.sex || "—"}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground mb-1">
                Life Stage
              </div>
              <div className="text-sm font-medium text-foreground">
                {details.lifeStage || "—"}
              </div>
            </div>
          </div>
        </div>
      </div>

      {(details.dnaAvailable || details.tissueAvailable) && (
        <div>
          <h3 className="mb-4 flex items-center gap-2 text-xs font-medium text-foreground">
            <TreePine className="h-4 w-4 text-cyan-500" />
            Scientific Data Availability
          </h3>

          <div className="rounded-lg border border-border/60 bg-secondary/20 p-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {details.dnaAvailable !== undefined && (
                <div>
                  <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground mb-1">
                    DNA Available
                  </div>
                  <div className="text-sm font-medium text-foreground">
                    {details.dnaAvailable ? "Yes" : "No"}
                  </div>
                </div>
              )}
              {details.tissueAvailable !== undefined && (
                <div>
                  <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground mb-1">
                    Tissue Available
                  </div>
                  <div className="text-sm font-medium text-foreground">
                    {details.tissueAvailable ? "Yes" : "No"}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {(details.geologicalPeriod || details.formation) && (
        <div>
          <h3 className="mb-4 flex items-center gap-2 text-xs font-medium text-foreground">
            <TreePine className="h-4 w-4 text-orange-500" />
            Geological Information
          </h3>

          <div className="rounded-lg border border-border/60 bg-secondary/20 p-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {details.geologicalPeriod && (
                <div>
                  <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground mb-1">
                    Geological Period
                  </div>
                  <div className="text-sm font-medium text-foreground">
                    {details.geologicalPeriod}
                  </div>
                </div>
              )}
              {details.formation && (
                <div>
                  <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground mb-1">
                    Formation
                  </div>
                  <div className="text-sm font-medium text-foreground">
                    {details.formation}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
