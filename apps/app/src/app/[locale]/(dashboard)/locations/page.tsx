"use client";

import { useOrganization } from "@/components/organization-provider";
import { PermissionGate } from "@/components/permission-gate";
import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { useQuery } from "convex/react";
import { Building2, MapPin, Pencil, Plus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { AddChildLocationDialog } from "./_components/add-child-location-dialog";
import { EditLocationDialog } from "./_components/edit-location-dialog";
import { GalleryView } from "./_components/gallery-view";
import { LocationHeader } from "./_components/location-header";
import { LocationSidebar } from "./_components/location-sidebar";
import { StorageView } from "./_components/storage-view";

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
    <div className="flex h-full w-full bg-background">
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
  const [selectedLocationId, setSelectedLocationId] =
    useState<Id<"locations"> | null>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  const allLocations = useQuery(api.locations.listAll, {
    organizationId,
  });

  const selectedLocation = useQuery(
    api.locations.get,
    selectedLocationId ? { locationId: selectedLocationId } : "skip",
  );

  const environmentalData = useQuery(
    api.locations.getEnvironmentalReadings,
    selectedLocationId ? { locationId: selectedLocationId } : "skip",
  );

  const objectsAtLocation = useQuery(
    api.locations.getObjectsAtLocation,
    selectedLocationId ? { locationId: selectedLocationId } : "skip",
  );

  const occupancy = useQuery(
    api.locations.getOccupancy,
    selectedLocationId ? { locationId: selectedLocationId } : "skip",
  );

  const exhibitionTypes = [
    "gallery",
    "exhibition",
    "hall",
    "wing",
    "room",
    "building",
    "floor",
  ];
  const storageTypes = ["vault", "storage", "cabinet", "shelf", "archive"];

  const exhibitionLocations =
    allLocations?.filter(
      (loc) =>
        exhibitionTypes.some((t) => loc.type.toLowerCase().includes(t)) &&
        !loc.parentLocationId,
    ) ?? [];

  const storageLocations =
    allLocations?.filter(
      (loc) =>
        storageTypes.some((t) => loc.type.toLowerCase().includes(t)) &&
        !loc.parentLocationId,
    ) ?? [];

  const isStorageView =
    selectedLocation &&
    storageTypes.some((t) => selectedLocation.type.toLowerCase().includes(t));

  const childLocations =
    allLocations?.filter(
      (loc) => loc.parentLocationId === selectedLocationId,
    ) ?? [];

  return (
    <div className="flex h-full w-full">
      <LocationSidebar
        exhibitionLocations={exhibitionLocations}
        storageLocations={storageLocations}
        selectedLocationId={selectedLocationId}
        onSelectLocation={setSelectedLocationId}
      />

      <AddChildLocationDialog
        organizationId={organizationId}
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
      />
      <EditLocationDialog
        locationId={selectedLocationId ?? ""}
        open={editDialogOpen && !!selectedLocationId}
        onOpenChange={setEditDialogOpen}
      />

      <div className="flex-1 p-6 overflow-y-auto custom-scrollbar bg-gradient-to-br from-zinc-950 to-zinc-900/50">
        {!selectedLocationId && (
          <div className="flex h-full flex-col items-center justify-center gap-4">
            <MapPin className="h-12 w-12 text-muted-foreground" />
            <div className="text-center">
              {allLocations && allLocations.length === 0 ? (
                <>
                  <p className="text-muted-foreground">No locations yet</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Add your first location to start organizing objects
                  </p>
                </>
              ) : (
                <>
                  <p className="text-muted-foreground">
                    Select a location from the sidebar
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    View details, environmental data, and objects
                  </p>
                </>
              )}
            </div>
            <PermissionGate permission="locations.create">
              <Button variant="outline" onClick={() => setAddDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add Location
              </Button>
            </PermissionGate>
          </div>
        )}

        {selectedLocationId && selectedLocation && (
          <>
            <LocationHeader
              location={selectedLocation}
              environmentalData={environmentalData ?? null}
            />
            <div className="mb-6 flex gap-2">
              <PermissionGate permission="locations.update">
                <Button
                  variant="outline"
                  onClick={() => setEditDialogOpen(true)}
                >
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit Location
                </Button>
              </PermissionGate>
              <PermissionGate permission="locations.create">
                <Button
                  variant="outline"
                  onClick={() => setAddDialogOpen(true)}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Location
                </Button>
              </PermissionGate>
            </div>

            {!isStorageView && (
              <GalleryView
                objects={
                  objectsAtLocation?.map((obj) => ({
                    _id: obj._id,
                    title: obj.title,
                    accessionNumber: obj.accessionNumber,
                  })) ?? []
                }
              />
            )}

            {isStorageView && (
              <StorageView
                units={childLocations.map((loc) => ({
                  _id: loc._id,
                  name: loc.name,
                  type: loc.type,
                  isActive: loc.isActive,
                }))}
                totalObjects={occupancy?.objectCount ?? 0}
                capacity={occupancy?.capacity ?? 0}
                lastAuditDate={undefined}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
