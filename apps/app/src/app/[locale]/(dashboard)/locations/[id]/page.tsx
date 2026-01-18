"use client";

import { useOrganization } from "@/components/organization-provider";
import { PermissionGate } from "@/components/permission-gate";
import { useScopedI18n } from "@/locales/client";
import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@v1/ui/alert-dialog";
import { Button } from "@v1/ui/button";
import { GlassPanel } from "@v1/ui/glass-panel";
import { Skeleton } from "@v1/ui/skeleton";
import { useMutation, useQuery } from "convex/react";
import { Archive, ArrowLeft, Clock, Trash2 } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Suspense, useState } from "react";
import { LocationTimeline } from "./_components/location-timeline";
import { ObjectsAtLocation } from "./_components/objects-at-location";

export default function LocationDetailPage() {
  const t = useScopedI18n("locations");
  const params = useParams();
  const router = useRouter();
  const locationId = params.id as string;
  const { currentOrganizationId } = useOrganization();
  const [error, setError] = useState<string | null>(null);

  const location = useQuery(
    api.locations.get,
    locationId ? { locationId: locationId as Id<"locations"> } : "skip",
  );

  const deleteLocation = useMutation(api.locations.deleteLocation);

  if (!currentOrganizationId) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <p className="text-muted-foreground">{t("selectOrganizationToView")}</p>
      </div>
    );
  }

  if (location === undefined) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <p className="text-muted-foreground">{t("loading")}</p>
      </div>
    );
  }

  if (location === null) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <p className="text-muted-foreground">{t("locationNotFound")}</p>
      </div>
    );
  }

  const handleDelete = async () => {
    setError(null);
    try {
      await deleteLocation({ locationId: locationId as Id<"locations"> });
      router.push("/locations");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to delete location",
      );
    }
  };

  return (
    <div className="flex h-full w-full bg-background px-6 py-8">
      <div className="z-10 mx-auto flex h-full w-full max-w-screen-xl gap-6 flex-col">
        {/* Header Actions */}
        <div className="flex w-full items-center justify-between">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/locations">
              <ArrowLeft className="mr-2 h-4 w-4" />
              {t("backToLocations")}
            </Link>
          </Button>
          <PermissionGate permission="locations.delete">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  {t("delete")}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t("deleteLocation")}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {t("deleteConfirm")}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete}>
                    {t("deleteLocation")}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </PermissionGate>
        </div>

        {/* Error Display */}
        {error && (
          <div className="rounded-lg border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Location Details */}
        <GlassPanel padding="lg">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  {t("locationName")}
                </label>
                <p className="mt-1 text-lg font-medium">{location.name}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  {t("type")}
                </label>
                <p className="mt-1 capitalize">{location.type}</p>
              </div>
              {location.address && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    {t("address")}
                  </label>
                  <p className="mt-1">{location.address}</p>
                </div>
              )}
              {location.coordinates && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    {t("coordinates")}
                  </label>
                  <p className="mt-1">
                    {location.coordinates.latitude.toFixed(6)},
                    {location.coordinates.longitude.toFixed(6)}
                  </p>
                </div>
              )}
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  {t("childrenLocations")}
                </label>
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
                        {child.name} ({child.type})
                      </Link>
                    ))}
                  </div>
                )}
              </div>
              {location.notes && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    {t("notes")}
                  </label>
                  <p className="mt-1 whitespace-pre-wrap">{location.notes}</p>
                </div>
              )}
            </div>
          </div>
        </GlassPanel>

        <GlassPanel padding="lg">
          <div className="mb-4 flex items-center gap-2">
            <Archive className="h-5 w-5" />
            <h3 className="text-lg font-medium">
              {t("objectsAtThisLocation")} ({location.objectCount})
            </h3>
          </div>
          <ObjectsAtLocation locationId={locationId} />
        </GlassPanel>

        <GlassPanel padding="lg">
          <div className="mb-4 flex items-center gap-2">
            <Clock className="h-5 w-5" />
            <h3 className="text-lg font-medium">{t("locationHistory")}</h3>
          </div>
          <Suspense fallback={<Skeleton className="h-64 w-full" />}>
            <LocationTimeline locationId={locationId} />
          </Suspense>
        </GlassPanel>
      </div>
    </div>
  );
}
