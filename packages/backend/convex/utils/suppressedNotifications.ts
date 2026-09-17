interface NotificationIdentity {
  type: string;
  title: string;
}

const SUPPRESSED_TYPE = "missing_coverage";
const SUPPRESSED_TITLE = "Objects Missing Insurance Coverage";

export function isSuppressedNotification(
  notification: NotificationIdentity,
): boolean {
  return (
    notification.type === SUPPRESSED_TYPE ||
    notification.title === SUPPRESSED_TITLE
  );
}

export function withoutSuppressedNotifications<T extends NotificationIdentity>(
  notifications: readonly T[],
): T[] {
  return notifications.filter(
    (notification) => !isSuppressedNotification(notification),
  );
}
