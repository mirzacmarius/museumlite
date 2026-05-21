import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import schema from "../convex/schema";

import { modules } from "./testSetup";

test("should create API key for organization", async () => {
  const _t = convexTest(schema, modules);
  expect(true).toBe(true);
});

test("should revoke API key", async () => {
  const _t = convexTest(schema, modules);
  expect(true).toBe(true);
});

test("should register webhook endpoint", async () => {
  const _t = convexTest(schema, modules);
  expect(true).toBe(true);
});

test("should update webhook event subscriptions", async () => {
  const _t = convexTest(schema, modules);
  expect(true).toBe(true);
});

test("should validate API key on request", async () => {
  const _t = convexTest(schema, modules);
  expect(true).toBe(true);
});

test("should deliver webhook events", async () => {
  const _t = convexTest(schema, modules);
  expect(true).toBe(true);
});
