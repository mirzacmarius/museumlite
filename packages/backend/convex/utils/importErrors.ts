import { ConvexError } from "convex/values";
import { convexErrorData as errorData } from "./convexErrorData";

/**
 * Stable codes for imports the server refuses after upload. Clients map these
 * to translated copy with the numbers they carry; `message` is English for
 * logs only.
 */
export const IMPORT_REFUSAL_CODES = [
  /** Missing, or another organization's: the two are not told apart. */
  "IMPORT_JOB_NOT_FOUND",
  /** The job was started for another record type. */
  "IMPORT_JOB_WRONG_TYPE",
  "IMPORT_JOB_CANCELLED",
  "IMPORT_JOB_FAILED",
  /** More rows than one import takes; carries `limit`. */
  "IMPORT_TOO_MANY_ROWS",
  /** A corrected file has a row the original did not; carries `row`. */
  "IMPORT_ROW_NOT_IN_IMPORT",
  "DUBLIN_CORE_NO_RECORDS",
  /** More records than one Dublin Core file takes; carries `limit`. */
  "DUBLIN_CORE_TOO_MANY_RECORDS",
  /** A resumed Dublin Core file has a different record count. */
  "DUBLIN_CORE_RECORD_COUNT_CHANGED",
] as const;

export type ImportRefusalCode = (typeof IMPORT_REFUSAL_CODES)[number];

// Type alias (not an interface) so the payload satisfies Convex's Value type.
export type ImportRefusalData = {
  code: ImportRefusalCode;
  message: string;
  limit?: number;
  row?: number;
};

type Details = Pick<ImportRefusalData, "limit" | "row">;

const MESSAGES: Record<ImportRefusalCode, (details: Details) => string> = {
  IMPORT_JOB_NOT_FOUND: () => "Import job not found",
  IMPORT_JOB_WRONG_TYPE: () => "Import job belongs to a different record type",
  IMPORT_JOB_CANCELLED: () =>
    "This import was cancelled. Start a new import to continue.",
  IMPORT_JOB_FAILED: () => "This import failed and cannot accept more items.",
  IMPORT_TOO_MANY_ROWS: ({ limit }) =>
    `An import must contain between 1 and ${limit} rows`,
  IMPORT_ROW_NOT_IN_IMPORT: ({ row }) =>
    `Row ${row} is not part of this import. A corrected file must keep the same rows in the same order.`,
  DUBLIN_CORE_NO_RECORDS: () => "No valid Dublin Core records found in XML",
  DUBLIN_CORE_TOO_MANY_RECORDS: ({ limit }) =>
    `A Dublin Core file can contain at most ${limit} records`,
  DUBLIN_CORE_RECORD_COUNT_CHANGED: () =>
    "This XML has a different number of records than the original import",
};

export function importRefusal(
  code: ImportRefusalCode,
  details: Details = {},
): ConvexError<ImportRefusalData> {
  return new ConvexError({
    code,
    message: MESSAGES[code](details),
    ...details,
  });
}

/** Reads an import refusal from a thrown error; null for any other failure. */
export function importRefusalFromError(
  error: unknown,
): ImportRefusalData | null {
  const data = errorData(error);
  if (typeof data !== "object" || data === null || !("code" in data)) {
    return null;
  }
  const code = IMPORT_REFUSAL_CODES.find(
    (candidate) => candidate === data.code,
  );
  if (!code) return null;
  const details: Details = {};
  if ("limit" in data && typeof data.limit === "number") {
    details.limit = data.limit;
  }
  if ("row" in data && typeof data.row === "number") details.row = data.row;
  return { code, message: MESSAGES[code](details), ...details };
}
