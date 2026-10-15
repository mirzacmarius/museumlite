import sharp from "sharp";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import {
  authedForUser,
  createConvexTest,
  createOrgUserCollectionWithPermissions,
} from "../tests/testHarness";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

beforeEach(() => {
  vi.useFakeTimers();
  // convex-test shares one transaction flag across concurrent actions, so two
  // renditions storing files at once corrupt each other. Distinct due times
  // make each drain step run one scheduled job.
  const fakeSetTimeout = globalThis.setTimeout;
  let order = 0;
  vi.spyOn(globalThis, "setTimeout").mockImplementation(((
    callback: () => void,
    delay = 0,
  ) => fakeSetTimeout(callback, delay + order++)) as typeof setTimeout);
  vi.spyOn(globalThis, "fetch").mockRejectedValue(
    new Error("no network in tests"),
  );
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

async function photo(width: number) {
  return await sharp({
    create: {
      width,
      height: width / 2,
      channels: 3,
      background: "#336699",
    },
  })
    .withExif({
      IFD0: { Artist: "Registrar" },
      IFD3: { GPSLatitudeRef: "N", GPSLatitude: "59/1 54/1 0/1" },
    })
    .jpeg()
    .toBuffer();
}

async function createPortal() {
  const t = createConvexTest();
  const fixture = await createOrgUserCollectionWithPermissions(t, [
    "organization.manage_settings",
    "media.read",
    "media.upload",
  ]);
  await t.run(async (ctx) => {
    await ctx.db.patch(fixture.organizationId, {
      slug: "portal-museum",
      settings: { portalSettings: { isEnabled: true, portalSlug: "gallery" } },
    });
    await ctx.db.patch(fixture.collectionId, {
      accessionNumber: "PORTAL-1",
      isPubliclyVisible: true,
    });
  });
  const staff = authedForUser(t, fixture.userId);

  async function upload(
    fileName: string,
    bytes: Uint8Array,
    mimeType: string,
    options: { isPrimary?: boolean; mediaCategory?: "image" | "document" } = {},
  ) {
    const { uploadUrl } = await staff.mutation(api.media.generateUploadUrl, {
      organizationId: fixture.organizationId,
      collectionId: fixture.collectionId,
      fileName,
      fileSize: bytes.length,
      mimeType,
    });
    const url = new URL(uploadUrl);
    const response = await t.fetch(url.pathname + url.search, {
      method: "POST",
      body: new Blob([new Uint8Array(bytes)], { type: mimeType }),
    });
    const { storageId }: { storageId: Id<"_storage"> } = await response.json();
    return await staff.mutation(api.media.create, {
      organizationId: fixture.organizationId,
      collectionId: fixture.collectionId,
      storageId,
      fileName,
      fileSize: bytes.length,
      mimeType,
      ...options,
    });
  }

  async function files(urls: string[]) {
    const contents = await t.run(async (ctx) => {
      const stored = await ctx.db.system.query("_storage").collect();
      const byUrl = new Map<string, Id<"_storage">>();
      for (const file of stored) {
        const fileUrl = await ctx.storage.getUrl(file._id);
        if (fileUrl) byUrl.set(fileUrl, file._id);
      }
      return await Promise.all(
        urls.map(async (url) => {
          const storageId = byUrl.get(url);
          const blob = storageId ? await ctx.storage.get(storageId) : null;
          return blob ? await blob.arrayBuffer() : new ArrayBuffer(0);
        }),
      );
    });
    return contents.map((content) => Buffer.from(content));
  }

  async function served(urls: string[]) {
    return await Promise.all(
      (await files(urls)).map(async (file) => {
        const metadata = await sharp(file).metadata();
        return {
          format: metadata.format,
          width: metadata.width,
          hasExif: metadata.exif !== undefined,
        };
      }),
    );
  }

  return {
    t,
    ...fixture,
    staff,
    upload,
    files,
    served,
    drain: () =>
      t.finishAllScheduledFunctions(() => vi.advanceTimersToNextTimer()),
    list: () =>
      t.query(api.collections.listPublic, {
        organizationSlug: "portal-museum",
        portalSlug: "gallery",
      }),
    detail: () =>
      t.query(api.collections.getPublic, {
        organizationSlug: "portal-museum",
        portalSlug: "gallery",
        accessionNumber: "PORTAL-1",
      }),
  };
}

test("portal shows every image of a published object as a public rendition without embedded metadata", async () => {
  const portal = await createPortal();
  const original = await photo(2400);
  expect((await sharp(original).metadata()).exif).toBeDefined();
  await portal.upload("front.jpg", original, "image/jpeg", {
    isPrimary: false,
  });
  await portal.upload("back.jpg", await photo(800), "image/jpeg", {
    isPrimary: true,
  });
  await portal.drain();

  const detail = await portal.detail();
  const images = detail?.images ?? [];
  expect(images.map((image) => image.isPrimary)).toEqual([false, true]);
  expect(await portal.served(images.map((image) => image.url))).toEqual([
    { format: "jpeg", width: 1600, hasExif: false },
    { format: "jpeg", width: 800, hasExif: false },
  ]);
  expect(images.map((image) => image.originalDownloadUrl)).toEqual([
    undefined,
    undefined,
  ]);
  expect(detail?.isHighResDownloadable).toBe(false);
  const list = await portal.list();
  expect(list.items.map((item) => item.accessionNumber)).toEqual(["PORTAL-1"]);
  expect(list.items[0]?.primaryImageUrl).toBe(images[1]?.url);
});
