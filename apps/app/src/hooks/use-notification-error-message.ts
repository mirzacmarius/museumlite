import { notificationErrorCodeFromError } from "@v1/backend/convex/utils/notificationErrors";
import { useScopedI18n } from "@/locales/client";

/**
 * Translates a refused email or digest retry. Any other failure gets the
 * translated fallback; server error text is never shown.
 */
export function useEmailRetryErrorMessage() {
  const t = useScopedI18n("notificationsPage.email.errors");
  return (error: unknown) => {
    switch (notificationErrorCodeFromError(error)) {
      case "EMAIL_DELIVERY_NOT_FOUND":
        return t("EMAIL_DELIVERY_NOT_FOUND");
      case "EMAIL_DELIVERY_NOT_RETRYABLE":
        return t("EMAIL_DELIVERY_NOT_RETRYABLE");
      case "EMAIL_OFF_FOR_CATEGORY":
        return t("EMAIL_OFF_FOR_CATEGORY");
      case "EMAIL_ADDRESS_MISSING":
        return t("EMAIL_ADDRESS_MISSING");
      case "EMAIL_CHANNEL_UNAVAILABLE":
        return t("EMAIL_CHANNEL_UNAVAILABLE");
      case "NOTIFICATION_ACCESS_REVOKED":
        return t("NOTIFICATION_ACCESS_REVOKED");
      case "NOT_ORGANIZATION_MEMBER":
        return t("NOT_ORGANIZATION_MEMBER");
      case "DIGEST_EMPTY":
        return t("DIGEST_EMPTY");
      case "DIGEST_SCHEDULE_INVALID":
      case null:
        return t("fallback");
    }
  };
}

/** Translates a refused preference update; other failures get the fallback. */
export function useNotificationPreferencesErrorMessage() {
  const t = useScopedI18n("notificationSettings.errors");
  return (error: unknown) => {
    switch (notificationErrorCodeFromError(error)) {
      case "NOT_ORGANIZATION_MEMBER":
        return t("NOT_ORGANIZATION_MEMBER");
      case "EMAIL_CHANNEL_UNAVAILABLE":
        return t("EMAIL_CHANNEL_UNAVAILABLE");
      case "EMAIL_ADDRESS_MISSING":
        return t("EMAIL_ADDRESS_MISSING");
      case "DIGEST_SCHEDULE_INVALID":
        return t("DIGEST_SCHEDULE_INVALID");
      default:
        return t("fallback");
    }
  };
}
