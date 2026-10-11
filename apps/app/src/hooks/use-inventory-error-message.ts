import {
  type InventoryErrorData,
  inventoryErrorFromError,
} from "@v1/backend/convex/utils/inventoryErrors";
import { useScopedI18n } from "@/locales/client";
import { useActionErrorMessage } from "./use-action-error-message";

/**
 * Translates inventory failures, then custody conflicts from the guarded
 * movement command and missing capabilities. Server text is never shown.
 */
export function useInventoryErrorMessage() {
  const t = useScopedI18n("inventory.errors");
  const actionMessage = useActionErrorMessage();
  function codeMessage({ code, limit }: InventoryErrorData) {
    switch (code) {
      case "NAME_REQUIRED":
        return t("nameRequired");
      case "TEXT_TOO_LONG":
        return t("textTooLong");
      case "LOCATION_NOT_FOUND":
        return t("locationNotFound");
      case "SCOPE_TOO_LARGE":
        return t("scopeTooLarge", { limit: limit ?? "" });
      case "SESSION_NOT_FOUND":
        return t("sessionNotFound");
      case "SESSION_NOT_SCANNING":
        return t("sessionNotScanning");
      case "LOCATION_OUT_OF_SCOPE":
        return t("locationOutOfScope");
      case "SCAN_VALUE_REQUIRED":
        return t("scanValueRequired");
      case "OBSERVATION_LIMIT_REACHED":
        return t("observationLimitReached", { limit: limit ?? "" });
      case "EXCEPTION_NOT_FOUND":
        return t("exceptionNotFound");
      case "EXCEPTION_CLOSED":
        return t("exceptionClosed");
      case "EXCEPTION_NOT_MOVABLE":
        return t("exceptionNotMovable");
      case "REASON_REQUIRED":
        return t("reasonRequired");
    }
  }

  return (error: unknown) => {
    const data = inventoryErrorFromError(error);
    if (data) return codeMessage(data);
    return actionMessage(error, t("fallback"));
  };
}
