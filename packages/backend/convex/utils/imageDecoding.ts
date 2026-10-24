import type { Sharp, SharpOptions } from "sharp";

/** Image formats the backend decodes; anything else is refused unread. */
export const DECODABLE_IMAGE_FORMATS = ["jpeg", "png", "webp", "tiff"] as const;
export type DecodableImageFormat = (typeof DECODABLE_IMAGE_FORMATS)[number];

function hasBytes(bytes: Uint8Array, signature: number[], offset = 0) {
  if (bytes.length < offset + signature.length) return false;
  return signature.every((byte, index) => bytes[offset + index] === byte);
}

/**
 * The format an upload's own bytes declare, or null. The type the browser
 * sent with the upload is not consulted: a file named as PNG can hold
 * anything, and only these four formats reach the image library.
 */
export function detectDecodableImageFormat(
  bytes: Uint8Array,
): DecodableImageFormat | null {
  if (hasBytes(bytes, [0xff, 0xd8, 0xff])) return "jpeg";
  if (hasBytes(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    return "png";
  if (
    hasBytes(bytes, [0x52, 0x49, 0x46, 0x46]) &&
    hasBytes(bytes, [0x57, 0x45, 0x42, 0x50], 8)
  )
    return "webp";
  if (
    hasBytes(bytes, [0x49, 0x49, 0x2a, 0x00]) ||
    hasBytes(bytes, [0x4d, 0x4d, 0x00, 0x2a])
  )
    return "tiff";
  return null;
}

export const UNSUPPORTED_IMAGE_FORMAT = "Unsupported image format";

/**
 * Opens an upload with sharp once its bytes prove to be a format we decode,
 * so the image library never parses SVG, HEIF, GIF or arbitrary files.
 * Only Node actions may call this: sharp is a native module.
 */
export async function openDecodableImage(
  source: ArrayBuffer | Uint8Array,
  options?: SharpOptions,
): Promise<Sharp> {
  const bytes = source instanceof Uint8Array ? source : new Uint8Array(source);
  if (!detectDecodableImageFormat(bytes)) {
    throw new Error(UNSUPPORTED_IMAGE_FORMAT);
  }
  const sharp = (await import("sharp")).default;
  return sharp(Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength), {
    ...options,
  });
}
