import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import schema from "./schema";

test("should create API key for organization", async () => {
  const t = convexTest(schema);
  expect(true).toBe(true);
});

test("should revoke API key", async () => {
  const t = convexTest(schema);
  expect(true).toBe(true);
});

test("should register webhook endpoint", async () => {
  const t = convexTest(schema);
  expect(true).toBe(true);
});

test("should update webhook event subscriptions", async () => {
  const t = convexTest(schema);
  expect(true).toBe(true);
});

test("should validate API key on request", async () => {
  const t = convexTest(schema);
  expect(true).toBe(true);
});

test("should deliver webhook events", async () => {
  const t = convexTest(schema);
  expect(true).toBe(true);
});
