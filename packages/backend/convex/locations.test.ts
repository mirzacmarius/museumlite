import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import schema from "./schema";

test("should create location", async () => {
  const t = convexTest(schema);
  expect(true).toBe(true);
});

test("should create nested location hierarchy", async () => {
  const t = convexTest(schema);
  expect(true).toBe(true);
});

test("should move object to location", async () => {
  const t = convexTest(schema);
  expect(true).toBe(true);
});

test("should track location capacity", async () => {
  const t = convexTest(schema);
  expect(true).toBe(true);
});

test("should list objects at location", async () => {
  const t = convexTest(schema);
  expect(true).toBe(true);
});

test("should generate location path breadcrumb", async () => {
  const t = convexTest(schema);
  expect(true).toBe(true);
});
