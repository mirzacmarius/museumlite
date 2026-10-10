import { ConvexError } from "convex/values";
import { convexErrorData } from "./convexErrorData";

/**
 * Stable codes for environmental monitoring failures staff can correct.
 * Clients map these to translated copy.
 */
export const ALERT_EPISODE_ERROR_CODES = [
  "THRESHOLDS_INVALID",
  "EPISODE_NOT_OPEN",
  "RESOLUTION_NOTE_INVALID",
] as const;

export type AlertEpisodeErrorCode = (typeof ALERT_EPISODE_ERROR_CODES)[number];

// Type alias (not an interface) so the payload satisfies Convex's Value type.
export type AlertEpisodeErrorData = { code: AlertEpisodeErrorCode };

export function alertEpisodeError(
  code: AlertEpisodeErrorCode,
): ConvexError<AlertEpisodeErrorData> {
  return new ConvexError({ code });
}

/** Reads an alert episode error code from a thrown error; null otherwise. */
export function alertEpisodeErrorCodeFromError(
  error: unknown,
): AlertEpisodeErrorCode | null {
  const data = convexErrorData(error);
  if (typeof data !== "object" || data === null || !("code" in data)) {
    return null;
  }
  return ALERT_EPISODE_ERROR_CODES.find((code) => code === data.code) ?? null;
}
