import { ConvexError } from "convex/values";
import { convexErrorData } from "./convexErrorData";

/**
 * Stable code for a tour request refused because too many arrived at once.
 * The marketing site maps it to translated copy; `message` is English for logs.
 */
export const TOUR_REQUEST_RATE_LIMITED = "TOUR_REQUEST_RATE_LIMITED";

// Type alias (not an interface) so the payload satisfies Convex's Value type.
export type TourRequestRateLimitedData = {
  code: typeof TOUR_REQUEST_RATE_LIMITED;
  message: string;
};

export function tourRequestRateLimited(): ConvexError<TourRequestRateLimitedData> {
  return new ConvexError({
    code: TOUR_REQUEST_RATE_LIMITED,
    message: "Too many requests. Please try again later.",
  });
}

/** Whether a thrown error is the tour request rate limit. */
export function isTourRequestRateLimited(error: unknown): boolean {
  const data = convexErrorData(error);
  return (
    typeof data === "object" &&
    data !== null &&
    "code" in data &&
    data.code === TOUR_REQUEST_RATE_LIMITED
  );
}
