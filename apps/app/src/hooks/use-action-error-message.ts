import * as Sentry from "@sentry/nextjs";
import { custodyConflictFromError } from "@v1/backend/convex/utils/custodyErrors";
import { workErrorFromError } from "@v1/backend/convex/utils/workErrors";
import { workflowApprovalErrorFromError } from "@v1/backend/convex/utils/workflowApprovalErrors";
import { useCapabilityErrorMessage } from "./use-capability-error-message";
import { useCustodyConflictMessage } from "./use-custody-conflict-message";
import { useImportRefusalMessage } from "./use-import-refusal-message";
import { useLoanObjectErrorMessage } from "./use-loan-object-error-message";
import { useWithdrawalErrorMessage } from "./use-withdrawal-error-message";
import { useWorkErrorMessage } from "./use-work-error-message";
import { useWorkflowApprovalErrorMessage } from "./use-workflow-approval-error-message";

/**
 * Explains why a staff action failed, in the app's language. Coded refusals
 * get their own copy, in this order: custody conflicts, approval steps, case
 * tasks, loan objects, import refusals, Withdrawals, then missing
 * capabilities. Anything else is reported to Sentry, so new uncoded refusals
 * are noticed, and gets the caller's translated fallback. Server error text
 * is never shown: production replaces it with "Server Error", and it is
 * English in every locale.
 */
export function useActionErrorMessage() {
  const custodyMessage = useCustodyConflictMessage();
  const approvalMessage = useWorkflowApprovalErrorMessage();
  const workMessage = useWorkErrorMessage();
  const loanObjectMessage = useLoanObjectErrorMessage();
  const importMessage = useImportRefusalMessage();
  const withdrawalMessage = useWithdrawalErrorMessage();
  const capabilityMessage = useCapabilityErrorMessage();
  return (error: unknown, fallback: string): string => {
    if (custodyConflictFromError(error)) return custodyMessage(error);
    if (workflowApprovalErrorFromError(error)) {
      return approvalMessage(error, fallback);
    }
    if (workErrorFromError(error)) return workMessage(error) ?? fallback;
    const coded =
      loanObjectMessage(error) ??
      importMessage(error) ??
      withdrawalMessage(error) ??
      capabilityMessage(error);
    if (coded !== null) return coded;
    Sentry.captureException(error);
    return fallback;
  };
}
