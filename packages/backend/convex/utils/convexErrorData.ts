import { ConvexError } from "convex/values";

/**
 * Payload of a thrown ConvexError, on the server or after it crossed to the
 * client (where `data` may arrive as a JSON string); undefined otherwise.
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
