import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { describe, expect, test } from "vitest";

import {
  getAutomaticDisplayUnitCounts,
  getDefaultLocationId,
  getDescendantLocations,
  getExhibitionDropdownLabel,
  getExhibitionSpaceOptions,
  getVisibleSidebarLocations,
  isStorageLocation,
  shouldAutoDisplayChildLocations,
  shouldShowInExhibitionSidebar,
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

  test("exhibition space options flatten the exhibition sidebar tree", () => {
    const locations = [
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
        parentLocationId: locationId("loc-gallery"),
      },
      {
        _id: locationId("loc-cabinet"),
        name: "Cabinet A-1",
        locationCode: "CAB-001",
        type: "cabinet",
        isActive: true,
        parentLocationId: locationId("loc-room"),
      },
      {
        _id: locationId("loc-shelf"),
        name: "Shelf 1",
        locationCode: "SH-001",
        type: "shelf",
        isActive: true,
        parentLocationId: locationId("loc-cabinet"),
      },
      {
        _id: locationId("loc-storage"),
        name: "Storage A",
        locationCode: "ST-001",
        type: "storage",
        isActive: true,
      },
    ];

    expect(
      getExhibitionSpaceOptions(locations).map((option) => ({
        id: option.location._id,
        depth: option.depth,
      })),
    ).toEqual([
      { id: locationId("loc-gallery"), depth: 0 },
      { id: locationId("loc-room"), depth: 1 },
      { id: locationId("loc-cabinet"), depth: 2 },
    ]);
  });

  test("exhibition dropdown label uses the exhibition root while browsing nested units", () => {
    const locations = [
      {
        _id: locationId("loc-gallery"),
        name: "Gallery A",
        locationCode: "G-001",
        type: "gallery",
        isActive: true,
      },
      {
        _id: locationId("loc-cabinet"),
        name: "Cabinet A-1",
        locationCode: "CAB-001",
        type: "cabinet",
        isActive: true,
        parentLocationId: locationId("loc-gallery"),
      },
    ];

    expect(
      getExhibitionDropdownLabel({
        selectedLocationId: locationId("loc-cabinet"),
        selectedLocationPath: [
          { _id: locationId("loc-gallery"), name: "Gallery A" },
          { _id: locationId("loc-cabinet"), name: "Cabinet A-1" },
        ],
        exhibitionSpaceOptions: getExhibitionSpaceOptions(locations),
      }),
    ).toBe("Gallery A");
  });

  test("exhibition dropdown label falls back when viewing storage", () => {
    const locations = [
      {
        _id: locationId("loc-gallery"),
        name: "Gallery A",
        locationCode: "G-001",
        type: "gallery",
        isActive: true,
      },
      {
        _id: locationId("loc-storage"),
        name: "Storage A",
        locationCode: "ST-001",
        type: "storage",
        isActive: true,
      },
    ];

    expect(
      getExhibitionDropdownLabel({
        selectedLocationId: locationId("loc-storage"),
        selectedLocationPath: [
          { _id: locationId("loc-storage"), name: "Storage A" },
        ],
        exhibitionSpaceOptions: getExhibitionSpaceOptions(locations),
      }),
    ).toBe("Exhibition Spaces");
  });

  test("storage detection matches operational location types", () => {
    expect(isStorageLocation("archive box")).toBe(true);
    expect(isStorageLocation("gallery")).toBe(false);
  });

  test("auto-display detection matches exhibition container types", () => {
    expect(shouldAutoDisplayChildLocations("building")).toBe(true);
    expect(shouldAutoDisplayChildLocations("gallery room")).toBe(true);
    expect(shouldAutoDisplayChildLocations("cabinet")).toBe(false);
  });

  test("exhibition sidebar shows one display-unit level", () => {
    expect(shouldShowInExhibitionSidebar("gallery")).toBe(true);
    expect(shouldShowInExhibitionSidebar("room")).toBe(true);
    expect(shouldShowInExhibitionSidebar("cabinet")).toBe(true);
    expect(shouldShowInExhibitionSidebar("display case")).toBe(true);
    expect(shouldShowInExhibitionSidebar("wall")).toBe(true);
    expect(shouldShowInExhibitionSidebar("shelf")).toBe(false);
  });

  test("collects all descendant locations recursively", () => {
    const locations = [
      {
        _id: locationId("loc-building"),
        name: "Main Building",
        locationCode: "B-001",
        type: "building",
        isActive: true,
      },
      {
        _id: locationId("loc-gallery"),
        name: "Gallery A",
        locationCode: "G-001",
        type: "gallery",
        isActive: true,
        parentLocationId: locationId("loc-building"),
      },
      {
        _id: locationId("loc-cabinet"),
        name: "Cabinet A-1",
        locationCode: "CAB-001",
        type: "cabinet",
        isActive: true,
        parentLocationId: locationId("loc-gallery"),
      },
      {
        _id: locationId("loc-shelf"),
        name: "Shelf 1",
        locationCode: "SH-001",
        type: "shelf",
        isActive: true,
        parentLocationId: locationId("loc-cabinet"),
      },
    ];

    expect(
      getDescendantLocations(locations, locationId("loc-building")).map(
        (location) => location._id,
      ),
    ).toEqual([
      locationId("loc-gallery"),
      locationId("loc-cabinet"),
      locationId("loc-shelf"),
    ]);
  });

  test("derives display unit counts from descendant locations", () => {
    const locations = [
      {
        _id: locationId("loc-building"),
        name: "Main Building",
        locationCode: "B-001",
        type: "building",
        isActive: true,
      },
      {
        _id: locationId("loc-gallery"),
        name: "Gallery A",
        locationCode: "G-001",
        type: "gallery",
        isActive: true,
        parentLocationId: locationId("loc-building"),
      },
      {
        _id: locationId("loc-wall"),
        name: "Wall North",
        locationCode: "W-001",
        type: "wall",
        isActive: true,
        parentLocationId: locationId("loc-gallery"),
      },
      {
        _id: locationId("loc-cabinet"),
        name: "Cabinet A-1",
        locationCode: "CAB-001",
        type: "cabinet",
        isActive: true,
        parentLocationId: locationId("loc-gallery"),
      },
      {
        _id: locationId("loc-shelf"),
        name: "Shelf 1",
        locationCode: "SH-001",
        type: "shelf",
        isActive: true,
        parentLocationId: locationId("loc-cabinet"),
      },
      {
        _id: locationId("loc-vitrine"),
        name: "Case 1",
        locationCode: "V-001",
        type: "display case",
        isActive: true,
        parentLocationId: locationId("loc-gallery"),
      },
    ];

    expect(
      getAutomaticDisplayUnitCounts(locations, locationId("loc-building")),
    ).toEqual({
      vitrineCount: 1,
      wallCount: 1,
      cabinetCount: 1,
      shelfCount: 1,
    });
  });
});
