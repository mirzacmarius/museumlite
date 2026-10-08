import { ConvexError } from "convex/values";

/**
 * Stable codes for custody and movement conflicts that staff can resolve.
 * Clients map these to translated copy; `message` is English for logs only.
 */
export const CUSTODY_CONFLICT_CODES = [
  "SOURCE_CHANGED",
  "ALREADY_AT_DESTINATION",
  "DESTINATION_UNAVAILABLE",
  "DESTINATION_FULL",
  "DESTINATION_REQUIRED",
  "EXTERNAL_CUSTODY",
  "ASSESSMENT_REQUIRED",
  "ASSESSMENT_NOT_ACCEPTED",
  "CONDITION_EVIDENCE_REQUIRED",
  "REFERENCE_NOT_FOUND",
  "HANDOFF_ALREADY_RECORDED",
  "HANDOFF_OUT_OF_ORDER",
  "EXHIBITION_OUTCOME_UNRESOLVED",
  "CLOSURE_BLOCKED",
] as const;

export type CustodyConflictCode = (typeof CUSTODY_CONFLICT_CODES)[number];

// Type aliases (not interfaces) so the payload satisfies Convex's Value type.
export type CustodyConflictDetails = {
  /** Where the object is now; null when it has no recorded location. */
  currentLocationName?: string | null;
  locationName?: string;
  capacity?: number;
  outstandingCount?: number;
};

export type CustodyConflictData = CustodyConflictDetails & {
  code: CustodyConflictCode;
  message: string;
};

export function custodyConflict(
  code: CustodyConflictCode,
  message: string,
  details: CustodyConflictDetails = {},
): ConvexError<CustodyConflictData> {
  const data: CustodyConflictData = { code, message };
  if (details.currentLocationName !== undefined)
    data.currentLocationName = details.currentLocationName;
  if (details.locationName !== undefined)
    data.locationName = details.locationName;
  if (details.capacity !== undefined) data.capacity = details.capacity;
  if (details.outstandingCount !== undefined)
    data.outstandingCount = details.outstandingCount;
  return new ConvexError(data);
}

/** Payload of a ConvexError, whether thrown in-process or received by a client. */
export function errorData(error: unknown): unknown {
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

function optionalString(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function optionalNumber(value: unknown) {
  return typeof value === "number" ? value : undefined;
}

/** Reads a custody conflict from a thrown error; null for any other failure. */
export function custodyConflictFromError(
  error: unknown,
): CustodyConflictData | null {
  const data = errorData(error);
  if (typeof data !== "object" || data === null || !("code" in data)) {
    return null;
  }
  const code = CUSTODY_CONFLICT_CODES.find(
    (candidate) => candidate === data.code,
  );
  if (!code) return null;
  const record = data as Record<string, unknown>;
  const current = record.currentLocationName;
  return {
    code,
    message: optionalString(record.message) ?? code,
    currentLocationName: current === null ? null : optionalString(current),
    locationName: optionalString(record.locationName),
    capacity: optionalNumber(record.capacity),
    outstandingCount: optionalNumber(record.outstandingCount),
  };
}

/** Server-side readable message for stored batch results and logs. */
export function errorMessageForRecord(error: unknown): string {
  const conflict = custodyConflictFromError(error);
  if (conflict) return conflict.message;
  return error instanceof Error ? error.message : "Unknown error";
}
