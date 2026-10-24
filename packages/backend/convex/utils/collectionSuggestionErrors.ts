import { ConvexError } from "convex/values";
import { convexErrorData } from "./convexErrorData";

/**
 * Stable code for collection suggestions refused because their user asked
 * too often. Clients map it to translated copy; `message` is English for logs.
 */
export const SUGGESTIONS_RATE_LIMITED = "SUGGESTIONS_RATE_LIMITED";

// Type alias (not an interface) so the payload satisfies Convex's Value type.
export type SuggestionsRateLimitedData = {
  code: typeof SUGGESTIONS_RATE_LIMITED;
  message: string;
  retryAfter: number;
};

export function suggestionsRateLimited(
  retryAfter: number,
): ConvexError<SuggestionsRateLimitedData> {
  return new ConvexError({
    code: SUGGESTIONS_RATE_LIMITED,
    message: "Too many suggestion requests. Try again in a few minutes.",
    retryAfter,
  });
}

/** Whether a thrown error is the collection suggestion rate limit. */
export function isSuggestionsRateLimited(error: unknown): boolean {
  const data = convexErrorData(error);
  return (
    typeof data === "object" &&
    data !== null &&
    "code" in data &&
    data.code === SUGGESTIONS_RATE_LIMITED
  );
}
