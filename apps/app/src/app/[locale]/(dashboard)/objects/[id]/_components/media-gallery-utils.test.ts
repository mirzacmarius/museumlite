import { describe, expect, test } from "vitest";
import {
  getMediaDisplayKind,
  getSketchfabEmbedsFromLinks,
  getSketchfabEmbedUrl,
  getSketchfabModelId,
  isPdfFile,
} from "./media-gallery-utils";

describe("media-gallery-utils", () => {
  test("detects PDF files", () => {
    expect(
      isPdfFile({
        fileName: "report.pdf",
        fileType: "document",
        mimeType: "application/pdf",
      }),
    ).toBe(true);
    expect(
      isPdfFile({
        fileName: "notes.txt",
        fileType: "document",
        mimeType: "text/plain",
      }),
    ).toBe(false);
  });

  test("classifies display kinds", () => {
    expect(
      getMediaDisplayKind({
        fileName: "photo.jpg",
        fileType: "image",
      }),
    ).toBe("image");
    expect(
      getMediaDisplayKind({
        fileName: "scan.pdf",
        fileType: "document",
        mimeType: "application/pdf",
      }),
    ).toBe("pdf");
    expect(
      getMediaDisplayKind({
        fileName: "model.glb",
        fileType: "3d",
      }),
    ).toBe("model3d");
  });

  test("parses Sketchfab model IDs", () => {
    const modelId = "0123456789abcdef0123456789abcdef";
    expect(
      getSketchfabModelId(`https://sketchfab.com/models/${modelId}/embed`),
    ).toBe(modelId);
    expect(
      getSketchfabModelId(
        `https://sketchfab.com/3d-models/test-model-${modelId}`,
      ),
    ).toBe(modelId);
    expect(getSketchfabModelId("https://example.com/model")).toBeNull();
  });

  test("builds Sketchfab embed URLs", () => {
    const modelId = "0123456789abcdef0123456789abcdef";
    const pageUrl = `https://sketchfab.com/3d-models/test-${modelId}`;
    expect(getSketchfabEmbedUrl(pageUrl)).toBe(
      `https://sketchfab.com/models/${modelId}/embed?autostart=0&ui_controls=1&ui_infos=0`,
    );
  });

  test("maps collection links to embed items", () => {
    const modelId = "0123456789abcdef0123456789abcdef";
    const embeds = getSketchfabEmbedsFromLinks([
      { url: `https://sketchfab.com/models/${modelId}`, label: "3D" },
      { url: "https://museum.org/record", label: "Record" },
    ]);
    expect(embeds).toHaveLength(1);
    expect(embeds[0]?.embedUrl).toContain(modelId);
  });
});
