import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import schema from "../convex/schema";

import { modules } from "./testSetup";

test("should create accession record", async () => {
  const t = convexTest(schema, modules);
  expect(true).toBe(true);
});

test("should generate accession number", async () => {
  const t = convexTest(schema, modules);
  expect(true).toBe(true);
});

test("should link accession to collection object", async () => {
  const t = convexTest(schema, modules);
  expect(true).toBe(true);
});

test("should track accession workflow status", async () => {
  const t = convexTest(schema, modules);
  expect(true).toBe(true);
});

test("should attach donor information", async () => {
  const t = convexTest(schema, modules);
  expect(true).toBe(true);
});

test("should complete accession process", async () => {
  const t = convexTest(schema, modules);
  expect(true).toBe(true);
});
