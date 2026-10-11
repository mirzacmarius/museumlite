import { ConvexError } from "convex/values";
import { convexErrorData } from "./convexErrorData";

/**
 * Stable codes for inventory failures that staff can act on. Clients map
 * them to translated copy; `message` is English for logs only.
 */
export const INVENTORY_ERROR_CODES = [
  "NAME_REQUIRED",
  "TEXT_TOO_LONG",
  "LOCATION_NOT_FOUND",
  "SCOPE_TOO_LARGE",
  "SESSION_NOT_FOUND",
  "SESSION_NOT_SCANNING",
  "LOCATION_OUT_OF_SCOPE",
  "SCAN_VALUE_REQUIRED",
  "OBSERVATION_LIMIT_REACHED",
  "EXCEPTION_NOT_FOUND",
  "EXCEPTION_CLOSED",
  "EXCEPTION_NOT_MOVABLE",
  "REASON_REQUIRED",
] as const;

export type InventoryErrorCode = (typeof INVENTORY_ERROR_CODES)[number];

// Type alias (not an interface) so the payload satisfies Convex's Value type.
export type InventoryErrorData = {
  code: InventoryErrorCode;
  message: string;
  /** The largest scope or count allowed, for the *_TOO_LARGE / LIMIT codes. */
  limit?: number;
};

export function inventoryError(
  code: InventoryErrorCode,
  message: string,
  details: { limit?: number } = {},
): ConvexError<InventoryErrorData> {
  const data: InventoryErrorData = { code, message };
  if (details.limit !== undefined) data.limit = details.limit;
  return new ConvexError(data);
}

/** Reads an inventory failure from a thrown error; null otherwise. */
export function inventoryErrorFromError(
  error: unknown,
): InventoryErrorData | null {
  const data = convexErrorData(error);
  if (typeof data !== "object" || data === null) return null;
  const record = data as Record<string, unknown>;
  const code = INVENTORY_ERROR_CODES.find(
    (candidate) => candidate === record.code,
  );
  if (!code) return null;
  const result: InventoryErrorData = {
    code,
    message: typeof record.message === "string" ? record.message : code,
  };
  if (typeof record.limit === "number") result.limit = record.limit;
  return result;
}
