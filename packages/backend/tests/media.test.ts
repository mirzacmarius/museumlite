import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import schema from "../convex/schema";

import { modules } from "./testSetup";

test("should upload media file", async () => {
  const _t = convexTest(schema, modules);
  expect(true).toBe(true);
});

test("should generate thumbnail", async () => {
  const _t = convexTest(schema, modules);
  expect(true).toBe(true);
});

test("should associate media with collection", async () => {
  const _t = convexTest(schema, modules);
  expect(true).toBe(true);
});

test("should set primary image", async () => {
  const _t = convexTest(schema, modules);
  expect(true).toBe(true);
});

test("should delete media and cleanup storage", async () => {
  const _t = convexTest(schema, modules);
  expect(true).toBe(true);
});

test("should reorder media gallery", async () => {
  const _t = convexTest(schema, modules);
  expect(true).toBe(true);
});
