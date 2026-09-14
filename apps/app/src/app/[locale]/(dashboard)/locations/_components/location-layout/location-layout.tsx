"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { useQuery } from "convex/react";
import { MapPin, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PermissionGate } from "@/components/permission-gate";
import { LocationContentSkeleton } from "../../location-page-skeleton";
import {
  getAutomaticDisplayUnitCounts,
  getDefaultLocationId,
  getDescendantLocations,
  getVisibleSidebarLocations,
  isStorageLocation,
  shouldAutoDisplayChildLocations,
} from "../../location-view-helpers";
import { AddChildLocationDialog } from "../add-child-location-dialog/add-child-location-dialog";
import { DeleteLocationDialog } from "../delete-location-dialog";
import { EditLocationDialog } from "../edit-location-dialog/edit-location-dialog";
import { LocationSidebar } from "../location-sidebar";
import { LocationLayoutContent } from "./location-layout-content";
import { LocationLayoutHeader } from "./location-layout-header";
import {
  buildLocationPath,
  getDisplayUnitLocations,
} from "./location-layout-helpers";

interface LocationLayoutProps {
  organizationId: Id<"organizations">;
}

export function LocationLayout({ organizationId }: LocationLayoutProps) {
  const { push } = useRouter();
  const [selectedLocationId, setSelectedLocationId] =
    useState<Id<"locations"> | null>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const allLocations = useQuery(api.locations.listAll, { organizationId });

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
    if (!allLocations || !firstVisibleLocationId) {
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
            push("/deaccessions");
          } else {
            setSelectedLocationId(null);
          }
        }}
      />

      <div className="min-h-0 flex-1 overflow-y-auto bg-background px-6 pb-6 pt-0 custom-scrollbar">
        {allLocations === undefined && !selectedLocationId && (
          <LocationContentSkeleton />
        )}

        {allLocations && allLocations.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-4">
            <MapPin className="size-12 text-muted-foreground" />
            <div className="text-center">
              <p className="text-muted-foreground">No locations yet</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Add your first location to start organizing objects
              </p>
            </div>
            <PermissionGate permission="locations.create">
              <Button variant="outline" onClick={() => setAddDialogOpen(true)}>
                <Plus className="mr-2 size-4" />
                Add Location
              </Button>
            </PermissionGate>
          </div>
        )}

        {allLocations && allLocations.length > 0 && !selectedLocationId && (
          <LocationContentSkeleton />
        )}

        {selectedLocationId && selectedLocation && (
          <>
            <LocationLayoutHeader
              selectedLocationPath={selectedLocationPath}
              selectedLocationId={selectedLocation._id}
              onDelete={() => setDeleteDialogOpen(true)}
              onAdd={() => setAddDialogOpen(true)}
              onEdit={() => setEditDialogOpen(true)}
            />

            <LocationLayoutContent
              selectedLocation={selectedLocation}
              environmentalData={environmentalData ?? null}
              occupancy={occupancy ?? undefined}
              isStorageView={isStorageView}
              includesDescendants={includesDescendants}
              objectsAtLocation={objectsAtLocation ?? undefined}
              childLocations={childLocations}
              descendantLocations={descendantLocations}
              automaticDisplayUnitCounts={automaticDisplayUnitCounts}
              displayUnitLocations={displayUnitLocations}
            />
          </>
        )}

        {allLocations &&
          allLocations.length > 0 &&
          selectedLocationId &&
          !selectedLocation && <LocationContentSkeleton />}
      </div>
    </div>
  );
}
