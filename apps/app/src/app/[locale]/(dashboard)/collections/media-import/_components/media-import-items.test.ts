import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { describe, expect, test } from "vitest";
import {
  mediaSelectionSignature,
  orderMediaFiles,
  planMediaImportItems,
} from "./media-import-items";

const file = (name: string, size = 1, lastModified = 1) => ({
  name,
  size,
  lastModified,
});

describe("media import items", () => {
  test("the same selection gets the same order and signature in any pick order", () => {
    const first = orderMediaFiles([
      file("b.jpg"),
      file("a.jpg"),
      file("a.jpg", 2),
    ]);
    const second = orderMediaFiles([
      file("a.jpg", 2),
      file("b.jpg"),
      file("a.jpg"),
    ]);
    expect(first.map((f) => [f.name, f.size])).toEqual([
      ["a.jpg", 1],
      ["a.jpg", 2],
      ["b.jpg", 1],
    ]);
    expect(mediaSelectionSignature(first)).toBe(
      mediaSelectionSignature(second),
    );
  });

  test("resuming skips accepted items and retries retained originals without uploading", () => {
    const retained = "storage-2" as Id<"_storage">;
    const plan = planMediaImportItems(
      ["a", "b", "c"],
      new Set([1]),
      new Map([[2, retained]]),
    );
    expect(plan).toEqual([
      { kind: "retry-retained", itemNumber: 2, file: "b", storageId: retained },
      { kind: "upload", itemNumber: 3, file: "c" },
    ]);
  });
});
