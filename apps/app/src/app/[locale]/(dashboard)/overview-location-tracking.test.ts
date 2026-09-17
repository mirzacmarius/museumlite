import { describe, expect, test } from "vitest";
import {
  LOCATION_TRACKING_OVERVIEW_HREF,
  shouldShowLocationTrackingOverview,
} from "./overview-location-tracking";

describe("shouldShowLocationTrackingOverview", () => {
  test("shows the overview card when location tracking is enabled or unset", () => {
    expect(shouldShowLocationTrackingOverview(true)).toBe(true);
    expect(shouldShowLocationTrackingOverview(undefined)).toBe(true);
  });

  test("hides the overview card when location tracking is disabled", () => {
    expect(shouldShowLocationTrackingOverview(false)).toBe(false);
  });

  test("links to the Location & Tracking page", () => {
    expect(LOCATION_TRACKING_OVERVIEW_HREF).toBe("/locations");
  });
});
