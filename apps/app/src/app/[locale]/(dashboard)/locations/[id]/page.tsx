"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Skeleton } from "@v1/ui/skeleton";
import { useQuery } from "convex/react";
import { ChevronRight, Clock } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Suspense, useState } from "react";
import { useOrganization } from "@/components/organization-provider";
import { useScopedI18n } from "@/locales/client";
import { AddChildLocationDialog } from "../_components/add-child-location-dialog/add-child-location-dialog";
import { DeleteLocationDialog } from "../_components/delete-location-dialog";
import { EditLocationDialog } from "../_components/edit-location-dialog/edit-location-dialog";
import { LocationActions } from "../_components/location-layout/location-actions";
import { LocationLayoutContent } from "../_components/location-layout/location-layout-content";
import { buildLocationPath } from "../_components/location-layout/location-layout-helpers";
import { LocationSidebar } from "../_components/location-sidebar";
import { LocationContentSkeleton } from "../location-page-skeleton";
import { getVisibleSidebarLocations } from "../location-view-helpers";
import { LocationTimeline } from "./_components/location-timeline";

export default function LocationDetailPage() {
  return (
    <Suspense fallback={<LocationContentSkeleton />}>
      <LocationDetailContent />
    </Suspense>
  );
}

function LocationDetailContent() {
  const t = useScopedI18n("locations");
  const { id: locationId } = useParams<{ id: Id<"locations"> }>();
  const { push } = useRouter();
  const { currentOrganizationId } = useOrganization();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const allLocations = useQuery(
    api.locations.listAll,
    currentOrganizationId ? { organizationId: currentOrganizationId } : "skip",
  );
  const { exhibitionLocations, storageLocations } = getVisibleSidebarLocations(
    allLocations ?? [],
  );
  const locationArgs = currentOrganizationId ? { locationId } : "skip";
  const location = useQuery(api.locations.get, locationArgs);
  const environmentalData = useQuery(
    api.locations.getEnvironmentalReadings,
    locationArgs,
  );
  const occupancy = useQuery(api.locations.getOccupancy, locationArgs);
  const objectsAtLocation = useQuery(
    api.locations.getObjectsAtLocation,
    currentOrganizationId ? { locationId, includeDescendants: true } : "skip",
  );
  const locationPath = buildLocationPath(allLocations ?? [], locationId);

  if (!currentOrganizationId) {
    return (
      <div className="flex size-full items-center justify-center">
        <p className="text-muted-foreground">{t("selectOrganizationToView")}</p>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-background md:flex-row">
      <LocationSidebar
        key={locationId}
        allLocations={allLocations ?? []}
        exhibitionLocations={exhibitionLocations}
        storageLocations={storageLocations}
        selectedLocationId={location?.parentLocationId ?? location?._id ?? null}
        onSelectLocation={(id) => push(`/locations/${id}`)}
      />
      <div className="custom-scrollbar min-h-0 min-w-0 flex-1 overflow-y-auto bg-background px-4 pb-6 pt-5 dark:bg-zinc-950 md:px-6">
        <nav aria-label="Location path" className="mb-5">
          <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            <li>
              <Link
                href="/locations"
                className="rounded-sm hover:text-foreground hover:underline focus-visible:outline focus-visible:outline-ring"
              >
                Locations
              </Link>
            </li>
            {locationPath.map((item) => (
              <li key={item._id} className="flex min-w-0 items-center gap-2">
                <ChevronRight className="size-3 shrink-0" aria-hidden="true" />
                {item._id === locationId ? (
                  <span
                    aria-current="page"
                    className="break-words text-foreground"
                  >
                    {item.name}
                  </span>
                ) : (
                  <Link
                    href={`/locations/${item._id}`}
                    className="rounded-sm hover:text-foreground hover:underline focus-visible:outline focus-visible:outline-ring"
                  >
                    {item.name}
                  </Link>
                )}
              </li>
            ))}
          </ol>
        </nav>

        {location === undefined ? (
          <LocationContentSkeleton />
        ) : location === null ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            {t("locationNotFound")}
          </p>
        ) : (
          <>
            <LocationLayoutContent
              actions={
                <LocationActions
                  onDelete={() => setDeleteDialogOpen(true)}
                  onAdd={() => setAddDialogOpen(true)}
                  onEdit={() => setEditDialogOpen(true)}
                />
              }
              selectedLocation={location}
              environmentalData={environmentalData ?? null}
              occupancy={occupancy ?? undefined}
              locations={allLocations ?? []}
              objectsAtLocation={objectsAtLocation ?? undefined}
              onSelectLocation={(id) => push(`/locations/${id}`)}
            />

            {(location.address || location.coordinates || location.notes) && (
              <dl className="mt-8 grid gap-5 rounded-lg bg-muted/20 p-4 text-xs sm:grid-cols-2">
                {location.address && (
                  <div>
                    <dt className="font-medium text-muted-foreground">
                      {t("address")}
                    </dt>
                    <dd className="mt-2 leading-relaxed">{location.address}</dd>
                  </div>
                )}
                {location.coordinates && (
                  <div>
                    <dt className="font-medium text-muted-foreground">
                      {t("coordinates")}
                    </dt>
                    <dd className="mt-2 tabular-nums">
                      {location.coordinates.latitude.toFixed(6)},{" "}
                      {location.coordinates.longitude.toFixed(6)}
                    </dd>
                  </div>
                )}
                {location.notes && (
                  <div className="sm:col-span-2">
                    <dt className="font-medium text-muted-foreground">
                      {t("notes")}
                    </dt>
                    <dd className="mt-2 whitespace-pre-wrap leading-relaxed">
                      {location.notes}
                    </dd>
                  </div>
                )}
              </dl>
            )}

            <section
              className="mt-8 border-t border-border/60 pt-5 dark:border-white/10"
              aria-labelledby="location-history-heading"
            >
              <h2
                id="location-history-heading"
                className="mb-4 flex items-center gap-2 text-xs font-medium"
              >
                <Clock
                  className="size-4 text-muted-foreground"
                  aria-hidden="true"
                />
                {t("locationHistory")}
              </h2>
              <Suspense fallback={<Skeleton className="h-32 w-full" />}>
                <LocationTimeline locationId={locationId} />
              </Suspense>
            </section>

            <AddChildLocationDialog
              parentLocationId={location._id}
              parentLocationName={location.name}
              parentLocationType={location.type}
              parentLocationAddress={location.address}
              organizationId={currentOrganizationId}
              open={addDialogOpen}
              onOpenChange={setAddDialogOpen}
            />
            <EditLocationDialog
              locationId={locationId}
              open={editDialogOpen}
              onOpenChange={setEditDialogOpen}
            />
            <DeleteLocationDialog
              locationId={locationId}
              locationName={location.name}
              open={deleteDialogOpen}
              onOpenChange={setDeleteDialogOpen}
              onDeleted={({ sentToDeaccessions }) => {
                push(sentToDeaccessions ? "/deaccessions" : "/locations");
              }}
            />
          </>
        )}
      </div>
    </div>
  );
}
