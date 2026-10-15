import sharp from "sharp";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import {
  authedForUser,
  createConvexTest,
  createOrgUserCollectionWithPermissions,
  useSequentialScheduledJobs,
} from "../tests/testHarness";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

let restoreTimers = () => {};
beforeEach(() => {
  restoreTimers = useSequentialScheduledJobs();
  vi.spyOn(globalThis, "fetch").mockRejectedValue(
    new Error("no network in tests"),
  );
});
afterEach(() => {
  vi.restoreAllMocks();
  restoreTimers();
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

  async function storeFile(
    fileName: string,
    bytes: Uint8Array,
    mimeType: string,
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
    return storageId;
  }

  async function upload(
    fileName: string,
    bytes: Uint8Array,
    mimeType: string,
    options: { isPrimary?: boolean; mediaCategory?: "image" | "document" } = {},
  ) {
    return await staff.mutation(api.media.create, {
      organizationId: fixture.organizationId,
      collectionId: fixture.collectionId,
      storageId: await storeFile(fileName, bytes, mimeType),
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

  async function renditionStatuses() {
    return await t.run(async (ctx) =>
      (
        await ctx.db
          .query("mediaFiles")
          .withIndex("by_collection", (q) =>
            q.eq("collectionId", fixture.collectionId),
          )
          .collect()
      ).map((media) => [media.fileName, media.publicRendition?.status ?? null]),
    );
  }

  async function isStored(url: string | undefined) {
    return await t.run(async (ctx) => {
      for (const file of await ctx.db.system.query("_storage").collect()) {
        if ((await ctx.storage.getUrl(file._id)) === url) return true;
      }
      return false;
    });
  }

  async function insertLegacyImages(fileNames: string[]) {
    const bytes = new Uint8Array(await photo(800));
    return await t.run(
      async (ctx) =>
        await Promise.all(
          fileNames.map(async (fileName, index) =>
            ctx.db.insert("mediaFiles", {
              organizationId: fixture.organizationId,
              collectionId: fixture.collectionId,
              storageId: await ctx.storage.store(
                new Blob([bytes], { type: "image/jpeg" }),
              ),
              fileName,
              fileType: "image",
              fileSize: bytes.length,
              mimeType: "image/jpeg",
              isPrimary: index === 0,
              uploadedBy: fixture.userId,
              uploadedAt: Date.now(),
              uploadStatus: "completed",
            }),
          ),
        ),
    );
  }

  async function recordAudit(mediaId: Id<"mediaFiles">, actions: string[]) {
    await t.run(async (ctx) => {
      for (const [index, action] of actions.entries()) {
        await ctx.db.insert("auditLog", {
          organizationId: fixture.organizationId,
          userId: fixture.userId,
          action,
          entityType: "media",
          entityId: mediaId,
          timestamp: index + 1,
        });
      }
    });
  }

  const drain = () =>
    t.finishAllScheduledFunctions(() => vi.advanceTimersToNextTimer());

  async function backfill() {
    await t.mutation(internal.migrations.backfillPublicRenditions, {
      cursor: null,
    });
    await drain();
  }

  async function portalStatus(mediaId: Id<"mediaFiles">) {
    return (await staff.query(api.mediaPublications.getReview, { mediaId }))
      ?.portal;
  }

  return {
    t,
    ...fixture,
    staff,
    storeFile,
    upload,
    insertLegacyImages,
    recordAudit,
    files,
    served,
    renditionStatuses,
    isStored,
    drain,
    backfill,
    portalStatus,
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

test("anonymous visitors never get media of an object that is not in the portal", async () => {
  const portal = await createPortal();
  await portal.upload("front.jpg", await photo(1200), "image/jpeg");
  const otherObjectId = await portal.t.run((ctx) =>
    ctx.db.insert("collections", {
      organizationId: portal.organizationId,
      accessionNumber: "PRIVATE-1",
      title: "Object kept out of the portal",
      status: "active",
      catalogedBy: portal.userId,
      catalogedAt: Date.now(),
    }),
  );
  const privateMediaId = await portal.t.run(async (ctx) => {
    const storageId = await ctx.storage.store(
      new Blob([new Uint8Array(await photo(1200))], { type: "image/jpeg" }),
    );
    return await ctx.db.insert("mediaFiles", {
      organizationId: portal.organizationId,
      collectionId: otherObjectId,
      storageId,
      fileName: "storage-room.jpg",
      fileType: "image",
      fileSize: 1,
      mimeType: "image/jpeg",
      isPrimary: true,
      uploadedBy: portal.userId,
      uploadedAt: Date.now(),
      uploadStatus: "completed",
    });
  });
  await portal.t.mutation(internal.migrations.backfillPublicRenditions, {
    cursor: null,
  });
  await portal.drain();
  const privateRendition = await portal.t.run(
    async (ctx) => (await ctx.db.get(privateMediaId))?.publicRendition?.status,
  );
  expect(privateRendition).toBe("ready");

  const privateDetail = await portal.t.query(api.collections.getPublic, {
    organizationSlug: "portal-museum",
    portalSlug: "gallery",
    accessionNumber: "PRIVATE-1",
  });
  expect(privateDetail).toBeNull();
  expect(
    (await portal.list()).items.map((item) => item.accessionNumber),
  ).toEqual(["PORTAL-1"]);

  await portal.t.run((ctx) =>
    ctx.db.patch(portal.collectionId, { isPubliclyVisible: false }),
  );
  expect(await portal.detail()).toBeNull();
  expect((await portal.list()).items).toEqual([]);

  await portal.t.run(async (ctx) => {
    await ctx.db.patch(portal.collectionId, { isPubliclyVisible: true });
    await ctx.db.patch(portal.organizationId, {
      settings: { portalSettings: { isEnabled: false, portalSlug: "gallery" } },
    });
  });
  expect(await portal.detail()).toBeNull();
  expect(await portal.list()).toMatchObject({
    items: [],
    portalStatus: "portal_disabled",
  });
});

test("anonymous visitors never get documents, PDFs, video or images filed as documents", async () => {
  const portal = await createPortal();
  await portal.upload(
    "deed-of-gift.pdf",
    new TextEncoder().encode("%PDF-1.4 private deed"),
    "application/pdf",
  );
  await portal.upload("deed-scan.jpg", await photo(1200), "image/jpeg", {
    mediaCategory: "document",
  });
  await portal.upload(
    "x-ray.mp4",
    new TextEncoder().encode("not really a video"),
    "video/mp4",
  );
  await portal.upload("front.jpg", await photo(1000), "image/jpeg", {
    isPrimary: true,
  });
  await portal.drain();

  const images = (await portal.detail())?.images ?? [];
  expect(await portal.served(images.map((image) => image.url))).toEqual([
    { format: "jpeg", width: 1000, hasExif: false },
  ]);
  expect((await portal.list()).items[0]?.primaryImageUrl).toBe(images[0]?.url);
  expect(await portal.renditionStatuses()).toEqual([
    ["deed-of-gift.pdf", null],
    ["deed-scan.jpg", null],
    ["x-ray.mp4", null],
    ["front.jpg", "ready"],
  ]);
});

test("recorded rights restrictions and an explicit hide keep an image private, unknown rights do not", async () => {
  const portal = await createPortal();
  const unknownRights = await portal.upload(
    "unknown.jpg",
    await photo(900),
    "image/jpeg",
    { isPrimary: true },
  );
  const restricted = await portal.upload(
    "restricted.jpg",
    await photo(800),
    "image/jpeg",
  );
  const internalOnly = await portal.upload(
    "internal.jpg",
    await photo(700),
    "image/jpeg",
  );
  await portal.drain();
  const shownUrls = async () =>
    ((await portal.detail())?.images ?? []).map((image) => image.url);
  const shownWidths = async () =>
    (await portal.served(await shownUrls())).map((file) => file.width);
  expect(await shownWidths()).toEqual([900, 800, 700]);
  const [unknownUrl, restrictedUrl, internalUrl] = await shownUrls();

  await portal.staff.mutation(api.media.updateRights, {
    mediaId: restricted,
    rightsStatus: "restricted",
  });
  await portal.staff.mutation(api.media.updateRights, {
    mediaId: internalOnly,
    rightsStatus: "owned",
    licenseType: "internal_only",
  });
  expect(await shownWidths()).toEqual([900]);
  expect(await portal.isStored(restrictedUrl)).toBe(false);
  expect(await portal.isStored(internalUrl)).toBe(false);
  expect(
    (
      await portal.staff.query(api.mediaPublications.getReview, {
        mediaId: restricted,
      })
    )?.portal,
  ).toBe("blocked");

  await expect(
    portal.t.mutation(api.mediaPublications.setHiddenFromPortal, {
      mediaId: unknownRights,
      hidden: true,
    }),
  ).rejects.toThrow("Permission denied");
  await portal.staff.mutation(api.mediaPublications.setHiddenFromPortal, {
    mediaId: unknownRights,
    hidden: true,
  });
  expect(await shownWidths()).toEqual([]);
  expect(await portal.isStored(unknownUrl)).toBe(false);
  expect((await portal.list()).items[0]?.primaryImageUrl).toBeUndefined();
  expect(
    (
      await portal.staff.query(api.mediaPublications.getReview, {
        mediaId: unknownRights,
      })
    )?.portal,
  ).toBe("hidden");

  await portal.staff.mutation(api.mediaPublications.setHiddenFromPortal, {
    mediaId: unknownRights,
    hidden: false,
  });
  expect(
    (
      await portal.staff.query(api.mediaPublications.getReview, {
        mediaId: unknownRights,
      })
    )?.portal,
  ).toBe("preparing");
  await portal.drain();
  expect(await shownWidths()).toEqual([900]);
  expect(await portal.renditionStatuses()).toEqual([
    ["unknown.jpg", "ready"],
    ["restricted.jpg", null],
    ["internal.jpg", null],
  ]);
});

test("a new version of an image replaces its public rendition", async () => {
  const portal = await createPortal();
  const mediaId = await portal.upload(
    "front.jpg",
    await photo(2400),
    "image/jpeg",
  );
  await portal.drain();
  const firstUrl = (await portal.detail())?.images[0]?.url;
  expect(await portal.served(firstUrl ? [firstUrl] : [])).toEqual([
    { format: "jpeg", width: 1600, hasExif: false },
  ]);

  const cropped = await photo(1000);
  const { uploadUrl } = await portal.staff.mutation(
    api.media.generateUploadUrl,
    {
      organizationId: portal.organizationId,
      collectionId: portal.collectionId,
      fileName: "front-cropped.jpg",
      fileSize: cropped.length,
      mimeType: "image/jpeg",
    },
  );
  const url = new URL(uploadUrl);
  const response = await portal.t.fetch(url.pathname + url.search, {
    method: "POST",
    body: new Blob([new Uint8Array(cropped)], { type: "image/jpeg" }),
  });
  const { storageId }: { storageId: Id<"_storage"> } = await response.json();
  await portal.staff.mutation(api.mediaVersions.createVersion, {
    mediaId,
    storageId,
    editType: "crop",
  });
  await portal.drain();

  const images = (await portal.detail())?.images ?? [];
  expect(await portal.served(images.map((image) => image.url))).toEqual([
    { format: "jpeg", width: 1000, hasExif: false },
  ]);
  expect(await portal.isStored(firstUrl)).toBe(false);
});

test("the rendition backfill shows images uploaded before MUS-790 and keeps a past unpublish hidden", async () => {
  const portal = await createPortal();
  const legacy = await portal.t.run(async (ctx) => {
    const insertImage = async (
      fileName: string,
      width: number,
      isPrimary: boolean,
    ) => {
      const storageId = await ctx.storage.store(
        new Blob([new Uint8Array(await photo(width))], { type: "image/jpeg" }),
      );
      return await ctx.db.insert("mediaFiles", {
        organizationId: portal.organizationId,
        collectionId: portal.collectionId,
        storageId,
        fileName,
        fileType: "image",
        fileSize: width,
        mimeType: "image/jpeg",
        isPrimary,
        uploadedBy: portal.userId,
        uploadedAt: Date.now(),
        uploadStatus: "completed",
      });
    };
    const front = await insertImage("front.jpg", 1200, false);
    const back = await insertImage("back.jpg", 800, true);
    const withdrawn = await insertImage("withdrawn.jpg", 600, false);
    for (const [action, timestamp] of [
      ["approved_public_media", 1],
      ["unpublished_public_media", 2],
    ] as const) {
      await ctx.db.insert("auditLog", {
        organizationId: portal.organizationId,
        userId: portal.userId,
        action,
        entityType: "media",
        entityId: withdrawn,
        timestamp,
      });
    }
    return { front, back, withdrawn };
  });
  expect((await portal.detail())?.images).toEqual([]);

  expect(
    await portal.t.mutation(internal.migrations.backfillPublicRenditions, {
      cursor: null,
    }),
  ).toEqual({ processed: 3, isDone: true });
  await portal.drain();

  const images = (await portal.detail())?.images ?? [];
  expect(images.map((image) => image._id)).toEqual([legacy.front, legacy.back]);
  expect(await portal.served(images.map((image) => image.url))).toEqual([
    { format: "jpeg", width: 1200, hasExif: false },
    { format: "jpeg", width: 800, hasExif: false },
  ]);
  expect((await portal.list()).items[0]?.primaryImageUrl).toBe(images[1]?.url);
  expect(
    (
      await portal.staff.query(api.mediaPublications.getReview, {
        mediaId: legacy.withdrawn,
      })
    )?.portal,
  ).toBe("hidden");
});

test("a second rendition backfill keeps an image shown that staff showed again after a past unpublish", async () => {
  const portal = await createPortal();
  const [mediaId] = await portal.insertLegacyImages(["returned.jpg"]);
  if (!mediaId) throw new Error("legacy image not inserted");
  await portal.recordAudit(mediaId, ["unpublished_public_media"]);

  await portal.backfill();
  expect(await portal.portalStatus(mediaId)).toBe("hidden");

  await portal.staff.mutation(api.mediaPublications.setHiddenFromPortal, {
    mediaId,
    hidden: false,
  });
  await portal.drain();
  expect(await portal.portalStatus(mediaId)).toBe("shown");

  await portal.backfill();
  expect(await portal.portalStatus(mediaId)).toBe("shown");
  expect((await portal.detail())?.images.map((image) => image._id)).toEqual([
    mediaId,
  ]);
});

test("a second rendition backfill keeps an image shown that staff approved after hiding it", async () => {
  const portal = await createPortal();
  const mediaId = await portal.upload(
    "approved.jpg",
    await photo(800),
    "image/jpeg",
  );
  await portal.drain();
  await portal.staff.mutation(api.media.updateRights, {
    mediaId,
    rightsStatus: "owned",
  });
  await portal.staff.mutation(api.mediaPublications.setHiddenFromPortal, {
    mediaId,
    hidden: true,
  });
  await portal.staff.mutation(api.mediaPublications.approve, { mediaId });
  const cropped = await photo(600);
  await portal.staff.mutation(api.mediaVersions.createVersion, {
    mediaId,
    storageId: await portal.storeFile(
      "approved-cropped.jpg",
      cropped,
      "image/jpeg",
    ),
    editType: "crop",
  });
  await portal.drain();
  expect(await portal.portalStatus(mediaId)).toBe("shown");

  await portal.backfill();

  expect(await portal.portalStatus(mediaId)).toBe("shown");
  const images = (await portal.detail())?.images ?? [];
  expect(await portal.served(images.map((image) => image.url))).toEqual([
    { format: "jpeg", width: 600, hasExif: false },
  ]);
});

test("the rendition backfill keeps an image hidden when many later audit records follow its unpublish", async () => {
  const portal = await createPortal();
  const [open, withdrawn] = await portal.insertLegacyImages([
    "open.jpg",
    "withdrawn.jpg",
  ]);
  if (!open || !withdrawn) throw new Error("legacy images not inserted");
  await portal.recordAudit(withdrawn, [
    "unpublished_public_media",
    ...Array.from({ length: 100 }, () => "updated_media_rights"),
  ]);

  await portal.backfill();

  expect(await portal.portalStatus(withdrawn)).toBe("hidden");
  expect((await portal.detail())?.images.map((image) => image._id)).toEqual([
    open,
  ]);
});

test("a transparent PNG is shown on a white background", async () => {
  const portal = await createPortal();
  const cutOut = await sharp({
    create: {
      width: 400,
      height: 200,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .png()
    .toBuffer();
  await portal.upload("cut-out.png", cutOut, "image/png");
  await portal.drain();

  const [file] = await portal.files(
    ((await portal.detail())?.images ?? []).map((image) => image.url),
  );
  const { data } = await sharp(file)
    .raw()
    .toBuffer({ resolveWithObject: true });
  expect([...data.subarray(0, 3)]).toEqual([255, 255, 255]);
});

test("a rendition whose processing stopped without a result is requested again", async () => {
  const portal = await createPortal();
  const mediaId = await portal.upload(
    "front.jpg",
    await photo(1200),
    "image/jpeg",
  );
  const markProcessing = (requestedAt: number) =>
    portal.t.run(async (ctx) => {
      const media = await ctx.db.get(mediaId);
      if (!media) throw new Error("Missing test media");
      await ctx.db.patch(mediaId, {
        publicRendition: {
          status: "processing",
          sourceStorageId: media.storageId,
          requestId: "lost-action",
          requestedAt,
        },
      });
    });
  const requestId = () =>
    portal.t.run(async (ctx) => {
      const rendition = (await ctx.db.get(mediaId))?.publicRendition;
      return rendition?.status === "processing" ? rendition.requestId : null;
    });

  await markProcessing(Date.now() - 60 * 1000);
  await portal.t.mutation(internal.migrations.backfillPublicRenditions, {
    cursor: null,
  });
  expect(await requestId()).toBe("lost-action");

  await markProcessing(Date.now() - 16 * 60 * 1000);
  await portal.t.mutation(internal.migrations.backfillPublicRenditions, {
    cursor: null,
  });
  expect(await requestId()).not.toBe("lost-action");
  await portal.drain();
  expect(
    await portal.served(
      ((await portal.detail())?.images ?? []).map((image) => image.url),
    ),
  ).toEqual([{ format: "jpeg", width: 1200, hasExif: false }]);
});

test("an image stops being public and loses its rendition when its license expires", async () => {
  const portal = await createPortal();
  const mediaId = await portal.upload(
    "loan.jpg",
    await photo(800),
    "image/jpeg",
  );
  await portal.staff.mutation(api.media.updateRights, {
    mediaId,
    rightsStatus: "owned",
    licenseExpiry: Date.now() + 24 * 60 * 60 * 1000,
  });
  await portal.t.finishAllScheduledFunctions(() =>
    vi.advanceTimersByTime(60 * 1000),
  );
  const url = (await portal.detail())?.images[0]?.url;
  expect(await portal.served(url ? [url] : [])).toEqual([
    { format: "jpeg", width: 800, hasExif: false },
  ]);

  await portal.drain();
  expect((await portal.detail())?.images).toEqual([]);
  expect(await portal.isStored(url)).toBe(false);
});

test("an image whose rendition cannot be made is reported as failed and not shown", async () => {
  const portal = await createPortal();
  const mediaId = await portal.upload(
    "damaged.jpg",
    new TextEncoder().encode("not a decodable jpeg"),
    "image/jpeg",
  );
  await portal.drain();

  expect((await portal.detail())?.images).toEqual([]);
  expect(
    (await portal.staff.query(api.mediaPublications.getReview, { mediaId }))
      ?.portal,
  ).toBe("failed");
});

test("the rendition backfill continues past its first page", async () => {
  const portal = await createPortal();
  const pixel = new Uint8Array(await photo(20));
  await portal.t.run(async (ctx) => {
    for (let index = 0; index < 51; index++) {
      await ctx.db.insert("mediaFiles", {
        organizationId: portal.organizationId,
        collectionId: portal.collectionId,
        storageId: await ctx.storage.store(
          new Blob([pixel], { type: "image/jpeg" }),
        ),
        fileName: `page-${index}.jpg`,
        fileType: "image",
        fileSize: pixel.length,
        mimeType: "image/jpeg",
        isPrimary: index === 0,
        uploadedBy: portal.userId,
        uploadedAt: Date.now(),
        uploadStatus: "completed",
      });
    }
  });

  expect(
    await portal.t.mutation(internal.migrations.backfillPublicRenditions, {
      cursor: null,
    }),
  ).toEqual({ processed: 50, isDone: false });
  await portal.drain();

  expect(((await portal.detail())?.images ?? []).length).toBe(51);
});

test("hiding an image deletes its rendition after its object moved to another organization", async () => {
  const portal = await createPortal();
  const mediaId = await portal.upload(
    "moved.jpg",
    await photo(800),
    "image/jpeg",
  );
  await portal.drain();
  const url = (await portal.detail())?.images[0]?.url;
  expect(await portal.isStored(url)).toBe(true);

  await portal.t.run(async (ctx) => {
    const receivingOrganizationId = await ctx.db.insert("organizations", {
      name: "Receiving museum",
      slug: "receiving-museum",
      type: "museum",
    });
    await ctx.db.patch(mediaId, {
      organizationId: receivingOrganizationId,
      isHiddenFromPortal: true,
    });
  });
  await portal.t.mutation(internal.mediaPublications.syncPublicRendition, {
    mediaId,
  });

  expect(await portal.isStored(url)).toBe(false);
});
