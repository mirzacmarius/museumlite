import { ConvexError } from "convex/values";

/** Why a detail page cannot show its record, each with its own recovery. */
export type RecordRecoveryKind =
  | "missing"
  | "removed"
  | "forbidden"
  | "unavailable"
  | "error";

function errorCode(error: unknown): string | undefined {
  if (!(error instanceof ConvexError)) return undefined;
  let data: unknown = error.data;
  if (typeof data === "string") {
    try {
      data = JSON.parse(data);
    } catch {
      return undefined;
    }
  }
  return typeof data === "object" &&
    data !== null &&
    "code" in data &&
    typeof data.code === "string"
    ? data.code
    : undefined;
}

/** Classifies an error thrown while reading a record for a detail page. */
export function recordErrorKind(
  error: unknown,
): Exclude<RecordRecoveryKind, "removed"> {
  const code = errorCode(error);
  if (code === "RECORD_FORBIDDEN") return "forbidden";
  if (code === "CAPABILITY_UNAVAILABLE") return "unavailable";
  if (code !== undefined) return "error";
  const message = error instanceof Error ? error.message : "";
  if (/Feature requires \w+ tier/.test(message)) return "unavailable";
  if (/ArgumentValidationError[\s\S]*Validator: v\.id\(/.test(message)) {
    return "missing";
  }
  return "error";
}

/**
 * The state of a reactive record read. A record that was shown and then
 * disappears was removed while open, which needs different copy from a link
 * that never resolved.
 */
export function recordViewState<Row>(
  record: Row | null | undefined,
  wasShown: boolean,
): "loading" | "ready" | "missing" | "removed" {
  if (record === undefined) return "loading";
  if (record === null) return wasShown ? "removed" : "missing";
  return "ready";
}
