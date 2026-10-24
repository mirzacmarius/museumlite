import { afterEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import { ABANDONED_UPLOAD_AGE_MS, UPLOAD_URL_BURST } from "../convex/users";
import {
  authedForUser,
  type ConvexTest,
  createConvexTestWithRateLimiter,
} from "./testHarness";

const DAY = ABANDONED_UPLOAD_AGE_MS;

async function insertUser(t: ConvexTest) {
  return await t.run(async (ctx) =>
    ctx.db.insert("users", { name: "Uploader", email: "uploader@example.com" }),
  );
}

/**
 * A file that went through the owned-upload flow `ageMs` ago. A `legacy`
 * row predates the cleanup and carries no unclaimed marker.
 */
async function storeUpload(
  t: ConvexTest,
  options: {
    uploadedBy: Id<"users">;
    ageMs: number;
    contentType?: string;
    ownerId?: string;
    legacy?: boolean;
  },
) {
  return await t.run(async (ctx) => {
    const storageId = await ctx.storage.store(
      new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], {
        type: options.contentType ?? "image/png",
      }),
    );
    await ctx.db.insert("storageOwnership", {
      storageId,
      uploadedBy: options.uploadedBy,
      contentType: options.contentType ?? "image/png",
      uploadedAt: Date.now() - options.ageMs,
      ...(options.ownerId
        ? { ownerType: "userAvatar", ownerId: options.ownerId }
        : options.legacy
          ? {}
          : { unclaimedSince: Date.now() - options.ageMs }),
    });
    return storageId;
  });
}

async function ownershipRow(t: ConvexTest, storageId: Id<"_storage">) {
  return await t.run(async (ctx) =>
    ctx.db
      .query("storageOwnership")
      .withIndex("by_storageId", (q) => q.eq("storageId", storageId))
      .unique(),
  );
}

async function storedFile(t: ConvexTest, storageId: Id<"_storage">) {
  return await t.run(async (ctx) => ctx.db.system.get("_storage", storageId));
}

describe("abandoned uploads", () => {
  test("a day-old upload nobody attached goes with its file; fresh, attached and older ones stay", async () => {
    const t = createConvexTestWithRateLimiter();
    const userId = await insertUser(t);
    const [abandoned, fresh, attached, legacy] = await Promise.all([
      storeUpload(t, { uploadedBy: userId, ageMs: DAY + 60_000 }),
      storeUpload(t, { uploadedBy: userId, ageMs: 60_000 }),
      storeUpload(t, {
        uploadedBy: userId,
        ageMs: DAY + 60_000,
        ownerId: userId,
      }),
      // Records once stored uploads without claiming them; those files may
      // still be in use, so the cleanup never reads rows without the marker.
      storeUpload(t, {
        uploadedBy: userId,
        ageMs: 30 * DAY,
        legacy: true,
      }),
    ]);
    const [expiredIntent, liveIntent] = await t.run(async (ctx) => [
      await ctx.db.insert("uploadIntents", {
        token: "spent",
        uploadedBy: userId,
        createdAt: Date.now() - DAY - 120_000,
        expiresAt: Date.now() - DAY - 60_000,
      }),
      await ctx.db.insert("uploadIntents", {
        token: "live",
        uploadedBy: userId,
        createdAt: Date.now(),
        expiresAt: Date.now() + 600_000,
      }),
    ]);

    await t.mutation(internal.users.deleteAbandonedUploads, {});

    expect(await storedFile(t, abandoned)).toBeNull();
    expect(await ownershipRow(t, abandoned)).toBeNull();
    expect(await storedFile(t, fresh)).not.toBeNull();
    expect(await ownershipRow(t, fresh)).not.toBeNull();
    expect(await storedFile(t, attached)).not.toBeNull();
    expect(await ownershipRow(t, attached)).not.toBeNull();
    expect(await storedFile(t, legacy)).not.toBeNull();
    expect(await ownershipRow(t, legacy)).not.toBeNull();
    const intents = await t.run(async (ctx) => [
      await ctx.db.get(expiredIntent),
      await ctx.db.get(liveIntent),
    ]);
    expect(intents[0]).toBeNull();
    expect(intents[1]).not.toBeNull();
  });
});

describe("avatars", () => {
  test("an image upload must arrive with the type its session was issued for", async () => {
    const t = createConvexTestWithRateLimiter();
    const userId = await insertUser(t);
    const authed = authedForUser(t, userId);
    const url = new URL(
      await authed.mutation(api.users.generateUploadUrl, {
        mimeType: "image/png",
      }),
    );
    const upload = (type: string) =>
      t.fetch(url.pathname + url.search, {
        method: "POST",
        headers: { "Content-Type": type },
        body: new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], { type }),
      });

    expect((await upload("text/html")).status).toBe(415);
    const accepted = await upload("image/png");
    expect(accepted.status).toBe(200);
    const { storageId } = (await accepted.json()) as {
      storageId: Id<"_storage">;
    };
    const pending = await ownershipRow(t, storageId);
    expect(pending?.contentType).toBe("image/png");
    expect(pending?.unclaimedSince).toEqual(expect.any(Number));
    await authed.mutation(api.users.updateUserImage, { imageId: storageId });
    // Claimed uploads leave the cleanup's reach.
    expect((await ownershipRow(t, storageId))?.unclaimedSince).toBeUndefined();
    expect((await t.run(async (ctx) => ctx.db.get(userId)))?.imageId).toBe(
      storageId,
    );
  });

  test("only an image upload becomes the avatar", async () => {
    const t = createConvexTestWithRateLimiter();
    const userId = await insertUser(t);
    const authed = authedForUser(t, userId);
    const [page, photo] = await Promise.all([
      storeUpload(t, {
        uploadedBy: userId,
        ageMs: 0,
        contentType: "text/html",
      }),
      storeUpload(t, {
        uploadedBy: userId,
        ageMs: 0,
        contentType: "image/png",
      }),
    ]);

    await expect(
      authed.mutation(api.users.updateUserImage, { imageId: page }),
    ).rejects.toThrow("Avatar must be a JPEG, PNG or WebP image");
    await authed.mutation(api.users.updateUserImage, { imageId: photo });
    expect((await t.run(async (ctx) => ctx.db.get(userId)))?.imageId).toBe(
      photo,
    );
  });
});

describe("upload URL rate limit", () => {
  afterEach(() => vi.useRealTimers());

  test("a user gets a burst of upload URLs, then must wait", async () => {
    vi.useFakeTimers();
    const t = createConvexTestWithRateLimiter();
    const userId = await insertUser(t);
    const authed = authedForUser(t, userId);

    for (let index = 0; index < UPLOAD_URL_BURST; index++) {
      await authed.mutation(api.users.generateUploadUrl, {
        mimeType: "image/jpeg",
      });
    }
    await expect(
      authed.mutation(api.users.generateUploadUrl, { mimeType: "image/jpeg" }),
    ).rejects.toThrow("Too many uploads at once");

    const other = authedForUser(t, await insertUser(t));
    expect(
      await other.mutation(api.users.generateUploadUrl, {
        mimeType: "image/jpeg",
      }),
    ).toContain("/upload-owned-file?intent=");
  });
});
