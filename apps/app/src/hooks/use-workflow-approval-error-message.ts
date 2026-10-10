import { workflowApprovalErrorFromError } from "@v1/backend/convex/utils/workflowApprovalErrors";
import { useScopedI18n } from "@/locales/client";
import { useCapabilityErrorMessage } from "./use-capability-error-message";

/**
 * Translates approval refusals shared by every case workflow, and capability
 * refusals. Any other failure gets the caller's translated fallback; server
 * error text is never shown.
 */
export function useWorkflowApprovalErrorMessage() {
  const t = useScopedI18n("workflowApprovals.errors");
  const capabilityMessage = useCapabilityErrorMessage();
  return (error: unknown, fallback: string) => {
    switch (workflowApprovalErrorFromError(error)?.code) {
      case "WORKFLOW_NOT_CONFIGURED":
        return t("workflowNotConfigured");
      case "APPROVAL_NOT_PERMITTED":
        return t("approvalNotPermitted");
      case "ALREADY_APPROVED":
        return t("alreadyApproved");
      case undefined:
        return capabilityMessage(error) ?? fallback;
    }
  };
}
