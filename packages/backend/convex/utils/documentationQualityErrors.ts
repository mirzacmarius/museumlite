import { ConvexError } from "convex/values";
import { convexErrorData } from "./convexErrorData";

/**
 * Stable codes for documentation quality failures that staff can resolve.
 * Clients map them to translated copy; `message` is English for logs only.
 */
export const QUALITY_ERROR_CODES = [
  "PROFILE_INVALID",
  "PROFILE_LIMIT_REACHED",
  "PROFILE_NOT_FOUND",
  "CHECK_RUNNING",
  "FINDING_NOT_FOUND",
  "FINDING_STATUS_CHANGED",
  "REVIEW_NOTE_REQUIRED",
  "IDENTIFIER_INDEX_INCOMPLETE",
  "DUPLICATE_GROUP_TOO_LARGE",
  "REVIEWED_IN_IDENTIFIER_REGISTER",
] as const;

export type QualityErrorCode = (typeof QUALITY_ERROR_CODES)[number];

export const PROFILE_FIELDS = [
  "name",
  "objectType",
  "stages",
  "requirements",
] as const;

export type ProfileField = (typeof PROFILE_FIELDS)[number];

// Type alias (not an interface) so the payload satisfies Convex's Value type.
export type QualityErrorData = {
  code: QualityErrorCode;
  message: string;
  /** The profile field to correct, for PROFILE_INVALID. */
  field?: ProfileField;
};

export function qualityError(
  code: QualityErrorCode,
  message: string,
  details: { field?: ProfileField } = {},
): ConvexError<QualityErrorData> {
  const data: QualityErrorData = { code, message };
  if (details.field !== undefined) data.field = details.field;
  return new ConvexError(data);
}

/** Reads a documentation quality failure from a thrown error; null otherwise. */
export function qualityErrorFromError(error: unknown): QualityErrorData | null {
  const data = convexErrorData(error);
  if (typeof data !== "object" || data === null) return null;
  const record = data as Record<string, unknown>;
  const code = QUALITY_ERROR_CODES.find(
    (candidate) => candidate === record.code,
  );
  if (!code) return null;
  const result: QualityErrorData = {
    code,
    message: typeof record.message === "string" ? record.message : code,
  };
  const field = PROFILE_FIELDS.find((candidate) => candidate === record.field);
  if (field) result.field = field;
  return result;
}
