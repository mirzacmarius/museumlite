const SUPPRESSED_NOTIFICATION_TYPES = new Set(["missing_coverage"]);
const SUPPRESSED_NOTIFICATION_TITLES = new Set([
  "Objects Missing Insurance Coverage",
]);

export function isSuppressedNotification(notification: {
  type: string;
  title: string;
}): boolean {
  return (
    SUPPRESSED_NOTIFICATION_TYPES.has(notification.type) ||
    SUPPRESSED_NOTIFICATION_TITLES.has(notification.title)
  );
}

export function withoutSuppressedNotifications<
  T extends { type: string; title: string },
>(notifications: readonly T[]): T[] {
  return notifications.filter(
    (notification) => !isSuppressedNotification(notification),
  );
}
