import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { describe, expect, test } from "vitest";

import { getAvailableParentLocationOptions } from "./location-parent-options";

function locationId(value: string) {
  return value as Id<"locations">;
}

describe("location parent options", () => {
  test("excludes the current location and its descendants", () => {
    const options = getAvailableParentLocationOptions(
      [
        {
          _id: locationId("building"),
          name: "Building",
          type: "building",
        },
        {
          _id: locationId("gallery"),
          name: "Gallery",
          type: "gallery",
          parentLocationId: locationId("building"),
        },
        {
          _id: locationId("wall"),
          name: "Wall A",
          type: "wall",
          parentLocationId: locationId("gallery"),
        },
        {
          _id: locationId("storage"),
          name: "Storage",
          type: "storage",
        },
      ],
      locationId("gallery"),
    );

    expect(options.map((option) => option.id)).toEqual([
      locationId("building"),
      locationId("storage"),
    ]);
  });

  test("keeps hierarchical display names for valid parent options", () => {
    const options = getAvailableParentLocationOptions(
      [
        {
          _id: locationId("building"),
          name: "Building",
          type: "building",
        },
        {
          _id: locationId("room"),
          name: "Room 1",
          type: "room",
          parentLocationId: locationId("building"),
        },
      ],
      locationId("other"),
    );

    expect(options).toEqual([
      {
        id: locationId("building"),
        name: "Building",
        type: "building",
        level: 0,
      },
      {
        id: locationId("room"),
        name: "Building -> Room 1",
        type: "room",
        level: 1,
      },
    ]);
  });
});
