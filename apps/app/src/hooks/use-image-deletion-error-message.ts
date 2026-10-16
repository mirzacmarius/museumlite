import { imageDeletionErrorFromError } from "@v1/backend/convex/utils/imageDeletionErrors";
import { useScopedI18n } from "@/locales/client";
import { useActionErrorMessage } from "./use-action-error-message";

/**
 * Explains why deleting an image, or deciding a deletion request, failed.
 * Approval and permission refusals get the shared copy; anything else gets
 * the caller's translated fallback.
 */
export function useImageDeletionErrorMessage() {
  const t = useScopedI18n("imageDeletion.errors");
  const actionErrorMessage = useActionErrorMessage();
  return (error: unknown, fallback: string) => {
    switch (imageDeletionErrorFromError(error)?.code) {
      case "NOT_AN_IMAGE":
        return t("notAnImage");
      case "DELETION_ALREADY_PENDING":
        return t("alreadyPending");
      case "APPROVAL_SETTING_CHANGED":
        return t("approvalSettingChanged");
      case "IMAGE_CITED_AS_EVIDENCE":
        return t("citedAsEvidence");
      case "DELETION_REQUEST_CLOSED":
        return t("requestClosed");
      case undefined:
        return actionErrorMessage(error, fallback);
    }
  };
}
