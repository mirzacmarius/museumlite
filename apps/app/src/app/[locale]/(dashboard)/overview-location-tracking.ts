export const LOCATION_TRACKING_OVERVIEW_HREF = "/locations";
export const LOCATION_TRACKING_OVERVIEW_TITLE = "Location & Tracking";

export function shouldShowLocationTrackingOverview(
  locationTrackingEnabled: boolean | undefined,
): boolean {
  return locationTrackingEnabled !== false;
}
