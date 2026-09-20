"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { GlassPanel } from "@v1/ui/glass-panel";
import { Skeleton } from "@v1/ui/skeleton";
import { useQuery } from "convex/react";
import { Archive, ArrowLeft, Clock, Trash2 } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Suspense, useState } from "react";
import { IconActionButton } from "@/components/icon-action-button";
import { useOrganization } from "@/components/organization-provider";
import { PermissionGate } from "@/components/permission-gate";
import { useScopedI18n } from "@/locales/client";
import { DeleteLocationDialog } from "../_components/delete-location-dialog";
import { formatLocationLabel } from "../location-label";
import { LocationTimeline } from "./_components/location-timeline";
import { ObjectsAtLocation } from "./_components/objects-at-location";

export default function LocationDetailPage() {
  const t = useScopedI18n("locations");
  const params = useParams();
  const { push } = useRouter();
  const locationId = params.id as string;
  const { currentOrganizationId } = useOrganization();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const location = useQuery(
    api.locations.get,
    locationId ? { locationId: locationId as Id<"locations"> } : "skip",
  );

  if (!currentOrganizationId) {
    return (
      <div className="flex size-full items-center justify-center">
        <p className="text-muted-foreground">{t("selectOrganizationToView")}</p>
      </div>
    );
  }

  if (location === undefined) {
    return (
      <div className="flex size-full items-center justify-center">
        <p className="text-muted-foreground">{t("loading")}</p>
      </div>
    );
  }

  if (location === null) {
    return (
      <div className="flex size-full items-center justify-center">
        <p className="text-muted-foreground">{t("locationNotFound")}</p>
      </div>
    );
  }

  return (
    <div className="flex size-full bg-background px-6 py-8">
      <div className="z-10 mx-auto flex size-full max-w-screen-xl gap-6 flex-col">
        {/* Header Actions */}
        <div className="flex w-full items-center justify-between">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/locations">
              <ArrowLeft className="mr-2 size-4" />
              {t("backToLocations")}
            </Link>
          </Button>
          <PermissionGate permission="organization.manage_settings">
            <PermissionGate permission="locations.delete">
              <IconActionButton
                label={t("delete")}
                className="hover:text-destructive"
                onClick={() => setDeleteDialogOpen(true)}
              >
                <Trash2 className="size-4" aria-hidden="true" />
              </IconActionButton>
            </PermissionGate>
          </PermissionGate>
        </div>

        {/* Location Details */}
        <GlassPanel padding="lg">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  {t("locationName")}
                </p>
                <p className="mt-1 text-lg font-medium">{location.name}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  {t("form.locationIdLabel")}
                </p>
                <p className="mt-1 font-medium">{location.locationCode}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  {t("type")}
                </p>
                <p className="mt-1 capitalize">{location.type}</p>
              </div>
              {location.address && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    {t("address")}
                  </p>
                  <p className="mt-1">{location.address}</p>
                </div>
              )}
              {location.coordinates && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    {t("coordinates")}
                  </p>
                  <p className="mt-1">
                    {location.coordinates.latitude.toFixed(6)},
                    {location.coordinates.longitude.toFixed(6)}
                  </p>
                </div>
              )}
            </div>
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  {t("childrenLocations")}
                </p>
                <p className="mt-1">
                  {location.children.length}{" "}
                  {location.children.length !== 1
                    ? t("subLocations")
                    : t("subLocation")}
                </p>
                {location.children.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {location.children.map((child) => (
                      <Link
                        key={child._id}
                        href={`/locations/${child._id}`}
                        className="block text-sm text-primary hover:underline"
                      >
                        {formatLocationLabel(child.locationCode, child.name)} (
                        {child.type})
                      </Link>
                    ))}
                  </div>
                )}
              </div>
              {location.notes && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    {t("notes")}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap">{location.notes}</p>
                </div>
              )}
            </div>
          </div>
        </GlassPanel>

        <GlassPanel padding="lg">
          <div className="mb-4 flex items-center gap-2">
            <Archive className="size-5" />
            <h3 className="text-lg font-medium">
              {t("objectsAtThisLocation")} ({location.objectCount})
            </h3>
          </div>
          <ObjectsAtLocation locationId={locationId} />
        </GlassPanel>

        <GlassPanel padding="lg">
          <div className="mb-4 flex items-center gap-2">
            <Clock className="size-5" />
            <h3 className="text-lg font-medium">{t("locationHistory")}</h3>
          </div>
          <Suspense fallback={<Skeleton className="h-64 w-full" />}>
            <LocationTimeline locationId={locationId} />
          </Suspense>
        </GlassPanel>
      </div>

      <DeleteLocationDialog
        locationId={locationId}
        locationName={location.name}
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onDeleted={({ sentToDeaccessions }) => {
          push(sentToDeaccessions ? "/deaccessions" : "/locations");
        }}
      />
    </div>
  );
}
