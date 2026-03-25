import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { describe, expect, test } from "vitest";

import {
  getDefaultLocationId,
  getVisibleSidebarLocations,
  isStorageLocation,
} from "./location-view-helpers";

function locationId(value: string) {
  return value as Id<"locations">;
}

describe("location view helpers", () => {
  test("defaults to the first visible top-level exhibition location", () => {
    const locations = [
      {
        _id: locationId("loc-storage"),
        name: "Storage A",
        locationCode: "ST-001",
        type: "storage",
        isActive: true,
      },
      {
        _id: locationId("loc-gallery"),
        name: "Gallery A",
        locationCode: "G-001",
        type: "gallery",
        isActive: true,
      },
      {
        _id: locationId("loc-room"),
        name: "Room A",
        locationCode: "R-001",
        type: "room",
        isActive: true,
      },
    ];

    expect(getDefaultLocationId(locations)).toBe(locationId("loc-gallery"));
  });

  test("defaults to the first visible top-level storage location when no exhibition location exists", () => {
    const locations = [
      {
        _id: locationId("loc-storage"),
        name: "Storage A",
        locationCode: "ST-001",
        type: "storage",
        isActive: true,
      },
      {
        _id: locationId("loc-vault"),
        name: "Vault A",
        locationCode: "V-001",
        type: "vault",
        isActive: true,
      },
    ];

    expect(getDefaultLocationId(locations)).toBe(locationId("loc-storage"));
  });

  test("visible sidebar locations exclude child locations", () => {
    const locations = [
      {
        _id: locationId("loc-gallery"),
        name: "Gallery A",
        locationCode: "G-001",
        type: "gallery",
        isActive: true,
      },
      {
        _id: locationId("loc-shelf"),
        name: "Shelf A",
        locationCode: "SH-001",
        type: "shelf",
        isActive: true,
        parentLocationId: locationId("loc-storage"),
      },
      {
        _id: locationId("loc-storage"),
        name: "Storage A",
        locationCode: "ST-001",
        type: "storage",
        isActive: true,
      },
    ];

    const { exhibitionLocations, storageLocations } =
      getVisibleSidebarLocations(locations);

    expect(exhibitionLocations.map((location) => location._id)).toEqual([
      locationId("loc-gallery"),
    ]);
    expect(storageLocations.map((location) => location._id)).toEqual([
      locationId("loc-storage"),
    ]);
  });

  test("storage detection matches operational location types", () => {
    expect(isStorageLocation("archive box")).toBe(true);
    expect(isStorageLocation("gallery")).toBe(false);
  });
});
