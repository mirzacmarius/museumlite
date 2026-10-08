import { ConvexError } from "convex/values";

/**
 * Stable codes for webhook administration failures an administrator can fix.
 * Clients map these to translated copy; `message` is English for logs only.
 */
export const WEBHOOK_ERROR_CODES = [
  "WEBHOOK_NAME_REQUIRED",
  "WEBHOOK_URL_INVALID",
  "WEBHOOK_EVENT_UNSUPPORTED",
  "WEBHOOK_LIMIT_REACHED",
  "WEBHOOK_NOT_FOUND",
  "WEBHOOK_DISABLED",
  "WEBHOOK_NOT_SUBSCRIBED",
  "DELIVERY_NOT_FOUND",
  "DELIVERY_NOT_RETRYABLE",
] as const;

export type WebhookErrorCode = (typeof WEBHOOK_ERROR_CODES)[number];

// Type alias (not an interface) so the payload satisfies Convex's Value type.
export type WebhookErrorData = { code: WebhookErrorCode; message: string };

export function webhookError(
  code: WebhookErrorCode,
  message: string,
): ConvexError<WebhookErrorData> {
  return new ConvexError({ code, message });
}

function errorData(error: unknown): unknown {
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

/** Reads a webhook error code from a thrown error; null for any other failure. */
export function webhookErrorCodeFromError(
  error: unknown,
): WebhookErrorCode | null {
  const data = errorData(error);
  if (typeof data !== "object" || data === null || !("code" in data)) {
    return null;
  }
  return WEBHOOK_ERROR_CODES.find((code) => code === data.code) ?? null;
}
