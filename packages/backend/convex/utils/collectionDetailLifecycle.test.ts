import { describe, expect, test } from "vitest";
import { COLLECTION_DETAIL_LIFECYCLE_MODULES } from "./collectionDetailLifecycle";
import { COLLECTION_MODULE_IDS } from "./moduleCatalog";

describe("collection detail lifecycle", () => {
  test("covers every specialized collection module", () => {
    expect(new Set(COLLECTION_DETAIL_LIFECYCLE_MODULES)).toEqual(
      new Set(COLLECTION_MODULE_IDS),
    );
  });
});
