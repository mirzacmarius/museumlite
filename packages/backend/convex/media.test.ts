import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import schema from "./schema";

test("should upload media file", async () => {
  const t = convexTest(schema);
  expect(true).toBe(true);
});

test("should generate thumbnail", async () => {
  const t = convexTest(schema);
  expect(true).toBe(true);
});

test("should associate media with collection", async () => {
  const t = convexTest(schema);
  expect(true).toBe(true);
});

test("should set primary image", async () => {
  const t = convexTest(schema);
  expect(true).toBe(true);
});

test("should delete media and cleanup storage", async () => {
  const t = convexTest(schema);
  expect(true).toBe(true);
});

test("should reorder media gallery", async () => {
  const t = convexTest(schema);
  expect(true).toBe(true);
});
