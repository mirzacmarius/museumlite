const DAY_MS = 24 * 60 * 60 * 1000;

export const ORGANIZATION_DELETION_GRACE_MS = 90 * DAY_MS;
export const ORGANIZATION_DELETION_WAIT_BEFORE_FINAL_NOTICE_MS = 30 * DAY_MS;
export const ORGANIZATION_DELETION_FINAL_NOTICE_DISPLAY_MS = 3 * DAY_MS;
export const ORGANIZATION_DELETION_PURGE_AFTER_FINAL_NOTICE_MS = 7 * DAY_MS;

export function addMs(timestamp: number, offsetMs: number): number {
  return timestamp + offsetMs;
}

export function formatDeletionDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
