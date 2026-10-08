import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import {
  authedForUser,
  type ConvexTest,
  createConvexTest,
  createOrgUserCollectionWithPermissions,
  createOrgUserWithPermissions,
} from "./testHarness";

// Primary images schedule a thumbnail job; fake timers keep it from running.
beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

const MEDIA_STAFF = ["media.upload", "media.read"];

async function storeUpload(
  t: ConvexTest,
  {
    organizationId,
    userId,
    mimeType,
  }: {
    organizationId: Id<"organizations">;
    userId: Id<"users">;
    mimeType: string;
  },
) {
  return await t.run(async (ctx) => {
    const storageId = await ctx.storage.store(
      new Blob([new Uint8Array([0xff, 0xd8])], { type: mimeType }),
    );
    await ctx.db.insert("storageOwnership", {
      storageId,
      uploadedBy: userId,
      organizationId,
      uploadedAt: Date.now(),
    });
    return storageId;
  });
}

async function mediaStaffWithObject(t: ConvexTest) {
  const own = await createOrgUserCollectionWithPermissions(t, MEDIA_STAFF);
  const staff = authedForUser(t, own.userId);

  async function upload(
    fileName: string,
    options: { isPrimary?: boolean; mimeType?: string } = {},
  ) {
    const mimeType = options.mimeType ?? "image/jpeg";
    const storageId = await storeUpload(t, { ...own, mimeType });
    return await staff.mutation(api.media.create, {
      organizationId: own.organizationId,
      collectionId: own.collectionId,
      storageId,
      fileName,
      fileSize: 2,
      mimeType,
      isPrimary: options.isPrimary,
    });
  }

  async function primaryFileNames() {
    const media = await staff.query(api.media.list, {
      collectionId: own.collectionId,
    });
    return media.filter((item) => item.isPrimary).map((item) => item.fileName);
  }

  return { ...own, staff, upload, primaryFileNames };
}

async function addMember(
  t: ConvexTest,
  organizationId: Id<"organizations">,
  permissionNames: string[],
) {
  const userId = await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", {
      name: "Second Staff Member",
      email: `member-${Math.random().toString(36).slice(2, 8)}@example.com`,
    });
    const roleId = await ctx.db.insert("roles", {
      organizationId,
      name: "Limited Role",
      isSystemRole: false,
    });
    for (const name of permissionNames) {
      const permissionId = await ctx.db.insert("permissions", {
        name,
        category: name.split(".")[0] ?? "collections",
      });
      await ctx.db.insert("rolePermissions", { roleId, permissionId });
    }
    await ctx.db.insert("userOrganizations", {
      userId,
      organizationId,
      roleId,
      joinedAt: Date.now(),
    });
    return userId;
  });
  return authedForUser(t, userId);
}

describe("primary image on upload", () => {
  test("an uploaded image becomes primary only when the object has none", async () => {
    const t = createConvexTest();
    const { upload, primaryFileNames } = await mediaStaffWithObject(t);

    await upload("front.jpg");
    await upload("back.jpg");

    expect(await primaryFileNames()).toEqual(["front.jpg"]);
  });

  test("an image uploaded as primary replaces the previous primary image", async () => {
    const t = createConvexTest();
    const { upload, primaryFileNames } = await mediaStaffWithObject(t);

    await upload("front.jpg", { isPrimary: true });
    await upload("detail.jpg", { isPrimary: true });

    expect(await primaryFileNames()).toEqual(["detail.jpg"]);
  });

  test("a document never becomes the primary image", async () => {
    const t = createConvexTest();
    const { upload, primaryFileNames } = await mediaStaffWithObject(t);

    await upload("condition-report.pdf", { mimeType: "application/pdf" });
    await upload("deed-of-gift.pdf", {
      mimeType: "application/pdf",
      isPrimary: true,
    });
    await upload("front.jpg");

    expect(await primaryFileNames()).toEqual(["front.jpg"]);
  });
});

describe("choosing the primary image", () => {
  test("updating an image to primary clears the previous primary image", async () => {
    const t = createConvexTest();
    const { staff, upload, primaryFileNames } = await mediaStaffWithObject(t);
    await upload("front.jpg", { isPrimary: true });
    const detailId = await upload("detail.jpg");

    await staff.mutation(api.media.update, {
      mediaId: detailId,
      isPrimary: true,
    });

    expect(await primaryFileNames()).toEqual(["detail.jpg"]);
  });

  test("choosing a primary image leaves it the only primary even when several were flagged", async () => {
    const t = createConvexTest();
    const { staff, upload, primaryFileNames } = await mediaStaffWithObject(t);
    const frontId = await upload("front.jpg");
    const backId = await upload("back.jpg");
    const detailId = await upload("detail.jpg");
    await t.run(async (ctx) => {
      await ctx.db.patch(frontId, { isPrimary: true });
      await ctx.db.patch(backId, { isPrimary: true });
    });

    await staff.mutation(api.media.setPrimary, { mediaId: detailId });

    expect(await primaryFileNames()).toEqual(["detail.jpg"]);
  });

  test("a document cannot be chosen as the primary image", async () => {
    const t = createConvexTest();
    const { staff, upload, primaryFileNames } = await mediaStaffWithObject(t);
    await upload("front.jpg");
    const reportId = await upload("condition-report.pdf", {
      mimeType: "application/pdf",
    });

    await expect(
      staff.mutation(api.media.setPrimary, { mediaId: reportId }),
    ).rejects.toThrow("Only an image can be the primary image");
    expect(await primaryFileNames()).toEqual(["front.jpg"]);
  });

  test("the primary image cannot be cleared without choosing another", async () => {
    const t = createConvexTest();
    const { staff, upload, primaryFileNames } = await mediaStaffWithObject(t);
    const frontId = await upload("front.jpg");

    await expect(
      staff.mutation(api.media.update, { mediaId: frontId, isPrimary: false }),
    ).rejects.toThrow("Choose another image as the primary image instead");
    expect(await primaryFileNames()).toEqual(["front.jpg"]);
  });

  test("staff without media upload permission cannot choose the primary image", async () => {
    const t = createConvexTest();
    const { upload, primaryFileNames, organizationId } =
      await mediaStaffWithObject(t);
    await upload("front.jpg");
    const detailId = await upload("detail.jpg");
    const viewer = await addMember(t, organizationId, ["media.read"]);

    await expect(
      viewer.mutation(api.media.setPrimary, { mediaId: detailId }),
    ).rejects.toThrow("Permission denied: media.upload");
    await expect(
      viewer.mutation(api.media.update, { mediaId: detailId, isPrimary: true }),
    ).rejects.toThrow("Permission denied: media.upload");
    expect(await primaryFileNames()).toEqual(["front.jpg"]);
  });

  test("the repair migration keeps the oldest primary image of objects with several", async () => {
    const t = createConvexTest();
    const { upload, primaryFileNames } = await mediaStaffWithObject(t);
    const frontId = await upload("front.jpg");
    const backId = await upload("back.jpg");
    const reportId = await upload("condition-report.pdf", {
      mimeType: "application/pdf",
    });
    await t.run(async (ctx) => {
      await ctx.db.patch(frontId, { isPrimary: false });
      await ctx.db.patch(backId, { isPrimary: true });
      await ctx.db.patch(reportId, { isPrimary: true });
    });
    const detailId = await upload("detail.jpg");
    await t.run(async (ctx) => {
      await ctx.db.patch(detailId, { isPrimary: true });
    });

    const firstRun = await t.mutation(
      internal.migrations.repairDuplicatePrimaryImages,
      {},
    );
    const rerun = await t.mutation(
      internal.migrations.repairDuplicatePrimaryImages,
      {},
    );

    expect(await primaryFileNames()).toEqual(["back.jpg"]);
    expect(firstRun).toEqual({ cleared: 2, isDone: true });
    expect(rerun).toEqual({ cleared: 0, isDone: true });
  });

  test("staff of another organization cannot choose the primary image", async () => {
    const t = createConvexTest();
    const { upload, primaryFileNames } = await mediaStaffWithObject(t);
    await upload("front.jpg");
    const detailId = await upload("detail.jpg");
    const outsider = await createOrgUserCollectionWithPermissions(
      t,
      MEDIA_STAFF,
    );

    await expect(
      authedForUser(t, outsider.userId).mutation(api.media.setPrimary, {
        mediaId: detailId,
      }),
    ).rejects.toThrow();
    expect(await primaryFileNames()).toEqual(["front.jpg"]);
  });
});

const DRAFT_STAFF = [
  "collections.create",
  "collections.read",
  "collections.update",
  "media.upload",
  "media.read",
];

async function draftStaff(t: ConvexTest) {
  const own = await createOrgUserWithPermissions(t, DRAFT_STAFF);
  await t.run(async (ctx) => {
    await ctx.db.patch(own.organizationId, {
      settings: { accessionWorkflowEnabled: false },
    });
  });
  const staff = authedForUser(t, own.userId);

  async function draftFile(
    fileName: string,
    isPrimary: boolean,
    mediaCategory: "image" | "document" = "image",
  ) {
    const mimeType =
      mediaCategory === "image" ? "image/jpeg" : "application/pdf";
    const storageId = await storeUpload(t, { ...own, mimeType });
    return {
      storageId,
      fileName,
      fileSize: 2,
      mimeType,
      mediaCategory,
      isPrimary,
    };
  }

  return { ...own, staff, draftFile };
}

function primaryDraftFileNames(
  draftMedia: Array<{ fileName: string; isPrimary: boolean }> | undefined,
) {
  return (draftMedia ?? [])
    .filter((item) => item.isPrimary)
    .map((item) => item.fileName);
}

describe("primary image on object drafts", () => {
  test("saving a draft keeps one primary image when several are flagged", async () => {
    const t = createConvexTest();
    const { staff, organizationId, draftFile } = await draftStaff(t);
    const draftMedia = [
      await draftFile("deed-of-gift.pdf", true, "document"),
      await draftFile("front.jpg", false),
      await draftFile("back.jpg", true),
      await draftFile("side.jpg", true),
    ];

    const accessionId = await staff.mutation(api.accessions.upsertObjectDraft, {
      organizationId,
      saveMode: "draft",
      objectData: { title: "Carved bowl", accessionNumber: "BOWL-1" },
      draftMedia,
    });

    const draft = await staff.query(api.accessions.get, { accessionId });
    expect(primaryDraftFileNames(draft?.draftMedia)).toEqual(["back.jpg"]);
  });

  test("publishing a draft saved with conflicting primary flags leaves one primary image", async () => {
    const t = createConvexTest();
    const { staff, organizationId, draftFile } = await draftStaff(t);
    const objectData = { title: "Carved bowl", accessionNumber: "BOWL-2" };
    const accessionId = await staff.mutation(api.accessions.upsertObjectDraft, {
      organizationId,
      saveMode: "draft",
      objectData,
      draftMedia: [
        await draftFile("deed-of-gift.pdf", false, "document"),
        await draftFile("front.jpg", false),
        await draftFile("back.jpg", false),
      ],
    });
    await t.run(async (ctx) => {
      const accession = await ctx.db.get(accessionId);
      await ctx.db.patch(accessionId, {
        draftMedia: accession?.draftMedia?.map((item) => ({
          ...item,
          isPrimary: true,
        })),
      });
    });

    await staff.mutation(api.accessions.upsertObjectDraft, {
      organizationId,
      accessionId,
      saveMode: "submit",
      objectData,
    });

    const published = await staff.query(api.accessions.get, { accessionId });
    if (!published?.collectionId) throw new Error("Draft was not published");
    const media = await staff.query(api.media.list, {
      collectionId: published.collectionId,
    });
    expect(
      media.filter((item) => item.isPrimary).map((item) => item.fileName),
    ).toEqual(["front.jpg"]);
  });

  test("staff without media upload permission cannot change a draft's primary image", async () => {
    const t = createConvexTest();
    const { staff, organizationId, draftFile } = await draftStaff(t);
    const draftMedia = [
      await draftFile("front.jpg", true),
      await draftFile("back.jpg", false),
    ];
    const accessionId = await staff.mutation(api.accessions.upsertObjectDraft, {
      organizationId,
      saveMode: "draft",
      objectData: { title: "Carved bowl", accessionNumber: "BOWL-3" },
      draftMedia,
    });
    const cataloger = await addMember(t, organizationId, [
      "collections.create",
      "collections.read",
      "collections.update",
    ]);

    await expect(
      cataloger.mutation(api.accessions.upsertObjectDraft, {
        organizationId,
        accessionId,
        saveMode: "draft",
        objectData: { title: "Carved bowl", accessionNumber: "BOWL-3" },
        draftMedia: draftMedia.map((item) => ({
          ...item,
          isPrimary: item.fileName === "back.jpg",
        })),
      }),
    ).rejects.toThrow("Permission denied: media.upload");

    await cataloger.mutation(api.accessions.upsertObjectDraft, {
      organizationId,
      accessionId,
      saveMode: "draft",
      objectData: { title: "Carved wooden bowl", accessionNumber: "BOWL-3" },
      draftMedia,
    });
    const draft = await staff.query(api.accessions.get, { accessionId });
    expect(draft?.draftObjectData?.title).toBe("Carved wooden bowl");
    expect(primaryDraftFileNames(draft?.draftMedia)).toEqual(["front.jpg"]);
  });
});
