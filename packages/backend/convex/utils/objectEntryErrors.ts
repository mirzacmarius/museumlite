import { ConvexError } from "convex/values";
import { convexErrorData } from "./convexErrorData";

/**
 * Stable codes for entry failures that staff can resolve. Clients map these
 * to translated copy; `message` is English for logs only.
 */
export const ENTRY_ERROR_CODES = [
  "ENTRY_NOT_FOUND",
  "DEPOSITOR_REQUIRED",
  "TITLE_REQUIRED",
  "CONDITION_REQUIRED",
  "TEXT_TOO_LONG",
  "DATES_INVALID",
  "RESPONSIBLE_NOT_MEMBER",
  "NUMBER_IN_USE",
  "NUMBERING_EXHAUSTED",
  "NOT_IN_CUSTODY",
  "ACQUISITION_OPEN",
  "ENTRY_CLOSED",
  "OWNER_REQUIRED",
  "RECIPIENT_REQUIRED",
  "TEMPORARY_CUSTODY",
  "ENTRY_EXITED",
  "OBJECT_RECORDED_ON_ENTRY",
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
