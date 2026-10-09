import { ConvexError } from "convex/values";

/**
 * Structured data carried by a thrown ConvexError, or undefined for any other
 * failure. Some transports hand the data back as a JSON string.
 */
export function convexErrorData(error: unknown): unknown {
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
