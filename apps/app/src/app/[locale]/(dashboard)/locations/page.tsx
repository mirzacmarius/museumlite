"use client";

import { useOrganization } from "@/components/organization-provider";
import { PermissionGate } from "@/components/permission-gate";
import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { useQuery } from "convex/react";
import { Building2, MapPin, Pencil, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AddChildLocationDialog } from "./_components/add-child-location-dialog";
import { DeleteLocationDialog } from "./_components/delete-location-dialog";
import { EditLocationDialog } from "./_components/edit-location-dialog";
import { GalleryView } from "./_components/gallery-view";
import { LocationHeader } from "./_components/location-header";
import { LocationSidebar } from "./_components/location-sidebar";
import { StorageView } from "./_components/storage-view";
import { getNumericCustomFieldNumber } from "./location-custom-fields";
import {
  getAutomaticDisplayUnitCounts,
  getDefaultLocationId,
  getDescendantLocations,
  getVisibleSidebarLocations,
  isStorageLocation,
  shouldAutoDisplayChildLocations,
} from "./location-view-helpers";

export default function LocationsPage() {
  const { currentOrganizationId, organizations, isLoading } = useOrganization();

  if (isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!organizations || organizations.length === 0) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-background px-6 py-8">
        <div className="flex flex-col items-center gap-4 rounded-xl border border-border bg-card p-8">
          <Building2 className="h-12 w-12 text-muted-foreground" />
          <div className="text-center">
            <h3 className="text-lg font-semibold text-foreground">
              No Organization
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Create an organization to manage locations
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!currentOrganizationId) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-background px-6 py-8">
        <div className="flex flex-col items-center gap-4 rounded-xl border border-border bg-card p-8">
          <MapPin className="h-12 w-12 text-muted-foreground" />
          <div className="text-center">
            <h3 className="text-lg font-semibold text-foreground">
              Select Organization
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Choose an organization to view locations
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 w-full bg-background">
      <LocationLayout
        key={currentOrganizationId}
        organizationId={currentOrganizationId}
      />
    </div>
  );
}

function LocationLayout({
  organizationId,
}: {
  organizationId: Id<"organizations">;
}) {
  const router = useRouter();
  const [selectedLocationId, setSelectedLocationId] =
    useState<Id<"locations"> | null>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const allLocations = useQuery(api.locations.listAll, {
    organizationId,
  });

  const { exhibitionLocations, storageLocations } = getVisibleSidebarLocations(
    allLocations ?? [],
  );
  const firstVisibleLocationId = getDefaultLocationId(allLocations ?? []);
  const allLocationIdList = (allLocations ?? []).map(
    (location) => location._id,
  );
  const allLocationIds = new Set(allLocationIdList);
  const allLocationIdsKey = allLocationIdList.join(":");

  const canQuerySelectedLocation =
    !!selectedLocationId &&
    (!allLocations || allLocationIds.has(selectedLocationId));

  const selectedLocation = useQuery(
    api.locations.get,
    canQuerySelectedLocation && selectedLocationId
      ? { locationId: selectedLocationId }
      : "skip",
  );

  const environmentalData = useQuery(
    api.locations.getEnvironmentalReadings,
    canQuerySelectedLocation && selectedLocationId
      ? { locationId: selectedLocationId }
      : "skip",
  );

  const selectedLocationType =
    selectedLocation?.type ??
    allLocations?.find((location) => location._id === selectedLocationId)?.type;
  const shouldAutoDisplayDescendants =
    !!selectedLocationType &&
    shouldAutoDisplayChildLocations(selectedLocationType);
  const includesDescendants = selectedLocationType
    ? isStorageLocation(selectedLocationType) || shouldAutoDisplayDescendants
    : false;

  const objectsAtLocation = useQuery(
    api.locations.getObjectsAtLocation,
    canQuerySelectedLocation && selectedLocationId
      ? {
          locationId: selectedLocationId,
          ...(includesDescendants ? { includeDescendants: true } : {}),
        }
      : "skip",
  );

  const occupancy = useQuery(
    api.locations.getOccupancy,
    canQuerySelectedLocation && selectedLocationId
      ? { locationId: selectedLocationId }
      : "skip",
  );

  useEffect(() => {
    if (!allLocations) {
      return;
    }

    if (!firstVisibleLocationId) {
      return;
    }

    if (
      !selectedLocationId ||
      !allLocationIds.has(selectedLocationId) ||
      selectedLocation === null
    ) {
      setSelectedLocationId(firstVisibleLocationId);
    }
  }, [
    allLocations,
    firstVisibleLocationId,
    selectedLocation,
    selectedLocationId,
    allLocationIdsKey,
  ]);

  const isStorageView =
    !!selectedLocationType && isStorageLocation(selectedLocationType);

  const childLocations =
    allLocations?.filter(
      (loc) => loc.parentLocationId === selectedLocationId,
    ) ?? [];
  const descendantLocations =
    selectedLocationId && allLocations
      ? getDescendantLocations(allLocations, selectedLocationId)
      : [];
  const automaticDisplayUnitCounts =
    selectedLocationId && shouldAutoDisplayDescendants
      ? getAutomaticDisplayUnitCounts(allLocations ?? [], selectedLocationId)
      : null;
  const selectedLocationPath =
    selectedLocationId && allLocations
      ? buildLocationPath(allLocations, selectedLocationId)
      : [];
  const displayUnitLocations = getDisplayUnitLocations(
    descendantLocations,
    allLocations ?? [],
  );

  return (
    <div className="flex h-full min-h-0 w-full">
      <LocationSidebar
        allLocations={allLocations ?? []}
        exhibitionLocations={exhibitionLocations}
        storageLocations={storageLocations}
        selectedLocationId={selectedLocationId}
        onSelectLocation={setSelectedLocationId}
      />

      <AddChildLocationDialog
        parentLocationId={selectedLocation?._id}
        parentLocationName={selectedLocation?.name}
        parentLocationType={selectedLocation?.type}
        parentLocationAddress={selectedLocation?.address}
        organizationId={organizationId}
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
      />
      <EditLocationDialog
        locationId={selectedLocationId ?? ""}
        open={editDialogOpen && !!selectedLocationId}
        onOpenChange={setEditDialogOpen}
      />
      <DeleteLocationDialog
        locationId={selectedLocationId ?? ""}
        locationName={selectedLocation?.name ?? ""}
        open={deleteDialogOpen && !!selectedLocationId && !!selectedLocation}
        onOpenChange={setDeleteDialogOpen}
        onDeleted={({ sentToDeaccessions }) => {
          setDeleteDialogOpen(false);
          if (sentToDeaccessions) {
            router.push("/deaccessions");
          } else {
            setSelectedLocationId(null);
          }
        }}
      />

      <div className="min-h-0 flex-1 overflow-y-auto bg-gradient-to-br from-zinc-950 to-zinc-900/50 px-6 pb-6 pt-0 custom-scrollbar">
        {allLocations === undefined && !selectedLocationId && (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-muted-foreground">
              Loading locations...
            </p>
          </div>
        )}

        {allLocations && allLocations.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-4">
            <MapPin className="h-12 w-12 text-muted-foreground" />
            <div className="text-center">
              <p className="text-muted-foreground">No locations yet</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Add your first location to start organizing objects
              </p>
            </div>
            <PermissionGate permission="locations.create">
              <Button variant="outline" onClick={() => setAddDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add Location
              </Button>
            </PermissionGate>
          </div>
        )}

        {allLocations && allLocations.length > 0 && !selectedLocationId && (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-muted-foreground">Loading location...</p>
          </div>
        )}

        {selectedLocationId && selectedLocation && (
          <>
            <header className="-mx-6 sticky top-0 z-20 mb-8 flex h-14 items-center justify-between border-b border-border/60 bg-background/80 px-6 backdrop-blur-xl">
              <div className="flex min-w-0 items-center gap-2 text-xs">
                <span className="shrink-0 text-muted-foreground">
                  Locations
                </span>
                {selectedLocationPath.map((pathLocation) => (
                  <div
                    key={pathLocation._id}
                    className="flex min-w-0 items-center gap-2"
                  >
                    <span className="shrink-0 text-muted-foreground/50">/</span>
                    <span
                      className={
                        pathLocation._id === selectedLocation._id
                          ? "truncate font-medium text-foreground"
                          : "truncate text-muted-foreground"
                      }
                    >
                      {pathLocation.name}
                    </span>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-3">
                <PermissionGate permission="locations.delete">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => setDeleteDialogOpen(true)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </PermissionGate>
                <div className="h-4 w-px bg-border" />
                <PermissionGate permission="locations.create">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setAddDialogOpen(true)}
                  >
                    <Plus className="mr-2 h-3.5 w-3.5" />
                    Add Location
                  </Button>
                </PermissionGate>
                <PermissionGate permission="locations.update">
                  <Button size="sm" onClick={() => setEditDialogOpen(true)}>
                    <Pencil className="mr-2 h-3.5 w-3.5" />
                    Edit Location
                  </Button>
                </PermissionGate>
              </div>
            </header>

            <LocationHeader
              location={selectedLocation}
              environmentalData={environmentalData ?? null}
              totalObjects={occupancy?.objectCount ?? 0}
              capacity={occupancy?.capacity ?? 0}
            />

            {!isStorageView && (
              <GalleryView
                objects={
                  objectsAtLocation?.map((obj) => ({
                    _id: obj._id,
                    title: obj.title,
                    accessionNumber: obj.accessionNumber,
                    status: obj.status,
                    currentLocationId: obj.currentLocationId,
                    thumbnailUrl: obj.thumbnailUrl,
                  })) ?? []
                }
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
                units={(includesDescendants
                  ? descendantLocations
                  : childLocations
                ).map((loc) => ({
                  _id: loc._id,
                  name: loc.name,
                  locationCode: loc.locationCode,
                  type: loc.type,
                  isActive: loc.isActive,
                }))}
                objects={
                  objectsAtLocation?.map((object) => ({
                    _id: object._id,
                    currentLocationId: object.currentLocationId,
                    accessionNumber: object.accessionNumber,
                    title: object.title,
                    status: object.status,
                    thumbnailUrl: object.thumbnailUrl,
                  })) ?? []
                }
                includesDescendants={includesDescendants}
              />
            )}
          </>
        )}

        {allLocations &&
          allLocations.length > 0 &&
          selectedLocationId &&
          !selectedLocation && (
            <div className="flex h-full items-center justify-center">
              <p className="text-sm text-muted-foreground">
                Loading location details...
              </p>
            </div>
          )}
      </div>
    </div>
  );
}

function buildLocationPath(
  locations: Array<{
    _id: Id<"locations">;
    name: string;
    parentLocationId?: Id<"locations">;
  }>,
  locationId: Id<"locations">,
) {
  const locationsById = new Map(
    locations.map((location) => [location._id, location]),
  );
  const path: Array<{ _id: string; name: string }> = [];
  const visitedLocationIds = new Set<Id<"locations">>();
  let currentLocation = locationsById.get(locationId);

  while (currentLocation && !visitedLocationIds.has(currentLocation._id)) {
    path.unshift({
      _id: currentLocation._id,
      name: currentLocation.name,
    });
    visitedLocationIds.add(currentLocation._id);
    currentLocation = currentLocation.parentLocationId
      ? locationsById.get(currentLocation.parentLocationId)
      : undefined;
  }

  return path;
}

function getDisplayUnitLocations(
  descendantLocations: Array<{
    _id: Id<"locations">;
    name: string;
    locationCode: string;
    type: string;
    isActive: boolean;
  }>,
  allLocations: Array<{
    _id: Id<"locations">;
    name: string;
    locationCode: string;
    type: string;
    isActive: boolean;
    parentLocationId?: Id<"locations">;
  }>,
) {
  const toDisplayUnitLocation = (
    location: (typeof descendantLocations)[number],
  ) => ({
    _id: location._id,
    name: location.name,
    locationCode: location.locationCode,
    type: location.type,
    isActive: location.isActive,
    descendantLocationIds: getDescendantLocations(
      allLocations,
      location._id,
    ).map((descendantLocation) => descendantLocation._id),
  });

  return {
    vitrines: descendantLocations
      .filter((location) => isVitrineLocation(location.type))
      .map(toDisplayUnitLocation),
    walls: descendantLocations
      .filter((location) => isWallLocation(location.type))
      .map(toDisplayUnitLocation),
    cabinets: descendantLocations
      .filter((location) => isCabinetLocation(location.type))
      .map(toDisplayUnitLocation),
    shelves: descendantLocations
      .filter((location) => isShelfLocation(location.type))
      .map(toDisplayUnitLocation),
  };
}

function isVitrineLocation(type: string) {
  const normalizedType = type.toLowerCase();
  return (
    normalizedType.includes("vitrine") ||
    normalizedType.includes("display case") ||
    normalizedType.includes("displaycase")
  );
}

function isWallLocation(type: string) {
  return type.toLowerCase().includes("wall");
}

function isCabinetLocation(type: string) {
  return type.toLowerCase().includes("cabinet");
}

function isShelfLocation(type: string) {
  return type.toLowerCase().includes("shelf");
}
