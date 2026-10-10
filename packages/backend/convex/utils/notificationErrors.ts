import { ConvexError } from "convex/values";
import { convexErrorData } from "./convexErrorData";

/**
 * Stable codes for notification failures the recipient can act on. Clients
 * map these to translated copy.
 */
export const NOTIFICATION_ERROR_CODES = [
  "NOT_ORGANIZATION_MEMBER",
  "NOTIFICATION_ACCESS_REVOKED",
  "EMAIL_CHANNEL_UNAVAILABLE",
  "EMAIL_ADDRESS_MISSING",
  "EMAIL_OFF_FOR_CATEGORY",
  "EMAIL_DELIVERY_NOT_FOUND",
  "EMAIL_DELIVERY_NOT_RETRYABLE",
] as const;

export type NotificationErrorCode = (typeof NOTIFICATION_ERROR_CODES)[number];

// Type alias (not an interface) so the payload satisfies Convex's Value type.
export type NotificationErrorData = { code: NotificationErrorCode };

export function notificationError(
  code: NotificationErrorCode,
): ConvexError<NotificationErrorData> {
  return new ConvexError({ code });
}

/** Reads a notification error code from a thrown error; null otherwise. */
export function notificationErrorCodeFromError(
  error: unknown,
): NotificationErrorCode | null {
  const data = convexErrorData(error);
  if (typeof data !== "object" || data === null || !("code" in data)) {
    return null;
  }
  return NOTIFICATION_ERROR_CODES.find((code) => code === data.code) ?? null;
}
