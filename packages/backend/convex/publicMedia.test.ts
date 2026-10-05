import sharp from "sharp";
import { expect, test, vi } from "vitest";
import {
  authedForUser,
  createConvexTest,
  createOrgUserCollectionWithPermissions,
} from "../tests/testHarness";
import { api, internal } from "./_generated/api";

test("anonymous catalog hides legacy and restricted attachments in list and detail", async () => {
  const t = createConvexTest();
  const fixture = await createOrgUserCollectionWithPermissions(t, []);
  const { slug, libraryItemId } = await t.run(async (ctx) => {
    const org = await ctx.db.get(fixture.organizationId);
    await ctx.db.patch(fixture.organizationId, {
      type: "library",
      settings: { portalSettings: { isEnabled: true } },
    });
    await ctx.db.patch(fixture.collectionId, {
      isPubliclyVisible: true,
      isHighResDownloadable: true,
    });
    for (const [fileName, mimeType, rightsStatus] of [
      ["legacy.jpg", "image/jpeg", "owned"],
      ["secret.pdf", "application/pdf", "restricted"],
    ] as const) {
      const storageId = await ctx.storage.store(
        new Blob([fileName], { type: mimeType }),
      );
      await ctx.db.insert("mediaFiles", {
        organizationId: fixture.organizationId,
        collectionId: fixture.collectionId,
        storageId,
        fileName,
        fileType: mimeType === "image/jpeg" ? "image" : "document",
        fileSize: fileName.length,
        mimeType,
        rightsStatus,
        isPrimary: true,
        uploadedBy: fixture.userId,
        uploadedAt: Date.now(),
        uploadStatus: "completed",
      });
    }
    const coverImageId = await ctx.storage.store(
      new Blob(["unreviewed cover"], { type: "image/jpeg" }),
    );
    const libraryItemId = await ctx.db.insert("libraryItems", {
      organizationId: fixture.organizationId,
      itemType: "book",
      title: "Unreviewed library cover",
      authors: ["Archivist"],
      language: "en",
      coverImageId,
      coverImageUrl: "https://example.test/unreviewed.jpg",
      totalCopies: 1,
      availableCopies: 1,
      catalogStatus: "published",
      isCirculating: false,
      createdBy: fixture.userId,
      createdAt: Date.now(),
    });
    return { slug: org?.slug ?? "", libraryItemId };
  });
  const collection = await t.run((ctx) => ctx.db.get(fixture.collectionId));
  const detail = await t.query(api.collections.getPublic, {
    organizationSlug: slug,
    accessionNumber: collection?.accessionNumber ?? "",
  });
  const list = await t.query(api.collections.listPublic, {
    organizationSlug: slug,
  });
  expect(detail?.images).toEqual([]);
  expect(detail?.isHighResDownloadable).toBe(false);
  expect(list.items[0]?.primaryImageUrl).toBeUndefined();
  expect(
    list.items.find((item) => item._id === libraryItemId)?.primaryImageUrl,
  ).toBeUndefined();
  const libraryDetail = await t.query(api.collections.getPublic, {
    organizationSlug: slug,
    accessionNumber: `library-${libraryItemId}`,
  });
  expect(libraryDetail?.images).toEqual([]);
});

test("approval action creates a bounded JPEG rendition before public projection", async () => {
  const t = createConvexTest();
  const fixture = await createOrgUserCollectionWithPermissions(t, [
    "organization.manage_settings",
  ]);
  const input = await sharp({
    create: { width: 2400, height: 1200, channels: 3, background: "#ff0000" },
  })
    .png()
    .toBuffer();
  const { mediaId, sourceStorageId, organizationSlug, accessionNumber } =
    await t.run(async (ctx) => {
      const org = await ctx.db.get(fixture.organizationId);
      const collection = await ctx.db.get(fixture.collectionId);
      await ctx.db.patch(fixture.organizationId, {
        settings: { portalSettings: { isEnabled: true } },
      });
      await ctx.db.patch(fixture.collectionId, { isPubliclyVisible: true });
      const sourceStorageId = await ctx.storage.store(
        new Blob([new Uint8Array(input)], { type: "image/png" }),
      );
      const mediaId = await ctx.db.insert("mediaFiles", {
        organizationId: fixture.organizationId,
        collectionId: fixture.collectionId,
        storageId: sourceStorageId,
        fileName: "large.png",
        fileType: "image",
        fileSize: input.length,
        mimeType: "image/png",
        rightsStatus: "public_domain",
        isPrimary: true,
        uploadedBy: fixture.userId,
        uploadedAt: Date.now(),
        uploadStatus: "completed",
      });
      return {
        mediaId,
        sourceStorageId,
        organizationSlug: org?.slug ?? "",
        accessionNumber: collection?.accessionNumber ?? "",
      };
    });
  const reviewer = authedForUser(t, fixture.userId);
  await reviewer.mutation(api.mediaPublications.approve, { mediaId });
  const requestId = await t.run(
    async (ctx) => (await ctx.db.get(mediaId))?.publicApproval?.requestId ?? "",
  );
  const fetchMock = vi
    .spyOn(globalThis, "fetch")
    .mockImplementation(
      async () => new Response(new Uint8Array(input), { status: 200 }),
    );
  try {
    await t.action(internal.mediaPublicationsActions.processRendition, {
      mediaId,
      requestId,
      sourceStorageId,
    });
  } finally {
    fetchMock.mockRestore();
  }
  const approval = await t.run(
    async (ctx) => (await ctx.db.get(mediaId))?.publicApproval,
  );
  expect(approval?.status).toBe("approved");
  expect(approval?.renditionStorageId).toBeDefined();
  const rendition = await t.run(async (ctx) => {
    const blob = approval?.renditionStorageId
      ? await ctx.storage.get(approval.renditionStorageId)
      : null;
    return blob ? await blob.arrayBuffer() : new ArrayBuffer(0);
  });
  const metadata = await sharp(Buffer.from(rendition)).metadata();
  expect(metadata.format).toBe("jpeg");
  expect(metadata.width).toBe(1600);
  expect(metadata.height).toBe(800);
  const detail = await t.query(api.collections.getPublic, {
    organizationSlug,
    accessionNumber,
  });
  expect(detail?.images).toHaveLength(1);
  expect(detail?.isHighResDownloadable).toBe(false);
  expect(detail?.images[0]?.originalDownloadUrl).toBeUndefined();
});

test("approval publishes only its rendition and invalidates on rights, version, and unpublish", async () => {
  const t = createConvexTest();
  const fixture = await createOrgUserCollectionWithPermissions(t, [
    "media.read",
    "organization.manage_settings",
    "media.upload",
  ]);
  const { slug, accessionNumber, mediaId, sourceStorageId } = await t.run(
    async (ctx) => {
      const org = await ctx.db.get(fixture.organizationId);
      const collection = await ctx.db.get(fixture.collectionId);
      await ctx.db.patch(fixture.organizationId, {
        settings: { portalSettings: { isEnabled: true } },
      });
      await ctx.db.patch(fixture.collectionId, { isPubliclyVisible: true });
      const sourceStorageId = await ctx.storage.store(
        new Blob(["original"], { type: "image/jpeg" }),
      );
      const mediaId = await ctx.db.insert("mediaFiles", {
        organizationId: fixture.organizationId,
        collectionId: fixture.collectionId,
        storageId: sourceStorageId,
        fileName: "reviewed.jpg",
        fileType: "image",
        fileSize: 8,
        mimeType: "image/jpeg",
        rightsStatus: "owned",
        isPrimary: true,
        uploadedBy: fixture.userId,
        uploadedAt: Date.now(),
        uploadStatus: "completed",
      });
      return {
        slug: org?.slug ?? "",
        accessionNumber: collection?.accessionNumber ?? "",
        mediaId,
        sourceStorageId,
      };
    },
  );
  const reviewer = authedForUser(t, fixture.userId);
  const readerUserId = await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", { name: "Reader" });
    const roleId = await ctx.db.insert("roles", {
      organizationId: fixture.organizationId,
      name: "Reader",
      isSystemRole: false,
    });
    const permissionId = await ctx.db.insert("permissions", {
      name: "media.read",
      category: "media",
    });
    await ctx.db.insert("rolePermissions", { roleId, permissionId });
    await ctx.db.insert("userOrganizations", {
      userId,
      organizationId: fixture.organizationId,
      roleId,
      joinedAt: Date.now(),
    });
    return userId;
  });
  const reader = authedForUser(t, readerUserId);
  const publicDetail = () =>
    t.query(api.collections.getPublic, {
      organizationSlug: slug,
      accessionNumber,
    });
  await expect(
    t.mutation(api.mediaPublications.approve, { mediaId }),
  ).rejects.toThrow("Permission denied");
  expect(
    (await reader.query(api.mediaPublications.getReview, { mediaId }))
      ?.canManage,
  ).toBe(false);
  await expect(
    reader.mutation(api.mediaPublications.approve, { mediaId }),
  ).rejects.toThrow("Permission denied");
  await reviewer.mutation(api.mediaPublications.approve, { mediaId });
  expect((await publicDetail())?.images).toEqual([]);
  const approval = await t.run(
    async (ctx) => (await ctx.db.get(mediaId))?.publicApproval,
  );
  expect(approval?.status).toBe("processing");
  const renditionStorageId = await t.run((ctx) =>
    ctx.storage.store(new Blob(["display"], { type: "image/jpeg" })),
  );
  expect(
    await t.mutation(internal.mediaPublications.completeRendition, {
      mediaId,
      requestId: approval?.requestId ?? "",
      sourceStorageId,
      renditionStorageId,
    }),
  ).toBe(true);
  const detail = await publicDetail();
  expect(detail?.images).toHaveLength(1);
  const expectedRenditionUrl = await t.run((ctx) =>
    ctx.storage.getUrl(renditionStorageId),
  );
  expect(detail?.images[0]?.url).toBe(expectedRenditionUrl);
  expect(detail?.images[0]?.originalDownloadUrl).toBeUndefined();
  const list = await t.query(api.collections.listPublic, {
    organizationSlug: slug,
  });
  expect(list.items[0]?.primaryImageUrl).toBe(detail?.images[0]?.url);
  await expect(
    reader.mutation(api.mediaPublications.setOriginalDownload, {
      mediaId,
      allowed: true,
    }),
  ).rejects.toThrow("Permission denied");
  await expect(
    reader.mutation(api.mediaPublications.unpublish, { mediaId }),
  ).rejects.toThrow("Permission denied");
  await reviewer.mutation(api.mediaPublications.setOriginalDownload, {
    mediaId,
    allowed: true,
  });
  const expectedOriginalUrl = await t.run((ctx) =>
    ctx.storage.getUrl(sourceStorageId),
  );
  expect((await publicDetail())?.images[0]?.originalDownloadUrl).toBe(
    expectedOriginalUrl,
  );
  await t.run((ctx) => ctx.storage.delete(renditionStorageId));
  expect((await publicDetail())?.images).toEqual([]);
  await reviewer.mutation(api.mediaPublications.approve, { mediaId });
  const regeneratedApproval = await t.run(
    async (ctx) => (await ctx.db.get(mediaId))?.publicApproval,
  );
  const replacementRenditionId = await t.run((ctx) =>
    ctx.storage.store(new Blob(["display again"], { type: "image/jpeg" })),
  );
  expect(
    await t.mutation(internal.mediaPublications.completeRendition, {
      mediaId,
      requestId: regeneratedApproval?.requestId ?? "",
      sourceStorageId,
      renditionStorageId: replacementRenditionId,
    }),
  ).toBe(true);
  expect((await publicDetail())?.images).toHaveLength(1);
  await reviewer.mutation(api.media.updateRights, {
    mediaId,
    rightsStatus: "restricted",
  });
  expect((await publicDetail())?.images).toEqual([]);
  await expect(
    reviewer.mutation(api.mediaPublications.approve, { mediaId }),
  ).rejects.toThrow("Rights must be owned");
  await reviewer.mutation(api.media.updateRights, {
    mediaId,
    rightsStatus: "unknown",
  });
  await expect(
    reviewer.mutation(api.mediaPublications.approve, { mediaId }),
  ).rejects.toThrow("Rights must be owned");
  await reviewer.mutation(api.media.updateRights, {
    mediaId,
    rightsStatus: "licensed",
    licenseType: "creative_commons_by",
  });
  await expect(
    reviewer.mutation(api.mediaPublications.approve, { mediaId }),
  ).rejects.toThrow("unsupported conditions");
  await reviewer.mutation(api.media.updateRights, {
    mediaId,
    rightsStatus: "owned",
    licenseType: null,
  });
  expect((await publicDetail())?.images).toEqual([]);
  await reviewer.mutation(api.mediaPublications.approve, { mediaId });
  const secondApproval = await t.run(
    async (ctx) => (await ctx.db.get(mediaId))?.publicApproval,
  );
  expect(
    await t.mutation(internal.mediaPublications.completeRendition, {
      mediaId,
      requestId: secondApproval?.requestId ?? "",
      sourceStorageId,
      renditionStorageId,
    }),
  ).toBe(false);
  const finalRenditionId = await t.run((ctx) =>
    ctx.storage.store(new Blob(["final"], { type: "image/jpeg" })),
  );
  expect(
    await t.mutation(internal.mediaPublications.completeRendition, {
      mediaId,
      requestId: secondApproval?.requestId ?? "",
      sourceStorageId,
      renditionStorageId: finalRenditionId,
    }),
  ).toBe(true);
  await t.run((ctx) =>
    ctx.db.patch(mediaId, { licenseExpiry: Date.now() - 1 }),
  );
  expect((await publicDetail())?.images).toEqual([]);
  await expect(
    reviewer.mutation(api.mediaPublications.approve, { mediaId }),
  ).rejects.toThrow("License has expired");
  await reviewer.mutation(api.media.updateRights, {
    mediaId,
    licenseExpiry: null,
  });
  expect((await publicDetail())?.images).toEqual([]);
  await reviewer.mutation(api.mediaPublications.approve, { mediaId });
  const afterExpiryApproval = await t.run(
    async (ctx) => (await ctx.db.get(mediaId))?.publicApproval,
  );
  const postExpiryRenditionId = await t.run((ctx) =>
    ctx.storage.store(new Blob(["after expiry"], { type: "image/jpeg" })),
  );
  expect(
    await t.mutation(internal.mediaPublications.completeRendition, {
      mediaId,
      requestId: afterExpiryApproval?.requestId ?? "",
      sourceStorageId,
      renditionStorageId: postExpiryRenditionId,
    }),
  ).toBe(true);
  expect((await publicDetail())?.images).toHaveLength(1);
  const nextStorageId = await t.run((ctx) =>
    ctx.storage.store(new Blob(["new version"], { type: "image/jpeg" })),
  );
  await reviewer.mutation(api.mediaVersions.createVersion, {
    mediaId,
    storageId: nextStorageId,
    editType: "crop",
  });
  expect((await publicDetail())?.images).toEqual([]);
  await reviewer.mutation(api.mediaPublications.unpublish, { mediaId });
  expect((await publicDetail())?.images).toEqual([]);
  expect(
    (await t.query(api.collections.listPublic, { organizationSlug: slug }))
      .items[0]?.primaryImageUrl,
  ).toBeUndefined();
});
