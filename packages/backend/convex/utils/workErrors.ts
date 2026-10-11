import { ConvexError } from "convex/values";

/**
 * Stable codes for case task and assignment failures that staff can resolve.
 * Clients map these to translated copy; `message` is English for logs only.
 */
export const WORK_ERROR_CODES = [
  "CASE_NOT_FOUND",
  "TASK_NOT_FOUND",
  "ASSIGNEE_NOT_ELIGIBLE",
  "REVIEWER_NOT_ELIGIBLE",
  "DEPENDENCY_INVALID",
  "DEPENDENCIES_OPEN",
  "STATUS_CHANGED",
  "REVIEW_REQUIRED",
  "REVIEWER_ONLY",
  "EVIDENCE_NOT_FOUND",
  "LIMIT_REACHED",
  "INVALID_INPUT",
  "EVIDENCE_REQUIRED",
  "CASE_NOT_ACCEPTED",
  "RECIPE_NOT_FOUND",
  "RECIPE_INVALID",
  "INCIDENT_NOT_FOUND",
  "NOT_INCIDENT_COORDINATOR",
  "NOT_INCIDENT_RESPONDER",
  "OBJECT_NOT_AFFECTED",
  "PLAN_NOT_AVAILABLE",
  "TASKS_OPEN",
] as const;

export type WorkErrorCode = (typeof WORK_ERROR_CODES)[number];

export const RECIPE_FIELDS = [
  "name",
  "loanDirection",
  "steps",
  "title",
  "description",
  "owner",
  "due",
  "dependsOn",
] as const;

export type RecipeField = (typeof RECIPE_FIELDS)[number];

// Type aliases (not interfaces) so the payload satisfies Convex's Value type.
type WorkErrorDetails = {
  /** Number of dependencies that are still open. */
  openCount?: number;
  /** Evidence kind a suggested task needs before it can be completed. */
  evidenceKind?: string;
  /** Recipe field that failed validation, and the step it belongs to. */
  field?: RecipeField;
  stepIndex?: number;
};

export type WorkErrorData = WorkErrorDetails & {
  code: WorkErrorCode;
  message: string;
};

export function workError(
  code: WorkErrorCode,
  message: string,
  details: WorkErrorDetails = {},
): ConvexError<WorkErrorData> {
  const data: WorkErrorData = { code, message };
  if (details.openCount !== undefined) data.openCount = details.openCount;
  if (details.evidenceKind !== undefined)
    data.evidenceKind = details.evidenceKind;
  if (details.field !== undefined) data.field = details.field;
  if (details.stepIndex !== undefined) data.stepIndex = details.stepIndex;
  return new ConvexError(data);
}

function errorData(error: unknown): unknown {
  if (
    typeof error !== "object" ||
    error === null ||
    !(
      error instanceof ConvexError ||
      ("name" in error && error.name === "ConvexError")
    ) ||
    !("data" in error)
  ) {
    return undefined;
  }
  if (typeof error.data !== "string") return error.data;
  try {
    return JSON.parse(error.data);
  } catch {
    return undefined;
  }
}

/** Reads a work error from a thrown error; null for any other failure. */
export function workErrorFromError(error: unknown): WorkErrorData | null {
  const data = errorData(error);
  if (typeof data !== "object" || data === null || !("code" in data)) {
    return null;
  }
  const code = WORK_ERROR_CODES.find((candidate) => candidate === data.code);
  if (!code) return null;
  const record = data as Record<string, unknown>;
  return {
    code,
    message: typeof record.message === "string" ? record.message : code,
    openCount:
      typeof record.openCount === "number" ? record.openCount : undefined,
    evidenceKind:
      typeof record.evidenceKind === "string" ? record.evidenceKind : undefined,
    field: RECIPE_FIELDS.find((field) => field === record.field),
    stepIndex:
      typeof record.stepIndex === "number" ? record.stepIndex : undefined,
  };
}
