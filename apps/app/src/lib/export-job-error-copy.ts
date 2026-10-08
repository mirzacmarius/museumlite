import { capabilityUnavailableFromError } from "@v1/backend/convex/utils/capabilities";
import { ConvexError } from "convex/values";

export type ExportJobErrorKey =
  | "errorAccess"
  | "errorQuota"
  | "errorExpired"
  | "errorNotResumable"
  | "errorSelection"
  | "errorTooLarge"
  | "errorInventoryLinks"
  | "errorInvalidRequest"
  | "errorInterrupted"
  | "errorUnavailable"
  | "failed";

const MESSAGE_KEYS: Array<[RegExp, ExportJobErrorKey]> = [
  [
    /Export unavailable|permission revoked|Permission denied|Authentication required|Not authenticated|Feature requires/i,
    "errorAccess",
  ],
  [/Export limit reached/i, "errorQuota"],
  [/expired/i, "errorExpired"],
  [/cannot resume|still running/i, "errorNotResumable"],
  [/loan associations/i, "errorInventoryLinks"],
  [/exceeds .*(MiB|KiB)|processing limits/i, "errorTooLarge"],
  [
    /Selection|Selected (object|count|exports)|outside export scope/i,
    "errorSelection",
  ],
  [
    /Invalid|Filter outside|Entity type required|filters exceed|Request key already used/i,
    "errorInvalidRequest",
  ],
  [
    /interrupted|checksum mismatch|size mismatch|reconciliation|checkpoint mismatch|Missing export/i,
    "errorInterrupted",
  ],
];

export class ExportDownloadError extends Error {
  status: number;
  constructor(status: number) {
    super(`Export download failed with status ${status}`);
    this.status = status;
  }
}

function errorMessage(error: unknown) {
  if (error instanceof ConvexError)
    return typeof error.data === "string" ? error.data : error.message;
  if (error instanceof Error) return error.message;
  return typeof error === "string" ? error : undefined;
}

/** Map backend export failures and download statuses to locale keys; never echo server text. */
export function exportJobErrorKey(error: unknown): ExportJobErrorKey {
  if (error instanceof ExportDownloadError) {
    if (error.status === 401 || error.status === 403) return "errorAccess";
    if (error.status === 404 || error.status === 409) return "errorUnavailable";
    return "failed";
  }
  if (capabilityUnavailableFromError(error)) return "errorAccess";
  const message = errorMessage(error);
  if (!message) return "failed";
  return (
    MESSAGE_KEYS.find(([pattern]) => pattern.test(message))?.[1] ?? "failed"
  );
}
