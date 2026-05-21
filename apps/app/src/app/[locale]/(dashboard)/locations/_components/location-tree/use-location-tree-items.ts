import { useMemo } from "react";
import type { LocationItem } from "./types";

interface LocationListEntry {
  _id: string;
  name: string;
  type: string;
  parentLocationId?: string;
  sortOrder: number;
  isActive: boolean;
  address?: string;
  notes?: string;
}

export function useLocationTreeItems(
  allLocations: LocationListEntry[] | undefined,
  allLocationsLabel: string,
) {
  return useMemo(() => {
    const itemsMap: Record<string, LocationItem> = {};
    const roots: string[] = [];

    if (allLocations) {
      const sortedLocations = allLocations.toSorted(
        (a, b) => a.sortOrder - b.sortOrder,
      );

      for (const loc of sortedLocations) {
        itemsMap[loc._id] = {
          _id: loc._id,
          name: loc.name,
          type: loc.type,
          parentLocationId: loc.parentLocationId,
          sortOrder: loc.sortOrder,
          isActive: loc.isActive,
          children: [],
          address: loc.address,
          notes: loc.notes,
        };

        if (!loc.parentLocationId) {
          roots.push(loc._id);
        }
      }

      for (const loc of sortedLocations) {
        if (loc.parentLocationId) {
          const parent = itemsMap[loc.parentLocationId];
          if (parent?.children) {
            parent.children.push(loc._id);
          }
        }
      }
    }

    itemsMap.root = {
      _id: "root",
      name: allLocationsLabel,
      type: "root",
      sortOrder: 0,
      isActive: true,
      children: roots,
    };

    const structureHash =
      allLocations
        ?.map(
          (loc) =>
            `${loc._id}:${loc.parentLocationId || "root"}:${loc.sortOrder}`,
        )
        .sort()
        .join("|") || "";

    return { items: itemsMap, rootChildren: roots, dataVersion: structureHash };
  }, [allLocations, allLocationsLabel]);
}

export function getLocationTreeDataVersion(
  allLocations: LocationListEntry[] | undefined,
) {
  return (
    allLocations
      ?.map(
        (loc) =>
          `${loc._id}:${loc.parentLocationId || "root"}:${loc.sortOrder}`,
      )
      .sort()
      .join("|") || ""
  );
}
