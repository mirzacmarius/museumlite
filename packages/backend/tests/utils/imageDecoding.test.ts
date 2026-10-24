import { describe, expect, test } from "vitest";
import {
  detectDecodableImageFormat,
  openDecodableImage,
  UNSUPPORTED_IMAGE_FORMAT,
} from "../../convex/utils/imageDecoding";

const bytes = (...values: number[]) => new Uint8Array(values);
const text = (value: string) => new TextEncoder().encode(value);

// A 1x1 transparent PNG.
const PNG = Uint8Array.from(
  atob(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  ),
  (character) => character.charCodeAt(0),
);

describe("detectDecodableImageFormat", () => {
  test("recognises the four decodable formats by their own bytes", () => {
    expect(detectDecodableImageFormat(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe(
      "jpeg",
    );
    expect(detectDecodableImageFormat(PNG)).toBe("png");
    expect(detectDecodableImageFormat(text("RIFF\0\0\0\0WEBPVP8 "))).toBe(
      "webp",
    );
    expect(detectDecodableImageFormat(bytes(0x49, 0x49, 0x2a, 0x00))).toBe(
      "tiff",
    );
    expect(detectDecodableImageFormat(bytes(0x4d, 0x4d, 0x00, 0x2a))).toBe(
      "tiff",
    );
  });

  test("refuses every other file, whatever type the upload declared", () => {
    for (const sample of [
      text('<svg xmlns="http://www.w3.org/2000/svg"></svg>'),
      text("<!doctype html><script>alert(1)</script>"),
      text("GIF89a"),
      text("\0\0\0 ftypavif"),
      text("\0\0\0 ftypheic"),
      text("RIFF\0\0\0\0WAVE"),
      text("%PDF-1.7"),
      bytes(0xff, 0xd8),
      bytes(),
    ]) {
      expect(detectDecodableImageFormat(sample)).toBeNull();
    }
  });
});

describe("openDecodableImage", () => {
  test("throws before the image library sees an unsupported file", async () => {
    await expect(openDecodableImage(text("<svg/>"))).rejects.toThrow(
      UNSUPPORTED_IMAGE_FORMAT,
    );
    await expect(
      openDecodableImage(text("GIF89a").buffer as ArrayBuffer),
    ).rejects.toThrow(UNSUPPORTED_IMAGE_FORMAT);
  });

  test("opens a decodable image", async () => {
    const image = await openDecodableImage(PNG);
    const metadata = await image.metadata();
    expect(metadata.format).toBe("png");
    expect([metadata.width, metadata.height]).toEqual([1, 1]);
  });
});
