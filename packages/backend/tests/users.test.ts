import { convexTest } from "convex-test";
import { beforeEach, describe, expect, test } from "vitest";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import schema from "../convex/schema";

import { modules } from "./testSetup";

describe("user avatar upload validation", () => {
  let t: ReturnType<typeof convexTest>;
  let userId: Id<"users">;

  beforeEach(async () => {
    t = convexTest(schema, modules);

    userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        name: "Test User",
        email: "test@example.com",
      });
    });
  });

  test("should accept image/jpeg MIME type", async () => {
    const authed = t.withIdentity({
      subject: `${userId}|session-setup`,
      issuer: "https://example.test",
    });

    const uploadUrl = await authed.mutation(api.users.generateUploadUrl, {
      mimeType: "image/jpeg",
    });

    expect(uploadUrl).toBeDefined();
    expect(typeof uploadUrl).toBe("string");
  });

  test("should accept image/png MIME type", async () => {
    const authed = t.withIdentity({
      subject: `${userId}|session-setup`,
      issuer: "https://example.test",
    });

    const uploadUrl = await authed.mutation(api.users.generateUploadUrl, {
      mimeType: "image/png",
    });

    expect(uploadUrl).toBeDefined();
    expect(typeof uploadUrl).toBe("string");
  });

  test("should accept image/webp MIME type", async () => {
    const authed = t.withIdentity({
      subject: `${userId}|session-setup`,
      issuer: "https://example.test",
    });

    const uploadUrl = await authed.mutation(api.users.generateUploadUrl, {
      mimeType: "image/webp",
    });

    expect(uploadUrl).toBeDefined();
    expect(typeof uploadUrl).toBe("string");
  });

  test("should reject image/svg+xml MIME type", async () => {
    const authed = t.withIdentity({
      subject: `${userId}|session-setup`,
      issuer: "https://example.test",
    });

    await expect(
      authed.mutation(api.users.generateUploadUrl, {
        mimeType: "image/svg+xml",
      }),
    ).rejects.toThrow("Unsupported file type: image/svg+xml");
  });

  test("should reject application/pdf MIME type", async () => {
    const authed = t.withIdentity({
      subject: `${userId}|session-setup`,
      issuer: "https://example.test",
    });

    await expect(
      authed.mutation(api.users.generateUploadUrl, {
        mimeType: "application/pdf",
      }),
    ).rejects.toThrow("Unsupported file type: application/pdf");
  });

  test("should reject text/html MIME type", async () => {
    const authed = t.withIdentity({
      subject: `${userId}|session-setup`,
      issuer: "https://example.test",
    });

    await expect(
      authed.mutation(api.users.generateUploadUrl, {
        mimeType: "text/html",
      }),
    ).rejects.toThrow("Unsupported file type: text/html");
  });

  test("should throw descriptive error for invalid MIME type", async () => {
    const authed = t.withIdentity({
      subject: `${userId}|session-setup`,
      issuer: "https://example.test",
    });

    const invalidMimeType = "application/x-executable";

    await expect(
      authed.mutation(api.users.generateUploadUrl, {
        mimeType: invalidMimeType,
      }),
    ).rejects.toThrow(`Unsupported file type: ${invalidMimeType}`);
  });

  test("should require authentication", async () => {
    // Test without authentication
    await expect(
      t.mutation(api.users.generateUploadUrl, {
        mimeType: "image/jpeg",
      }),
    ).rejects.toThrow("User not found");
  });
});
