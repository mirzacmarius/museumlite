import { ConvexError } from "convex/values";
import { convexErrorData } from "./convexErrorData";

/**
 * Stable codes for image deletion refusals staff can act on. Clients map these
 * to translated copy; `message` is English for logs only.
 */
export const IMAGE_DELETION_ERROR_CODES = [
  /** Only an object's images can be deleted; documents are kept. */
  "NOT_AN_IMAGE",
  /** The image already has a deletion request waiting for approval. */
  "DELETION_ALREADY_PENDING",
  /** The approval setting changed since the page loaded; reload and retry. */
  "APPROVAL_SETTING_CHANGED",
  /** The image is cited by an assessment, claim, incident, task or request. */
  "IMAGE_CITED_AS_EVIDENCE",
  /** The request was already approved or rejected, or its image is gone. */
  "DELETION_REQUEST_CLOSED",
] as const;

export type ImageDeletionErrorCode =
  (typeof IMAGE_DELETION_ERROR_CODES)[number];

// Type alias (not an interface) so the payload satisfies Convex's Value type.
export type ImageDeletionErrorData = {
  code: ImageDeletionErrorCode;
  message: string;
};

export function imageDeletionError(
  code: ImageDeletionErrorCode,
  message: string,
): ConvexError<ImageDeletionErrorData> {
  return new ConvexError({ code, message });
}

/** Reads an image deletion refusal from a thrown error; null for any other failure. */
export function imageDeletionErrorFromError(
  error: unknown,
): ImageDeletionErrorData | null {
  const data = convexErrorData(error);
  if (typeof data !== "object" || data === null || !("code" in data)) {
    return null;
  }
  const code = IMAGE_DELETION_ERROR_CODES.find(
    (candidate) => candidate === data.code,
  );
  if (!code) return null;
  const message = "message" in data ? data.message : undefined;
  return { code, message: typeof message === "string" ? message : code };
}
