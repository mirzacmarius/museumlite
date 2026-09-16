"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { useQuery } from "convex/react";
import { MapPin, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { IconActionButton } from "@/components/icon-action-button";
import { PermissionGate } from "@/components/permission-gate";
import { LocationContentSkeleton } from "../../location-page-skeleton";
import {
  getDefaultLocationId,
  getVisibleSidebarLocations,
} from "../../location-view-helpers";
import { AddChildLocationDialog } from "../add-child-location-dialog/add-child-location-dialog";
import { DeleteLocationDialog } from "../delete-location-dialog";
import { EditLocationDialog } from "../edit-location-dialog/edit-location-dialog";
import { LocationSidebar } from "../location-sidebar";
import { LocationActions } from "./location-actions";
import { LocationLayoutContent } from "./location-layout-content";

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

  const objectsAtLocation = useQuery(
    api.locations.getObjectsAtLocation,
    canQuerySelectedLocation && selectedLocationId
      ? {
          locationId: selectedLocationId,
          includeDescendants: true,
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

  return (
    <div className="flex h-full min-h-0 w-full flex-col md:flex-row">
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

      <div className="custom-scrollbar min-h-0 min-w-0 flex-1 overflow-y-auto bg-background px-4 pb-6 pt-5 dark:bg-zinc-950 md:px-6">
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
              <IconActionButton
                label="Add"
                onClick={() => setAddDialogOpen(true)}
              >
                <Plus className="size-4" aria-hidden="true" />
              </IconActionButton>
            </PermissionGate>
          </div>
        )}

        {allLocations && allLocations.length > 0 && !selectedLocationId && (
          <LocationContentSkeleton />
        )}

        {selectedLocationId && selectedLocation && (
          <LocationLayoutContent
            actions={
              <LocationActions
                onDelete={() => setDeleteDialogOpen(true)}
                onAdd={() => setAddDialogOpen(true)}
                onEdit={() => setEditDialogOpen(true)}
              />
            }
            selectedLocation={selectedLocation}
            environmentalData={environmentalData ?? null}
            occupancy={occupancy ?? undefined}
            locations={allLocations ?? []}
            objectsAtLocation={objectsAtLocation ?? undefined}
          />
        )}

        {allLocations &&
          allLocations.length > 0 &&
          selectedLocationId &&
          !selectedLocation && <LocationContentSkeleton />}
      </div>
    </div>
  );
}
