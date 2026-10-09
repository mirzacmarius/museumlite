import { ConvexError } from "convex/values";
import { convexErrorData } from "./convexErrorData";

/**
 * Stable codes for entry failures that staff can resolve. Clients map these
 * to translated copy; `message` is English for logs only.
 */
export const ENTRY_ERROR_CODES = [
  "ENTRY_NOT_FOUND",
  "ENTRY_DEPOSITOR_REQUIRED",
  "ENTRY_TITLE_REQUIRED",
  "ENTRY_CONDITION_REQUIRED",
  "ENTRY_TEXT_TOO_LONG",
  "ENTRY_DATES_INVALID",
  "ENTRY_RESPONSIBLE_NOT_MEMBER",
  "ENTRY_NUMBER_IN_USE",
  "ENTRY_NUMBER_INVALID",
  "ENTRY_NUMBERING_EXHAUSTED",
  "ENTRY_NOT_IN_CUSTODY",
  "ENTRY_ACQUISITION_OPEN",
  "ENTRY_ACQUISITION_IN_REVIEW",
  "ENTRY_REASON_REQUIRED",
  "ENTRY_CLOSED",
  "ENTRY_OWNER_REQUIRED",
  "ENTRY_RECIPIENT_REQUIRED",
  "ENTRY_TEMPORARY_CUSTODY",
  "ENTRY_EXITED",
  "ENTRY_EXIT_REQUIRED",
  "ENTRY_OBJECT_RECORDED",
] as const;

export type EntryErrorCode = (typeof ENTRY_ERROR_CODES)[number];

// Type alias (not an interface) so the payload satisfies Convex's Value type.
export type EntryErrorData = { code: EntryErrorCode; message: string };

export function entryError(
  code: EntryErrorCode,
  message: string,
): ConvexError<EntryErrorData> {
  return new ConvexError({ code, message });
}

/** Reads an entry error from a thrown error; null for any other failure. */
export function entryErrorFromError(error: unknown): EntryErrorData | null {
  const data = convexErrorData(error);
  if (typeof data !== "object" || data === null || !("code" in data)) {
    return null;
  }
  const code = ENTRY_ERROR_CODES.find((candidate) => candidate === data.code);
  if (!code) return null;
  const message = "message" in data ? data.message : undefined;
  return { code, message: typeof message === "string" ? message : code };
}
