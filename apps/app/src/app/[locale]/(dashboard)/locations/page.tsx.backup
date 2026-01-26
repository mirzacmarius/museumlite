"use client";

import { convertToCSV } from "@/components/export-csv-button";
import { LocationSidebar } from "@/components/locations/location-sidebar";
import { LocationStats } from "@/components/locations/location-stats";
import { OccupancyDisplay } from "@/components/locations/occupancy-display";
import { SecureDrawers } from "@/components/locations/secure-drawers";
import { StorageUnitsTable } from "@/components/locations/storage-units-table";
import { VitrinesGrid } from "@/components/locations/vitrines-grid";
import { WallDisplay } from "@/components/locations/wall-display";
import { useOrganization } from "@/components/organization-provider";
import { PermissionGate } from "@/components/permission-gate";
import { useScopedI18n } from "@/locales/client";
import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { useMutation, useQuery } from "convex/react";
import {
  Building2,
  ChevronRight,
  Download,
  FileUp,
  MapPin,
  Package,
  Plus,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useState } from "react";
import { AddChildLocationDialog } from "./_components/add-child-location-dialog";

function ExportLocationsButton({
  onExport,
}: {
  onExport: () => Promise<Array<Record<string, unknown>> | undefined>;
}) {
  const t = useScopedI18n("locations");
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = useCallback(async () => {
    if (isExporting) return;

    setIsExporting(true);

    try {
      const data = await onExport();
      if (!data || data.length === 0) return;

      const csv = convertToCSV(data);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `locations-${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } finally {
      setIsExporting(false);
    }
  }, [isExporting, onExport]);

  return (
    <Button
      variant="outline"
      size="sm"
      className="w-full"
      onClick={handleExport}
      disabled={isExporting}
    >
      <Download className="mr-2 h-3 w-3" />
      {t("exportCSV")}
    </Button>
  );
}

export default function LocationsPage() {
  const t = useScopedI18n("locations");
  const { currentOrganizationId, organizations, isLoading } = useOrganization();

  if (isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <p className="text-muted-foreground">{t("loading")}</p>
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
              {t("noOrganizationTitle")}
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {t("noOrganizationDescription")}
            </p>
          </div>
          <Button asChild>
            <Link href="/organizations/new">
              <Plus className="mr-2 h-4 w-4" />
              {t("createOrganization")}
            </Link>
          </Button>
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
              {t("selectOrganizationTitle")}
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {t("selectOrganizationDescription")}
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
  const t = useScopedI18n("locations");
  const [selectedLocationId, setSelectedLocationId] =
    useState<Id<"locations"> | null>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);

  const allLocations = useQuery(api.locations.listAll, {
    organizationId,
  });

  const exportLocations = useMutation(api.imports.exportLocations);

  const handleExport = useCallback(async () => {
    return exportLocations({ organizationId });
  }, [exportLocations, organizationId]);

  const selectedLocation = useQuery(
    api.locations.get,
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

  const environmentalData = useQuery(
    api.locations.getEnvironmentalReadings,
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

  const vitrinesFromObjects =
    objectsAtLocation?.slice(0, 4).map((obj, i) => ({
      id: `vit-${String(i + 1).padStart(2, "0")}`,
      name: obj.title.slice(0, 20) + (obj.title.length > 20 ? "..." : ""),
      type: "artifact" as const,
      status: "active" as const,
    })) ?? [];

  const wallSlotsFromObjects =
    objectsAtLocation?.slice(4, 10).map((obj, i) => ({
      id: `w${i + 1}`,
      occupied: true,
      itemType: "sculpture" as const,
    })) ?? [];

  const wallSlots = [
    ...wallSlotsFromObjects,
    ...Array.from({ length: Math.max(0, 6 - wallSlotsFromObjects.length) }).map(
      (_, i) => ({
        id: `w${wallSlotsFromObjects.length + i + 1}`,
        occupied: false,
        itemType: undefined,
      }),
    ),
  ];

  const drawersFromObjects =
    objectsAtLocation?.slice(10, 14).map((obj, i) => ({
      id: `drw-a${i + 1}`,
      name: `Drawer A${i + 1}`,
      status: "active" as const,
      contents: obj.title.slice(0, 15),
    })) ?? [];

  const drawers = [
    ...drawersFromObjects,
    ...Array.from({ length: Math.max(0, 4 - drawersFromObjects.length) }).map(
      (_, i) => ({
        id: `drw-a${drawersFromObjects.length + i + 1}`,
        name: `Drawer A${drawersFromObjects.length + i + 1}`,
        status: "empty" as const,
        contents: undefined,
      }),
    ),
  ];

  const storageUnitsData =
    selectedLocation?.children?.map((child) => ({
      id: child.name,
      classification: child.type,
      occupancy: "—",
      status: child.isActive ? ("accessible" as const) : ("locked" as const),
    })) ?? [];

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

      <div className="flex-1 p-6 overflow-y-auto custom-scrollbar bg-gradient-to-br from-background to-card/70">
        {!selectedLocationId && (
          <div className="flex h-full flex-col items-center justify-center gap-4">
            <MapPin className="h-12 w-12 text-muted-foreground" />
            <div className="text-center">
              <p className="text-muted-foreground">
                {t("selectLocationFromSidebar")}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {t("viewDetailsAndObjects")}
              </p>
            </div>
          </div>
        )}

        {selectedLocationId && selectedLocation && (
          <>
            {/* Header */}
            <div className="flex items-end justify-between mb-8">
              <div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                  <span>{t("locations")}</span>
                  <ChevronRight className="w-3 h-3" />
                  <span className="capitalize">{selectedLocation.type}</span>
                </div>
                <h2 className="text-2xl font-bold text-foreground tracking-tight flex items-center gap-3">
                  <span>{selectedLocation.name}</span>
                  <span className="text-xs font-normal px-2 py-0.5 rounded-full border text-blue-400 bg-blue-500/10 border-blue-500/20">
                    {selectedLocation.isActive ? t("active") : t("inactive")}
                  </span>
                </h2>
              </div>
              <div className="flex flex-col gap-2">
              <div className="flex gap-4">
                {occupancy && (
                  <OccupancyDisplay
                    objectCount={occupancy.objectCount}
                    capacity={occupancy.capacity}
                    occupancyPercent={occupancy.occupancyPercent}
                    isOverCapacity={occupancy.isOverCapacity}
                  />
                )}
                <LocationStats
                  temperature={environmentalData?.temperature}
                  humidity={environmentalData?.humidity}
                  status={t("active")}
                />
                </div>
              </div>
            </div>

            {!isStorageView && (
              <>
                <VitrinesGrid
                  title={t("freestandingVitrines")}
                  subtitle={t("galleryDisplay")}
                  occupancy={`${vitrinesFromObjects.length}/4 ${t("slots")}`}
                  items={vitrinesFromObjects}
                />

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-8">
                  <WallDisplay
                    title={t("wallMountedDisplay")}
                    location={t("northWall")}
                    securityStatus={t("locked")}
                    slots={wallSlots}
                  />
                  <SecureDrawers title={t("secureDrawers")} drawers={drawers} />
                </div>
              </>
            )}

            {isStorageView && (
              <div className="mt-8">
                <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide mb-4">
                  {t("storageUnits")}
                </h3>
                <StorageUnitsTable units={storageUnitsData} />
              </div>
            )}

            {/* Objects at Location */}
            <div className="mt-8">
              <div className="flex items-end justify-between mb-4">
                <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">
                  {t("objectsAtThisLocation")}
                </h3>
                <div className="text-xs text-muted-foreground">
                  {t("total")}:{" "}
                  <span className="text-foreground">
                    {objectsAtLocation?.length ?? 0} {t("items")}
                  </span>
                </div>
              </div>

              {objectsAtLocation && objectsAtLocation.length > 0 ? (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                  {objectsAtLocation.slice(0, 8).map((obj) => (
                    <Link
                      key={obj._id}
                      href={`/collections/${obj._id}`}
                      className="group relative aspect-[4/5] overflow-hidden rounded-xl border border-white/5 bg-gradient-to-br from-white/5 to-transparent shadow-2xl backdrop-blur-md transition-all hover:border-indigo-500/40 hover:shadow-indigo-500/10"
                    >
                      <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent opacity-30" />
                      <div className="absolute inset-x-0 top-0 flex items-center justify-between border-b border-white/5 bg-black/20 p-3">
                        <span className="font-mono text-[10px] text-muted-foreground">
                          {obj.accessionNumber}
                        </span>
                        <div className="flex gap-1">
                          <div
                            className={`h-1.5 w-1.5 rounded-full ${
                              obj.status === "active"
                                ? "bg-emerald-500"
                                : obj.status === "loaned"
                                  ? "bg-amber-500"
                                  : "bg-slate-500"
                            }`}
                          />
                        </div>
                      </div>
                      <div className="flex h-full flex-col p-4 pt-14">
                        <div className="flex flex-1 items-center justify-center">
                          <div className="relative">
                            <div className="absolute inset-0 bg-amber-500/20 opacity-0 blur-xl transition-opacity group-hover:opacity-50" />
                            <Package className="relative z-10 h-16 w-16 text-foreground/80 drop-shadow-xl" />
                          </div>
                        </div>
                        <div className="mt-auto border-t border-white/5 pt-3">
                          <p className="line-clamp-2 text-sm font-medium text-foreground transition-colors group-hover:text-indigo-400">
                            {obj.title}
                          </p>
                          <p className="mt-1 text-[10px] capitalize text-muted-foreground">
                            {obj.status}
                          </p>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="flex h-48 flex-col items-center justify-center rounded-xl border border-dashed border-border/60 bg-card/20">
                  <Package className="h-8 w-8 text-muted-foreground" />
                  <p className="mt-2 text-xs text-muted-foreground">
                    {t("noObjectsAtLocation")}
                  </p>
                </div>
              )}
            </div>

            {/* Notes */}
            {selectedLocation.notes && (
              <div className="mt-8 p-4 bg-card/30 border border-border/60 rounded-lg">
                <h3 className="text-sm font-semibold text-foreground/80 uppercase tracking-wide mb-2">
                  {t("notes")}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {selectedLocation.notes}
                </p>
              </div>
            )}
          </>
        )}

        {/* Location Actions */}
        <div className="mt-6 border-t border-border/60 pt-4 space-y-2">
          <PermissionGate permission="locations.read">
            <ExportLocationsButton onExport={handleExport} />
          </PermissionGate>
          <PermissionGate permission="locations.create">
            <Button variant="outline" size="sm" className="w-full" asChild>
              <Link href="/locations/import">
                <FileUp className="mr-2 h-3 w-3" />
                {t("importCSV")}
              </Link>
            </Button>
          </PermissionGate>
          <PermissionGate permission="locations.create">
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => setAddDialogOpen(true)}
            >
              <Plus className="mr-2 h-3 w-3" />
              {t("addLocation")}
            </Button>
          </PermissionGate>
        </div>
      </div>
    </div>
  );
}
