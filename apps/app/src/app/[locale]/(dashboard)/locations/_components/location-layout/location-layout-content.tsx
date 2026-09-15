"use client";

import type { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import type { FunctionReturnType } from "convex/server";
import type { ComponentProps, ReactNode } from "react";
import { getNumericCustomFieldNumber } from "../../location-custom-fields";
import { GalleryView } from "../gallery-view";
import { LocationHeader } from "../location-header";
import { StorageView } from "../storage-view";
import type { getDisplayUnitLocations } from "./location-layout-helpers";

type LocationDetail = NonNullable<FunctionReturnType<typeof api.locations.get>>;
type ObjectsAtLocation = FunctionReturnType<
  typeof api.locations.getObjectsAtLocation
>;
type OccupancyResult = FunctionReturnType<typeof api.locations.getOccupancy>;

interface LocationLayoutContentProps {
  actions: ReactNode;
  selectedLocation: LocationDetail;
  environmentalData: ComponentProps<typeof LocationHeader>["environmentalData"];
  occupancy: OccupancyResult | undefined;
  isStorageView: boolean;
  includesDescendants: boolean;
  objectsAtLocation: ObjectsAtLocation | undefined;
  childLocations: Array<{
    _id: Id<"locations">;
    name: string;
    locationCode: string;
    type: string;
    isActive: boolean;
  }>;
  descendantLocations: Array<{
    _id: Id<"locations">;
    name: string;
    locationCode: string;
    type: string;
    isActive: boolean;
  }>;
  automaticDisplayUnitCounts: {
    vitrineCount?: number;
    wallCount?: number;
    cabinetCount?: number;
    shelfCount?: number;
  } | null;
  displayUnitLocations: ReturnType<typeof getDisplayUnitLocations>;
}

export function LocationLayoutContent({
  actions,
  selectedLocation,
  environmentalData,
  occupancy,
  isStorageView,
  includesDescendants,
  objectsAtLocation,
  childLocations,
  descendantLocations,
  automaticDisplayUnitCounts,
  displayUnitLocations,
}: LocationLayoutContentProps) {
  const galleryObjects =
    objectsAtLocation?.map((obj) => ({
      _id: obj._id,
      title: obj.title,
      accessionNumber: obj.accessionNumber,
      status: obj.status,
      currentLocationId: obj.currentLocationId,
      thumbnailUrl: obj.thumbnailUrl,
    })) ?? [];

  const storageObjects =
    objectsAtLocation?.map((object) => ({
      _id: object._id,
      currentLocationId: object.currentLocationId,
      accessionNumber: object.accessionNumber,
      title: object.title,
      status: object.status,
      thumbnailUrl: object.thumbnailUrl,
    })) ?? [];

  const storageUnits = (
    includesDescendants ? descendantLocations : childLocations
  ).map((loc) => ({
    _id: loc._id,
    name: loc.name,
    locationCode: loc.locationCode,
    type: loc.type,
    isActive: loc.isActive,
  }));

  return (
    <>
      <LocationHeader
        actions={actions}
        location={selectedLocation}
        environmentalData={environmentalData}
        totalObjects={objectsAtLocation?.length ?? occupancy?.objectCount ?? 0}
        capacity={occupancy?.capacity ?? 0}
        directObjectCount={occupancy?.objectCount ?? 0}
      />

      {!isStorageView && (
        <GalleryView
          objects={galleryObjects}
          vitrineCount={
            automaticDisplayUnitCounts?.vitrineCount ||
            getNumericCustomFieldNumber(
              selectedLocation.customFields,
              "vitrineCount",
            ) ||
            undefined
          }
          vitrineLocations={displayUnitLocations.vitrines}
          wallCount={
            automaticDisplayUnitCounts?.wallCount ||
            getNumericCustomFieldNumber(
              selectedLocation.customFields,
              "wallCount",
            ) ||
            undefined
          }
          wallLocations={displayUnitLocations.walls}
          wallItemsPerWall={
            getNumericCustomFieldNumber(
              selectedLocation.customFields,
              "wallItemsPerWall",
            ) ?? undefined
          }
          cabinetCount={
            automaticDisplayUnitCounts?.cabinetCount ||
            getNumericCustomFieldNumber(
              selectedLocation.customFields,
              "cabinetCount",
            ) ||
            undefined
          }
          cabinetLocations={displayUnitLocations.cabinets}
          shelfCount={
            automaticDisplayUnitCounts?.shelfCount ||
            getNumericCustomFieldNumber(
              selectedLocation.customFields,
              "shelfCount",
            ) ||
            undefined
          }
          shelfLocations={displayUnitLocations.shelves}
          backgroundImageUrl={selectedLocation.imageUrl}
        />
      )}

      {isStorageView && (
        <StorageView
          units={storageUnits}
          objects={storageObjects}
          includesDescendants={includesDescendants}
        />
      )}
    </>
  );
}
