import { ConvexError } from "convex/values";
import { convexErrorData } from "./convexErrorData";

/**
 * Stable code for an upload refused because its user started too many at
 * once. Clients map it to translated copy; `message` is English for logs.
 */
export const UPLOAD_RATE_LIMITED = "UPLOAD_RATE_LIMITED";

// Type alias (not an interface) so the payload satisfies Convex's Value type.
export type UploadRateLimitedData = {
  code: typeof UPLOAD_RATE_LIMITED;
  message: string;
  retryAfter: number;
};

export function uploadRateLimited(
  retryAfter: number,
): ConvexError<UploadRateLimitedData> {
  return new ConvexError({
    code: UPLOAD_RATE_LIMITED,
    message: "Too many uploads at once. Try again in a minute.",
    retryAfter,
  });
}

/** Whether a thrown error is the upload rate limit. */
export function isUploadRateLimited(error: unknown): boolean {
  const data = convexErrorData(error);
  return (
    typeof data === "object" &&
    data !== null &&
    "code" in data &&
    data.code === UPLOAD_RATE_LIMITED
  );
}
