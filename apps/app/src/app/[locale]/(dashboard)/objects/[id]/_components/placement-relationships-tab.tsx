"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { useQuery } from "convex/react";
import { Boxes, MapPin } from "lucide-react";
import Link from "next/link";
import { useI18n } from "@/locales/client";
import {
  DetailField,
  DetailGrid,
  DetailLabel,
  DetailSection,
} from "./detail-section";
import { OpenMoveRequests } from "./movements/open-move-requests";
import type { CollectionData, LocationPathItem } from "./types";

interface PlacementRelationshipsTabProps {
  collection: CollectionData;
  collectionId: Id<"collections">;
  locationPath: LocationPathItem[];
}

export function PlacementRelationshipsTab({
  collection,
  collectionId,
  locationPath,
}: PlacementRelationshipsTabProps) {
  const tRoot = useI18n();
  const parentObject = useQuery(api.collections.getParentObject, {
    collectionId,
  });
  const childObjects = useQuery(api.collections.getChildObjects, {
    collectionId,
  });
  const location = locationPath.map((item) => item.name).join(" / ");
  const currentLocation = locationPath.at(-1);
  const locationCodeFromPath = currentLocation?.locationCode?.trim();
  const currentLocationDetails = useQuery(
    api.locations.get,
    currentLocation && !locationCodeFromPath
      ? { locationId: currentLocation._id }
      : "skip",
  );
  const locationCode =
    locationCodeFromPath || currentLocationDetails?.locationCode.trim();
  const isOnDisplay = collection.displayStatus === "on_display";

  return (
    <div className="space-y-8">
      <DetailSection
        title={tRoot("untranslatedRecords.objects.detail.placement")}
        icon={MapPin}
      >
        <DetailGrid>
          <DetailField label={tRoot("objects.form.currentLocation")}>
            <div className="flex items-center justify-between gap-3">
              {currentLocation ? (
                <Link
                  href={`/locations/${currentLocation._id}`}
                  className="min-w-0 rounded-sm text-sm text-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {location}
                </Link>
              ) : (
                <span className="min-w-0 text-sm text-muted-foreground/70">
                  -
                </span>
              )}
              {collection.currentLocationId && locationCode && (
                <div className="shrink-0 rounded bg-secondary/60 px-2 py-1 font-mono text-xs text-muted-foreground">
                  {locationCode}
                </div>
              )}
            </div>
          </DetailField>

          <DetailField label={tRoot("objects.detail.onDisplay")}>
            <span
              className={
                isOnDisplay
                  ? "inline-flex w-fit rounded border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-400"
                  : "text-sm text-muted-foreground"
              }
            >
              {isOnDisplay
                ? tRoot("untranslatedRecords.objects.status.yes")
                : tRoot("untranslatedRecords.objects.status.no")}
            </span>
          </DetailField>
        </DetailGrid>
      </DetailSection>

      <OpenMoveRequests
        collectionId={collectionId}
        organizationId={collection.organizationId}
      />

      <DetailSection
        title={tRoot("untranslatedRecords.objects.attributes.relationships")}
        icon={Boxes}
        bodyClassName="space-y-5"
      >
        <div>
          <DetailLabel className="mb-2">
            {tRoot("objects.form.parentObject")}
          </DetailLabel>
          {parentObject === undefined ? (
            <span className="text-sm text-muted-foreground">
              {tRoot("untranslatedRecords.objects.loading.default")}
            </span>
          ) : parentObject ? (
            <Button variant="outline" size="sm" asChild>
              <Link href={`/objects/${parentObject._id}`}>
                {parentObject.title} ({parentObject.accessionNumber})
              </Link>
            </Button>
          ) : (
            <span className="text-sm text-muted-foreground">
              {tRoot("untranslatedRecords.objects.detail.noParent")}
            </span>
          )}
        </div>

        <div>
          <DetailLabel className="mb-2">
            {tRoot("untranslatedRecords.objects.detail.childObjects")}
          </DetailLabel>
          {childObjects === undefined ? (
            <span className="text-sm text-muted-foreground">
              {tRoot("untranslatedRecords.objects.loading.default")}
            </span>
          ) : childObjects.children.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {childObjects.children.map((child) => (
                <Button key={child._id} variant="outline" size="sm" asChild>
                  <Link href={`/objects/${child._id}`}>
                    {child.title} ({child.accessionNumber})
                  </Link>
                </Button>
              ))}
            </div>
          ) : (
            <span className="text-sm text-muted-foreground">
              {tRoot("untranslatedRecords.objects.detail.noChildren")}
            </span>
          )}
        </div>
      </DetailSection>
    </div>
  );
}
