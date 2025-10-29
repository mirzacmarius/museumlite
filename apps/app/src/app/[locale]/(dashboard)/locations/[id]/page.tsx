"use client";

import { Header } from "@/app/[locale]/(dashboard)/_components/header";
import { api } from "@v1/backend/convex/_generated/api";
import { Button } from "@v1/ui/button";
import { useOrganization } from "@/components/organization-provider";
import { PermissionGate } from "@/components/permission-gate";
import { useQuery, useMutation } from "convex/react";
import { ArrowLeft, Edit, MapPin, Archive, Trash2 } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ObjectsAtLocation } from "./_components/objects-at-location";

export default function LocationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const locationId = params.id as string;
  const { currentOrganizationId } = useOrganization();

  const location = useQuery(
    api.locations.get,
    locationId ? { locationId: locationId as any } : "skip",
  );

  const deleteLocation = useMutation(api.locations.deleteLocation);

  if (!currentOrganizationId) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <p className="text-muted-foreground">
          Please select an organization to view locations.
        </p>
      </div>
    );
  }

  if (location === undefined) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (location === null) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <p className="text-muted-foreground">Location not found</p>
      </div>
    );
  }

  const handleDelete = async () => {
    if (
      !confirm(
        "Are you sure you want to delete this location? This action cannot be undone.",
      )
    ) {
      return;
    }

    try {
      await deleteLocation({ locationId: locationId as any });
      router.push("/locations");
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "Failed to delete location",
      );
    }
  };

  return (
    <>
      <Header
        title={location.name}
        description={`${location.type} • ${location.objectCount} objects`}
      />
      <div className="flex h-full w-full bg-secondary px-6 py-8 dark:bg-black">
        <div className="z-10 mx-auto flex h-full w-full max-w-screen-xl gap-12">
          <div className="flex w-full flex-col rounded-lg border border-border bg-card dark:bg-black">
            {/* Header Actions */}
            <div className="flex w-full items-center justify-between rounded-lg border-b border-border p-6">
              <Button variant="ghost" size="sm" asChild>
                <Link href="/locations">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Locations
                </Link>
              </Button>
              <div className="flex gap-2">
                <PermissionGate permission="locations.update">
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/locations/${locationId}/edit`}>
                      <Edit className="mr-2 h-4 w-4" />
                      Edit
                    </Link>
                  </Button>
                </PermissionGate>
                <PermissionGate permission="locations.delete">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDelete}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </Button>
                </PermissionGate>
              </div>
            </div>

            {/* Location Details */}
            <div className="p-6">
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      Location Name
                    </label>
                    <p className="mt-1 text-lg font-medium">{location.name}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      Type
                    </label>
                    <p className="mt-1 capitalize">{location.type}</p>
                  </div>
                  {location.address && (
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">
                        Address
                      </label>
                      <p className="mt-1">{location.address}</p>
                    </div>
                  )}
                  {location.coordinates && (
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">
                        Coordinates
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
                      Children Locations
                    </label>
                    <p className="mt-1">
                      {location.children.length} sub-location
                      {location.children.length !== 1 ? "s" : ""}
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
                        Notes
                      </label>
                      <p className="mt-1 whitespace-pre-wrap">
                        {location.notes}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Objects at Location */}
            <div className="border-t border-border p-6">
              <div className="mb-4 flex items-center gap-2">
                <Archive className="h-5 w-5" />
                <h3 className="text-lg font-medium">
                  Objects at this Location ({location.objectCount})
                </h3>
              </div>
              <ObjectsAtLocation locationId={locationId} />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

