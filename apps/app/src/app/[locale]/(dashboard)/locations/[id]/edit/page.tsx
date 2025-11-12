"use client";

import { Header } from "@/app/[locale]/(dashboard)/_components/header";
import { useOrganization } from "@/components/organization-provider";
import { PermissionGate } from "@/components/permission-gate";
import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { Input } from "@v1/ui/input";
import { Label } from "@v1/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@v1/ui/select";
import { Textarea } from "@v1/ui/textarea";
import { useMutation, useQuery } from "convex/react";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function EditLocationPage() {
  const params = useParams();
  const router = useRouter();
  const locationId = params.id as string;
  const { currentOrganizationId } = useOrganization();
  const [name, setName] = useState("");
  const [type, setType] = useState("");
  const [parentLocationId, setParentLocationId] = useState<string | undefined>(
    undefined,
  );
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const location = useQuery(
    api.locations.get,
    locationId ? { locationId: locationId as Id<"locations"> } : "skip",
  );

  const locationTypes = useQuery(
    api.locations.getLocationTypes,
    currentOrganizationId
      ? { organizationId: currentOrganizationId as Id<"organizations"> }
      : "skip",
  );

  // Get all locations as a flat list for parent selection
  const allLocations = useQuery(
    api.locations.listAll,
    currentOrganizationId
      ? {
          organizationId: currentOrganizationId as Id<"organizations">,
        }
      : "skip",
  );

  const updateLocation = useMutation(api.locations.update);

  // Helper to build location path from root to location
  const buildPath = (
    locationId: string,
    locations: typeof allLocations,
  ): string => {
    if (!locations) return "";
    
    const location = locations.find((loc) => loc._id === locationId);
    if (!location) return "";
    
    if (!location.parentLocationId) {
      return location.name;
    }
    
    const parentPath = buildPath(location.parentLocationId, locations);
    return parentPath ? `${parentPath} → ${location.name}` : location.name;
  };

  // Helper to get all descendant IDs of a location
  const getDescendantIds = (
    locationId: string,
    locations: typeof allLocations,
  ): Set<string> => {
    const descendants = new Set<string>();
    
    const findDescendants = (id: string) => {
      const children = locations?.filter((loc) => loc.parentLocationId === id);
      if (!children) return;
      
      for (const child of children) {
        descendants.add(child._id);
        findDescendants(child._id);
      }
    };
    
    findDescendants(locationId);
    return descendants;
  };

  // Build location options with full paths
  const allLocationOptions = allLocations?.map((loc) => ({
    _id: loc._id,
    name: loc.name,
    type: loc.type,
    path: buildPath(loc._id, allLocations),
  })) || [];

  // Filter out current location and its descendants to prevent circular references
  const descendantIds = getDescendantIds(locationId, allLocations);
  const availableLocationOptions = allLocationOptions.filter(
    (loc) => loc._id !== locationId && !descendantIds.has(loc._id)
  );

  useEffect(() => {
    if (location) {
      setName(location.name);
      setType(location.type);
      setParentLocationId(location.parentLocationId || undefined);
      setAddress(location.address || "");
      setNotes(location.notes || "");
    }
  }, [location]);

  if (!currentOrganizationId) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <p className="text-muted-foreground">
          Please select an organization to edit a location.
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name || !type) {
      setError("Please fill in all required fields");
      return;
    }

    setIsSubmitting(true);
    try {
      await updateLocation({
        locationId: locationId as Id<"locations">,
        name,
        type,
        parentLocationId: parentLocationId
          ? (parentLocationId as Id<"locations">)
          : undefined,
        address: address || undefined,
        notes: notes || undefined,
      });
      router.push(`/locations/${locationId}`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to update location",
      );
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Header title="Edit Location" description="Update location details" />
      <div className="flex h-full w-full bg-secondary px-6 py-8 dark:bg-black">
        <div className="z-10 mx-auto flex h-full w-full max-w-screen-xl gap-12">
          <div className="flex w-full flex-col rounded-lg border border-border bg-card dark:bg-black">
            <div className="flex w-full items-center justify-between rounded-lg border-b border-border p-6">
              <Button variant="ghost" size="sm" asChild>
                <Link href={`/locations/${locationId}`}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Location
                </Link>
              </Button>
            </div>

            <form onSubmit={handleSubmit} className="p-6">
              {error && (
                <div className="mb-6 rounded-lg border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
                  {error}
                </div>
              )}
              <div className="mx-auto max-w-2xl space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="name">Location Name *</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g., Main Building, Gallery 815"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="type">Location Type *</Label>
                  <Select value={type} onValueChange={setType} required>
                    <SelectTrigger id="type">
                      <SelectValue placeholder="Select a location type" />
                    </SelectTrigger>
                    <SelectContent>
                      {locationTypes?.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t.charAt(0).toUpperCase() + t.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="parent">Parent Location</Label>
                  <Select
                    value={parentLocationId || "__none__"}
                    onValueChange={(value) =>
                      setParentLocationId(
                        value === "__none__" ? undefined : value,
                      )
                    }
                  >
                    <SelectTrigger id="parent">
                      <SelectValue placeholder="Select a parent location (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">
                        None (Root Location)
                      </SelectItem>
                      {availableLocationOptions.map((loc) => (
                        <SelectItem key={loc._id} value={loc._id}>
                          {loc.path}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Select a parent location or leave empty for root-level
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address">Address</Label>
                  <Input
                    id="address"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="e.g., 123 Museum Street, New York, NY"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Additional notes about this location..."
                    rows={4}
                  />
                </div>

                <div className="flex justify-end gap-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => router.back()}
                  >
                    Cancel
                  </Button>
                  <PermissionGate permission="locations.update">
                    <Button type="submit" disabled={isSubmitting}>
                      {isSubmitting ? "Updating..." : "Update Location"}
                    </Button>
                  </PermissionGate>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}
