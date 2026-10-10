import { ConvexError } from "convex/values";
import { convexErrorData as errorData } from "./convexErrorData";

/**
 * Stable codes for approval refusals staff can act on, shared by every case
 * workflow. Clients map these to translated copy; `message` is English for
 * logs only.
 */
export const WORKFLOW_APPROVAL_CODES = [
  /** The organization's workflow has no step to approve at. */
  "WORKFLOW_NOT_CONFIGURED",
  /** The caller's role is not the approver of the current step. */
  "APPROVAL_NOT_PERMITTED",
  /** The caller already approved this step; others still have to. */
  "ALREADY_APPROVED",
] as const;

export type WorkflowApprovalCode = (typeof WORKFLOW_APPROVAL_CODES)[number];

// Type alias (not an interface) so the payload satisfies Convex's Value type.
export type WorkflowApprovalErrorData = {
  code: WorkflowApprovalCode;
  message: string;
};

export function workflowApprovalError(
  code: WorkflowApprovalCode,
  message: string,
): ConvexError<WorkflowApprovalErrorData> {
  return new ConvexError({ code, message });
}

/** Reads a workflow approval refusal from a thrown error; null for any other failure. */
export function workflowApprovalErrorFromError(
  error: unknown,
): WorkflowApprovalErrorData | null {
  const data = errorData(error);
  if (typeof data !== "object" || data === null || !("code" in data)) {
    return null;
  }
  const code = WORKFLOW_APPROVAL_CODES.find(
    (candidate) => candidate === data.code,
  );
  if (!code) return null;
  const message = "message" in data ? data.message : undefined;
  return { code, message: typeof message === "string" ? message : code };
}
