"use client";

import { api } from "@v1/backend/convex/_generated/api";
import { Button } from "@v1/ui/button";
import { useQuery } from "convex/react";
import { ChevronRight, ChevronDown, MapPin, Folder } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import type { Id } from "@v1/backend/convex/_generated/dataModel";

interface LocationTreeProps {
  organizationId: string;
}

interface LocationNode {
  _id: Id<"locations">;
  name: string;
  type: string;
  parentLocationId?: Id<"locations">;
  children?: Array<{
    _id: Id<"locations">;
    name: string;
    type: string;
    isActive: boolean;
  }>;
}

export function LocationTree({ organizationId }: LocationTreeProps) {
  const locations = useQuery(
    api.locations.list,
    organizationId
      ? { organizationId: organizationId as Id<"organizations">, parentLocationId: "root" }
      : "skip",
  );

  if (locations === undefined) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-muted-foreground">Loading locations...</p>
      </div>
    );
  }

  if (locations.length === 0) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-4">
        <MapPin className="h-12 w-12 text-muted-foreground" />
        <div className="text-center">
          <p className="text-muted-foreground">No locations found</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Create your first location to get started
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="space-y-1">
        {locations.map((location) => (
          <LocationTreeNode
            key={location._id}
            location={location}
            organizationId={organizationId}
          />
        ))}
      </div>
    </div>
  );
}

function LocationTreeNode({
  location,
  organizationId,
}: {
  location: LocationNode;
  organizationId: string;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const hasChildren = location.children && location.children.length > 0;

  // Fetch children when expanded
  const childLocations = useQuery(
    api.locations.list,
    isExpanded && organizationId
      ? {
          organizationId: organizationId as Id<"organizations">,
          parentLocationId: location._id,
        }
      : "skip",
  );

  const getTypeIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case "building":
        return <MapPin className="h-4 w-4" />;
      default:
        return <Folder className="h-4 w-4" />;
    }
  };

  return (
    <div className="select-none">
      <div className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent">
        {hasChildren ? (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex h-6 w-6 items-center justify-center rounded hover:bg-accent"
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>
        ) : (
          <div className="w-6" />
        )}
        <div className="flex flex-1 items-center gap-2">
          {getTypeIcon(location.type)}
          <Link
            href={`/locations/${location._id}`}
            className="flex-1 font-medium hover:underline"
          >
            {location.name}
          </Link>
          <span className="text-xs text-muted-foreground capitalize">
            {location.type}
          </span>
        </div>
      </div>
      {hasChildren && isExpanded && (
        <div className="ml-8 border-l border-border pl-2">
          {childLocations?.map((child) => (
            <LocationTreeNode
              key={child._id}
              location={child}
              organizationId={organizationId}
            />
          ))}
        </div>
      )}
    </div>
  );
}

