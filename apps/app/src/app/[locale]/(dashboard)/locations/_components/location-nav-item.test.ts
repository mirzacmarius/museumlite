import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { describe, expect, test } from "vitest";
import { getLocationPathIds, type SidebarLocation } from "./location-nav-item";

function locationId(value: string) {
  return value as Id<"locations">;
}

function location(
  id: string,
  extras: Partial<SidebarLocation> = {},
): SidebarLocation {
  return {
    _id: locationId(id),
    name: extras.name ?? id,
    locationCode: extras.locationCode ?? id,
    type: extras.type ?? "room",
    isActive: extras.isActive ?? true,
    parentLocationId: extras.parentLocationId,
  };
}

describe("getLocationPathIds", () => {
  test("returns an empty set when nothing is selected", () => {
    expect(getLocationPathIds([location("gallery")], null).size).toBe(0);
  });

  test("includes the selected location and each ancestor", () => {
    const gallery = location("gallery", { type: "gallery" });
    const floor = location("floor", {
      type: "floor",
      parentLocationId: gallery._id,
    });
    const room = location("room", {
      type: "room",
      parentLocationId: floor._id,
    });

    expect([...getLocationPathIds([gallery, floor, room], room._id)]).toEqual([
      room._id,
      floor._id,
      gallery._id,
    ]);
  });

  test("stops if a parent id is missing from the list", () => {
    const room = location("room", {
      parentLocationId: locationId("missing"),
    });

    expect([...getLocationPathIds([room], room._id)]).toEqual([room._id]);
  });
});
