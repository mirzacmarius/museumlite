"use client";

import { useOrganization } from "@/components/organization-provider";
import { PermissionGate } from "@/components/permission-gate";
import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { ScrollArea } from "@v1/ui/scroll-area";
import { useQuery } from "convex/react";
import {
  Building2,
  ChevronRight,
  Droplets,
  Lock,
  MapPin,
  Package,
  Plus,
  Thermometer,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { AddChildLocationDialog } from "./_components/add-child-location-dialog";

export default function LocationsPage() {
  const { currentOrganizationId, organizations, isLoading } = useOrganization();

  if (isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <p className="text-zinc-500">Loading...</p>
      </div>
    );
  }

  if (!organizations || organizations.length === 0) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-zinc-950 px-6 py-8">
        <div className="flex flex-col items-center gap-4 rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-8">
          <Building2 className="h-12 w-12 text-zinc-500" />
          <div className="text-center">
            <h3 className="text-lg font-semibold text-zinc-200">
              No Organization Found
            </h3>
            <p className="mt-2 text-sm text-zinc-500">
              You need to create an organization to start managing locations.
            </p>
          </div>
          <Button asChild>
            <Link href="/organizations/new">
              <Plus className="mr-2 h-4 w-4" />
              Create Organization
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  if (!currentOrganizationId) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-zinc-950 px-6 py-8">
        <div className="flex flex-col items-center gap-4 rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-8">
          <MapPin className="h-12 w-12 text-zinc-500" />
          <div className="text-center">
            <h3 className="text-lg font-semibold text-zinc-200">
              Select an Organization
            </h3>
            <p className="mt-2 text-sm text-zinc-500">
              Please select an organization from the dropdown above to view
              locations.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full bg-zinc-950">
      <LocationLayout organizationId={currentOrganizationId} />
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

  const allLocations = useQuery(api.locations.listAll, {
    organizationId,
  });

  const selectedLocation = useQuery(
    api.locations.get,
    selectedLocationId ? { locationId: selectedLocationId } : "skip",
  );

  const objectsAtLocation = useQuery(
    api.locations.getObjectsAtLocation,
    selectedLocationId ? { locationId: selectedLocationId } : "skip",
  );

  const exhibitionTypes = ["gallery", "exhibition", "hall", "wing", "room"];
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

  const otherLocations =
    allLocations?.filter(
      (loc) =>
        !exhibitionTypes.some((t) => loc.type.toLowerCase().includes(t)) &&
        !storageTypes.some((t) => loc.type.toLowerCase().includes(t)) &&
        !loc.parentLocationId,
    ) ?? [];

  const getChildLocations = (parentId: Id<"locations">) => {
    return (
      allLocations?.filter((loc) => loc.parentLocationId === parentId) ?? []
    );
  };

  return (
    <div className="flex h-full w-full">
      <div className="custom-scrollbar w-60 overflow-y-auto border-r border-zinc-800/60 bg-zinc-950 p-4">
        {exhibitionLocations.length > 0 && (
          <>
            <div className="mb-4 text-[10px] font-bold uppercase tracking-widest text-zinc-500">
              Exhibition Spaces
            </div>
            <ul className="mb-6 space-y-1 text-xs">
              {exhibitionLocations.map((loc) => (
                <LocationNavItem
                  key={loc._id}
                  location={loc}
                  isSelected={selectedLocationId === loc._id}
                  onSelect={() => setSelectedLocationId(loc._id)}
                  childLocations={getChildLocations(loc._id)}
                  selectedLocationId={selectedLocationId}
                  onSelectChild={setSelectedLocationId}
                />
              ))}
            </ul>
          </>
        )}

        {storageLocations.length > 0 && (
          <>
            <div className="mb-4 text-[10px] font-bold uppercase tracking-widest text-zinc-500">
              Secure Storage
            </div>
            <ul className="mb-6 space-y-1 text-xs">
              {storageLocations.map((loc) => (
                <LocationNavItem
                  key={loc._id}
                  location={loc}
                  isSelected={selectedLocationId === loc._id}
                  onSelect={() => setSelectedLocationId(loc._id)}
                  childLocations={getChildLocations(loc._id)}
                  selectedLocationId={selectedLocationId}
                  onSelectChild={setSelectedLocationId}
                  isSecure
                />
              ))}
            </ul>
          </>
        )}

        {otherLocations.length > 0 && (
          <>
            <div className="mb-4 text-[10px] font-bold uppercase tracking-widest text-zinc-500">
              Other Locations
            </div>
            <ul className="space-y-1 text-xs">
              {otherLocations.map((loc) => (
                <LocationNavItem
                  key={loc._id}
                  location={loc}
                  isSelected={selectedLocationId === loc._id}
                  onSelect={() => setSelectedLocationId(loc._id)}
                  childLocations={getChildLocations(loc._id)}
                  selectedLocationId={selectedLocationId}
                  onSelectChild={setSelectedLocationId}
                />
              ))}
            </ul>
          </>
        )}

        {allLocations && allLocations.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <MapPin className="h-8 w-8 text-zinc-600" />
            <p className="text-xs text-zinc-500">No locations yet</p>
          </div>
        )}

        <PermissionGate permission="locations.create">
          <div className="mt-6 border-t border-zinc-800/60 pt-4">
            <Button
              variant="outline"
              size="sm"
              className="w-full border-zinc-800 text-zinc-400 hover:bg-zinc-800 hover:text-white"
              onClick={() => setAddDialogOpen(true)}
            >
              <Plus className="mr-2 h-3 w-3" />
              Add Location
            </Button>
          </div>
        </PermissionGate>
      </div>

      <AddChildLocationDialog
        organizationId={organizationId}
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
      />

      <div className="custom-scrollbar flex-1 overflow-y-auto bg-gradient-to-br from-zinc-950 to-zinc-900/50 p-6">
        {!selectedLocationId && (
          <div className="flex h-full flex-col items-center justify-center gap-4">
            <MapPin className="h-12 w-12 text-zinc-700" />
            <div className="text-center">
              <p className="text-zinc-400">
                Select a location from the sidebar
              </p>
              <p className="mt-1 text-xs text-zinc-600">
                View details and objects at each location
              </p>
            </div>
          </div>
        )}

        {selectedLocationId && selectedLocation && (
          <>
            <div className="mb-8 flex items-end justify-between">
              <div>
                <div className="mb-1 flex items-center gap-2 text-xs text-zinc-500">
                  <span>Locations</span>
                  <ChevronRight className="h-3 w-3" />
                  <span className="capitalize">{selectedLocation.type}</span>
                </div>
                <h2 className="flex items-center gap-3 text-2xl font-bold tracking-tight text-zinc-100">
                  <span>{selectedLocation.name}</span>
                  <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-xs font-normal text-emerald-400">
                    {selectedLocation.isActive ? "Active" : "Inactive"}
                  </span>
                </h2>
              </div>
              <div className="flex gap-4">
                <div className="flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2">
                  <div className="rounded bg-blue-500/10 p-1.5 text-blue-400">
                    <Thermometer className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-[10px] font-bold uppercase text-zinc-500">
                      Temp
                    </div>
                    <div className="font-mono text-sm text-zinc-200">21.5C</div>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2">
                  <div className="rounded bg-cyan-500/10 p-1.5 text-cyan-400">
                    <Droplets className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-[10px] font-bold uppercase text-zinc-500">
                      Humidity
                    </div>
                    <div className="font-mono text-sm text-zinc-200">
                      45% RH
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {selectedLocation.children &&
              selectedLocation.children.length > 0 && (
                <div className="mb-8">
                  <div className="mb-4 flex items-end justify-between">
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-300">
                      Sub-locations
                    </h3>
                    <div className="text-xs text-zinc-500">
                      {selectedLocation.children.length} locations
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                    {selectedLocation.children.map((child) => (
                      <button
                        key={child._id}
                        type="button"
                        onClick={() => setSelectedLocationId(child._id)}
                        className="group rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-4 text-left transition-all hover:border-indigo-500/40 hover:shadow-lg hover:shadow-indigo-500/10"
                      >
                        <div className="mb-2 flex items-center justify-between">
                          <span className="font-mono text-[10px] text-zinc-400">
                            {child.type.toUpperCase()}
                          </span>
                          <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        </div>
                        <p className="font-medium text-zinc-200 transition-colors group-hover:text-indigo-400">
                          {child.name}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

            <div>
              <div className="mb-4 flex items-end justify-between">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-300">
                  Objects at this Location
                </h3>
                <div className="text-xs text-zinc-500">
                  Occupancy:{" "}
                  <span className="text-zinc-300">
                    {objectsAtLocation?.length ?? 0} items
                  </span>
                </div>
              </div>

              {objectsAtLocation && objectsAtLocation.length > 0 ? (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                  {objectsAtLocation.map((obj) => (
                    <Link
                      key={obj._id}
                      href={`/collections/${obj._id}`}
                      className="group relative aspect-[4/5] overflow-hidden rounded-xl border border-white/5 bg-gradient-to-br from-white/5 to-transparent shadow-2xl backdrop-blur-md transition-all hover:border-indigo-500/40 hover:shadow-indigo-500/10"
                    >
                      <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent opacity-30" />
                      <div className="absolute inset-x-0 top-0 flex items-center justify-between border-b border-white/5 bg-black/20 p-3">
                        <span className="font-mono text-[10px] text-zinc-400">
                          {obj.accessionNumber}
                        </span>
                        <div className="flex gap-1">
                          <div
                            className={`h-1.5 w-1.5 rounded-full ${
                              obj.status === "active"
                                ? "bg-emerald-500"
                                : obj.status === "loaned"
                                  ? "bg-amber-500"
                                  : "bg-zinc-500"
                            }`}
                          />
                        </div>
                      </div>
                      <div className="flex h-full flex-col p-4 pt-14">
                        <div className="flex flex-1 items-center justify-center">
                          <div className="relative">
                            <div className="absolute inset-0 bg-amber-500/20 opacity-0 blur-xl transition-opacity group-hover:opacity-50" />
                            <Package className="relative z-10 h-16 w-16 text-zinc-300 drop-shadow-xl" />
                          </div>
                        </div>
                        <div className="mt-auto border-t border-white/5 pt-3">
                          <p className="line-clamp-2 text-sm font-medium text-zinc-200 transition-colors group-hover:text-indigo-400">
                            {obj.title}
                          </p>
                          <p className="mt-1 text-[10px] capitalize text-zinc-500">
                            {obj.status}
                          </p>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="flex h-48 flex-col items-center justify-center rounded-xl border border-dashed border-zinc-800 bg-zinc-900/20">
                  <Package className="h-8 w-8 text-zinc-700" />
                  <p className="mt-2 text-xs text-zinc-500">
                    No objects at this location
                  </p>
                </div>
              )}
            </div>

            {selectedLocation.notes && (
              <div className="mt-8">
                <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-zinc-300">
                  Notes
                </h3>
                <p className="text-sm text-zinc-400">
                  {selectedLocation.notes}
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function LocationNavItem({
  location,
  isSelected,
  onSelect,
  childLocations,
  selectedLocationId,
  onSelectChild,
  isSecure = false,
}: {
  location: {
    _id: Id<"locations">;
    name: string;
    type: string;
    isActive: boolean;
  };
  isSelected: boolean;
  onSelect: () => void;
  childLocations: Array<{
    _id: Id<"locations">;
    name: string;
    type: string;
    isActive: boolean;
  }>;
  selectedLocationId: Id<"locations"> | null;
  onSelectChild: (id: Id<"locations">) => void;
  isSecure?: boolean;
}) {
  const isChildSelected = childLocations.some(
    (child) => child._id === selectedLocationId,
  );

  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        className={`flex w-full cursor-pointer items-center justify-between rounded-r px-3 py-2 transition-all ${
          isSelected
            ? "border-l-2 border-indigo-500 bg-zinc-900 font-medium text-zinc-100 shadow-sm"
            : "border-l-2 border-transparent text-zinc-400 hover:bg-zinc-900/50 hover:text-zinc-200"
        }`}
      >
        <span>{location.name}</span>
        {isSecure ? (
          <Lock className="h-3 w-3 text-zinc-600" />
        ) : (
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              location.isActive ? "bg-emerald-500" : "bg-zinc-700"
            }`}
          />
        )}
      </button>

      {childLocations.length > 0 && (isSelected || isChildSelected) && (
        <ul className="ml-4 mt-1 space-y-1 border-l border-zinc-800">
          {childLocations.map((child) => (
            <li key={child._id}>
              <button
                type="button"
                onClick={() => onSelectChild(child._id)}
                className={`flex w-full cursor-pointer items-center justify-between rounded-r px-3 py-1.5 transition-all ${
                  selectedLocationId === child._id
                    ? "border-l-2 border-indigo-400 bg-zinc-900/50 text-zinc-100"
                    : "border-l-2 border-transparent text-zinc-500 hover:bg-zinc-900/30 hover:text-zinc-300"
                }`}
              >
                <span className="text-[11px]">{child.name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}
