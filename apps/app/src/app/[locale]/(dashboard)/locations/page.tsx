"use client";

import { useOrganization } from "@/components/organization-provider";
import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { useQuery } from "convex/react";
import { Building2, MapPin } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { GalleryViewNew } from "./_components/gallery-view-new";
import { LocationHeaderNew } from "./_components/location-header-new";
import { LocationSidebarNew } from "./_components/location-sidebar-new";
import { StorageViewNew } from "./_components/storage-view-new";

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
      <LocationSidebarNew
        exhibitionLocations={exhibitionLocations}
        storageLocations={storageLocations}
        selectedLocationId={selectedLocationId}
        onSelectLocation={setSelectedLocationId}
      />

      <div className="flex-1 p-6 overflow-y-auto custom-scrollbar bg-gradient-to-br from-zinc-950 to-zinc-900/50">
        {!selectedLocationId && (
          <div className="flex h-full flex-col items-center justify-center gap-4">
            <MapPin className="h-12 w-12 text-muted-foreground" />
            <div className="text-center">
              <p className="text-muted-foreground">
                Select a location from the sidebar
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                View details, environmental data, and objects
              </p>
            </div>
          </div>
        )}

        {selectedLocationId && selectedLocation && (
          <>
            <LocationHeaderNew
              location={selectedLocation}
              environmentalData={environmentalData ?? null}
            />

            {!isStorageView && (
              <GalleryViewNew
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
              <StorageViewNew
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
