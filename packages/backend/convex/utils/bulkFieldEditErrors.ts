import { ConvexError } from "convex/values";
import { convexErrorData } from "./convexErrorData";

/**
 * Stable codes for refused bulk field edits. Clients map them to translated
 * copy; `message` is English for logs only.
 */
export const BULK_EDIT_ERROR_CODES = [
  "VALUE_REQUIRED",
  "VALUE_TOO_LONG",
  "FIND_REQUIRED",
  "TITLE_REQUIRED",
  "SELECTION_EMPTY",
  "SELECTION_TOO_LARGE",
  "SELECTION_OUTSIDE_ORGANIZATION",
  "FILTER_REQUIRED",
  "EDIT_RUNNING",
  "EDIT_NOT_FOUND",
  "EDIT_NOT_RESUMABLE",
] as const;

export type BulkEditErrorCode = (typeof BULK_EDIT_ERROR_CODES)[number];

// Type alias (not an interface) so the payload satisfies Convex's Value type.
export type BulkEditErrorData = {
  code: BulkEditErrorCode;
  message: string;
};

export function bulkEditError(
  code: BulkEditErrorCode,
  message: string,
): ConvexError<BulkEditErrorData> {
  return new ConvexError({ code, message });
}

/** Reads a bulk edit refusal from a thrown error; null otherwise. */
export function bulkEditErrorFromError(
  error: unknown,
): BulkEditErrorData | null {
  const data = convexErrorData(error);
  if (typeof data !== "object" || data === null) return null;
  const record = data as Record<string, unknown>;
  const code = BULK_EDIT_ERROR_CODES.find(
    (candidate) => candidate === record.code,
  );
  if (!code) return null;
  return {
    code,
    message: typeof record.message === "string" ? record.message : code,
  };
}
