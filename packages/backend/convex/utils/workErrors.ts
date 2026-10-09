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
] as const;

export type WorkErrorCode = (typeof WORK_ERROR_CODES)[number];

// Type alias (not an interface) so the payload satisfies Convex's Value type.
export type WorkErrorData = {
  code: WorkErrorCode;
  message: string;
  /** Number of dependencies that are still open. */
  openCount?: number;
};

export function workError(
  code: WorkErrorCode,
  message: string,
  details: { openCount?: number } = {},
): ConvexError<WorkErrorData> {
  const data: WorkErrorData = { code, message };
  if (details.openCount !== undefined) data.openCount = details.openCount;
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
  };
}
