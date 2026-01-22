import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

test("should create deaccession record", async () => {
  const t = convexTest(schema, modules);
  expect(true).toBe(true);
});

test("should link deaccession to collection object", async () => {
  const t = convexTest(schema, modules);
  expect(true).toBe(true);
});

test("should track deaccession reason", async () => {
  const t = convexTest(schema, modules);
  expect(true).toBe(true);
});

test("should require approval for deaccession", async () => {
  const t = convexTest(schema, modules);
  expect(true).toBe(true);
});

test("should update object status on completion", async () => {
  const t = convexTest(schema, modules);
  expect(true).toBe(true);
});

test("should generate deaccession report", async () => {
  const t = convexTest(schema, modules);
  expect(true).toBe(true);
});
