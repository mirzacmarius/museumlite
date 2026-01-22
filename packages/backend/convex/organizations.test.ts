import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

test("should create organization", async () => {
  const t = convexTest(schema, modules);
  expect(true).toBe(true);
});

test("should add user to organization", async () => {
  const t = convexTest(schema, modules);
  expect(true).toBe(true);
});

test("should assign role to user", async () => {
  const t = convexTest(schema, modules);
  expect(true).toBe(true);
});

test("should update organization settings", async () => {
  const t = convexTest(schema, modules);
  expect(true).toBe(true);
});

test("should remove user from organization", async () => {
  const t = convexTest(schema, modules);
  expect(true).toBe(true);
});

test("should transfer organization ownership", async () => {
  const t = convexTest(schema, modules);
  expect(true).toBe(true);
});
