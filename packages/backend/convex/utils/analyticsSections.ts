/**
 * Role permission each Analytics section needs on top of the reporting
 * capability. The section's queries enforce it, and the page reads the same
 * map to skip a section's queries and show it as unavailable instead.
 */
export const ANALYTICS_SECTION_PERMISSIONS = {
  locationUtilization: "locations.read",
  scheduledReports: "organization.view_analytics",
} as const;

export type AnalyticsSection = keyof typeof ANALYTICS_SECTION_PERMISSIONS;
