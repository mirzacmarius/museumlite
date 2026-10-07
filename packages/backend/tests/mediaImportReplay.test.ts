import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import {
  authedForUser,
  type ConvexTest,
  createConvexTest,
  createOrgUserWithPermissions,
} from "./testHarness";

const MEDIA_PERMISSIONS = ["media.upload", "media.read"];

// Attaching an image schedules thumbnail generation; keep it from running
// after a test's database has gone away.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout"] });
});
afterEach(() => {
  vi.useRealTimers();
});

async function setup() {
  const t = createConvexTest();
  const own = await createOrgUserWithPermissions(t, MEDIA_PERMISSIONS);
  return { t, own, user: authedForUser(t, own.userId) };
}

type Client = ReturnType<typeof authedForUser>;

async function createObject(
  t: ConvexTest,
  organizationId: Id<"organizations">,
  userId: Id<"users">,
  accessionNumber: string,
  status: "active" | "deleted" = "active",
) {
  return await t.run((ctx) =>
    ctx.db.insert("collections", {
      organizationId,
      accessionNumber,
      title: `Object ${accessionNumber}`,
      status,
      catalogedBy: userId,
      catalogedAt: Date.now(),
    }),
  );
}

async function startJob(
  user: Client,
  organizationId: Id<"organizations">,
  totalFiles: number,
  mappingType: "csv" | "filename" | "manual" = "filename",
  extra: { sourceFingerprint?: string } = {},
) {
  return await user.mutation(api.mediaImports.createMediaImportJob, {
    organizationId,
    totalFiles,
    mappingType,
    mappingData: mappingType === "csv" ? [] : undefined,
    ...extra,
  });
}

/** Uploads bytes through the job's authorized upload session. */
async function upload(
  t: ConvexTest,
  user: Client,
  organizationId: Id<"organizations">,
  jobId: Id<"importJobs">,
  fileName: string,
  content = "image-bytes",
) {
  const file = new Blob([content], { type: "image/jpeg" });
  const { uploadUrl } = await user.mutation(
    api.mediaImports.generateBulkUploadUrl,
    {
      organizationId,
      jobId,
      fileName,
      fileSize: file.size,
      mimeType: file.type,
    },
  );
  const url = new URL(uploadUrl);
  const response = await t.fetch(url.pathname + url.search, {
    method: "POST",
    body: file,
  });
  expect(response.status).toBe(200);
  const { storageId }: { storageId: Id<"_storage"> } = await response.json();
  return {
    storageId,
    fileName,
    fileSize: file.size,
    mimeType: file.type,
  };
}

async function mediaFor(t: ConvexTest, collectionId: Id<"collections">) {
  return await t.run((ctx) =>
    ctx.db
      .query("mediaFiles")
      .withIndex("by_collection", (q) => q.eq("collectionId", collectionId))
      .collect(),
  );
}

async function ownerOf(t: ConvexTest, storageId: Id<"_storage">) {
  return await t.run((ctx) =>
    ctx.db
      .query("storageOwnership")
      .withIndex("by_storageId", (q) => q.eq("storageId", storageId))
      .unique(),
  );
}

async function itemResults(user: Client, jobId: Id<"importJobs">) {
  const page = await user.query(api.imports.listImportRowResults, {
    jobId,
    paginationOpts: { numItems: 50, cursor: null },
  });
  return page.page;
}

test("replaying a recorded file returns its stored outcome without a second attachment or progress above 100%", async () => {
  const { t, own, user } = await setup();
  const collectionId = await createObject(
    t,
    own.organizationId,
    own.userId,
    "2024.001.001",
  );
  const jobId = await startJob(user, own.organizationId, 1);
  const file = await upload(
    t,
    user,
    own.organizationId,
    jobId,
    "2024.001.001_front.jpg",
  );
  const request = {
    organizationId: own.organizationId,
    jobId,
    itemNumber: 1,
    ...file,
  };

  const first = await user.mutation(
    api.mediaImports.recordUploadedFile,
    request,
  );
  const replay = await user.mutation(
    api.mediaImports.recordUploadedFile,
    request,
  );

  expect(first).toMatchObject({ mapped: true, collectionId, replayed: false });
  expect(replay).toMatchObject({
    mapped: true,
    collectionId,
    mediaFileId: first.mediaFileId,
    replayed: true,
  });
  expect(await mediaFor(t, collectionId)).toHaveLength(1);
  expect(await user.query(api.imports.getImportJob, { jobId })).toMatchObject({
    type: "media",
    status: "completed",
    progress: 100,
    attemptedItems: 1,
    acceptedItems: 1,
    failedItems: 0,
  });
  expect(
    await user.query(api.mediaImports.getMediaImportJob, { jobId }),
  ).toMatchObject({ successfulMappings: 1, failedMappings: 0 });
  expect(await itemResults(user, jobId)).toMatchObject([
    {
      rowNumber: 1,
      status: "accepted",
      recordId: first.mediaFileId,
      identifier: "2024.001.001_front.jpg",
      attempts: 1,
    },
  ]);
  expect(await ownerOf(t, file.storageId)).toMatchObject({
    ownerType: "media",
    ownerId: first.mediaFileId,
  });
});

test("an accepted file is not attached again when the same item is re-uploaded on resume", async () => {
  const { t, own, user } = await setup();
  const collectionId = await createObject(
    t,
    own.organizationId,
    own.userId,
    "2024.001.002",
  );
  const jobId = await startJob(user, own.organizationId, 1);
  const first = await upload(
    t,
    user,
    own.organizationId,
    jobId,
    "2024.001.002.jpg",
  );
  const accepted = await user.mutation(api.mediaImports.recordUploadedFile, {
    organizationId: own.organizationId,
    jobId,
    itemNumber: 1,
    ...first,
  });
  const second = await upload(
    t,
    user,
    own.organizationId,
    jobId,
    "2024.001.002.jpg",
  );
  const replay = await user.mutation(api.mediaImports.recordUploadedFile, {
    organizationId: own.organizationId,
    jobId,
    itemNumber: 1,
    ...second,
  });

  expect(replay).toMatchObject({
    replayed: true,
    mediaFileId: accepted.mediaFileId,
  });
  expect(await mediaFor(t, collectionId)).toHaveLength(1);
  // The duplicate upload stays unattached instead of becoming a second record.
  expect((await ownerOf(t, second.storageId))?.ownerType).toBeUndefined();
});

test("an unmatched file is retained as a failed item and a retry attaches it once the object exists", async () => {
  const { t, own, user } = await setup();
  const jobId = await startJob(user, own.organizationId, 2);
  const unmatched = await upload(
    t,
    user,
    own.organizationId,
    jobId,
    "2024.009.001.jpg",
  );
  const request = {
    organizationId: own.organizationId,
    jobId,
    itemNumber: 2,
    ...unmatched,
  };

  const failed = await user.mutation(
    api.mediaImports.recordUploadedFile,
    request,
  );
  expect(failed).toMatchObject({
    mapped: false,
    error: "No object found for accession number 2024.009.001",
  });
  expect(await ownerOf(t, unmatched.storageId)).toMatchObject({
    ownerType: "mediaImport",
    ownerId: jobId,
  });
  expect(
    await user.query(api.mediaImports.getUnmappedFiles, { jobId }),
  ).toMatchObject([
    {
      itemNumber: 2,
      storageId: unmatched.storageId,
      fileName: "2024.009.001.jpg",
    },
  ]);
  expect(await user.query(api.imports.getImportJob, { jobId })).toMatchObject({
    status: "processing",
    attemptedItems: 1,
    failedItems: 1,
    progress: 50,
    errors: [
      "Row 2: 2024.009.001.jpg: No object found for accession number 2024.009.001",
    ],
  });

  // A different upload cannot replace the retained original of this item.
  const other = await upload(
    t,
    user,
    own.organizationId,
    jobId,
    "2024.009.001.jpg",
  );
  await expect(
    user.mutation(api.mediaImports.recordUploadedFile, {
      ...request,
      ...other,
    }),
  ).rejects.toThrow("already uploaded");

  const collectionId = await createObject(
    t,
    own.organizationId,
    own.userId,
    "2024.009.001",
  );
  const retried = await user.mutation(
    api.mediaImports.recordUploadedFile,
    request,
  );
  expect(retried).toMatchObject({
    mapped: true,
    collectionId,
    replayed: false,
  });
  expect(await mediaFor(t, collectionId)).toHaveLength(1);
  expect(await ownerOf(t, unmatched.storageId)).toMatchObject({
    ownerType: "media",
    ownerId: retried.mediaFileId,
  });
  expect(
    await user.query(api.mediaImports.getUnmappedFiles, { jobId }),
  ).toEqual([]);
  expect(await user.query(api.imports.getImportJob, { jobId })).toMatchObject({
    attemptedItems: 1,
    acceptedItems: 1,
    failedItems: 0,
    errors: [],
  });
  expect(await itemResults(user, jobId)).toMatchObject([
    { rowNumber: 2, status: "accepted", attempts: 2 },
  ]);
});

test("ambiguous or withdrawn objects are not guessed and the original is kept for review", async () => {
  const { t, own, user } = await setup();
  await createObject(t, own.organizationId, own.userId, "DUP-1");
  await createObject(t, own.organizationId, own.userId, "DUP-1");
  const withdrawn = await createObject(
    t,
    own.organizationId,
    own.userId,
    "GONE-1",
    "deleted",
  );
  const jobId = await user.mutation(api.mediaImports.createMediaImportJob, {
    organizationId: own.organizationId,
    totalFiles: 2,
    mappingType: "csv",
    mappingData: [
      { filename: "a.jpg", accessionNumber: "DUP-1" },
      { filename: "b.jpg", accessionNumber: "GONE-1" },
    ],
  });
  const a = await upload(t, user, own.organizationId, jobId, "a.jpg");
  const b = await upload(t, user, own.organizationId, jobId, "b.jpg");
  const ambiguous = await user.mutation(api.mediaImports.recordUploadedFile, {
    organizationId: own.organizationId,
    jobId,
    itemNumber: 1,
    ...a,
  });
  const gone = await user.mutation(api.mediaImports.recordUploadedFile, {
    organizationId: own.organizationId,
    jobId,
    itemNumber: 2,
    ...b,
  });

  expect(ambiguous).toMatchObject({
    mapped: false,
    error: "Accession number DUP-1 matches more than one object",
  });
  expect(gone).toMatchObject({
    mapped: false,
    error: "No object found for accession number GONE-1",
  });
  expect(await mediaFor(t, withdrawn)).toEqual([]);
  expect(await user.query(api.imports.getImportJob, { jobId })).toMatchObject({
    status: "completed_with_errors",
    attemptedItems: 2,
    failedItems: 2,
  });
});

test("manual mapping keeps every upload for review and mapping is replay-safe", async () => {
  const { t, own, user } = await setup();
  const collectionId = await createObject(
    t,
    own.organizationId,
    own.userId,
    "OBJ-MANUAL",
  );
  const otherObject = await createObject(
    t,
    own.organizationId,
    own.userId,
    "OBJ-OTHER",
  );
  const jobId = await startJob(user, own.organizationId, 1, "manual");
  const file = await upload(t, user, own.organizationId, jobId, "scan.jpg");
  const recorded = await user.mutation(api.mediaImports.recordUploadedFile, {
    organizationId: own.organizationId,
    jobId,
    itemNumber: 1,
    ...file,
  });
  expect(recorded).toMatchObject({
    mapped: false,
    error: "Choose the object for this file",
  });
  expect(
    await user.query(api.mediaImports.getUnmappedFiles, { jobId }),
  ).toMatchObject([{ itemNumber: 1, storageId: file.storageId }]);

  const mapping = { jobId, storageId: file.storageId, collectionId };
  const mapped = await user.mutation(
    api.mediaImports.mapFileToCollection,
    mapping,
  );
  const replay = await user.mutation(
    api.mediaImports.mapFileToCollection,
    mapping,
  );
  expect(mapped).toMatchObject({ success: true });
  expect(replay).toEqual({ success: true, mediaFileId: mapped.mediaFileId });
  await expect(
    user.mutation(api.mediaImports.mapFileToCollection, {
      ...mapping,
      collectionId: otherObject,
    }),
  ).rejects.toThrow("already attached to a different object");
  expect(await mediaFor(t, collectionId)).toHaveLength(1);
  expect(await mediaFor(t, otherObject)).toEqual([]);
  expect(await user.query(api.imports.getImportJob, { jobId })).toMatchObject({
    status: "completed",
    acceptedItems: 1,
    failedItems: 0,
    errors: [],
  });
});

test("foreign and already-used files are refused as failed items without changing their ownership", async () => {
  const { t, own, user } = await setup();
  const foreign = await createOrgUserWithPermissions(t, MEDIA_PERMISSIONS);
  const foreignUser = authedForUser(t, foreign.userId);
  const colleague = await createOrgUserWithPermissions(t, []);
  await t.run((ctx) =>
    ctx.db.insert("userOrganizations", {
      organizationId: own.organizationId,
      userId: colleague.userId,
      roleId: own.roleId,
      joinedAt: Date.now(),
    }),
  );
  const colleagueUser = authedForUser(t, colleague.userId);
  await createObject(t, own.organizationId, own.userId, "2024.002.001");

  const jobId = await startJob(user, own.organizationId, 3);
  const foreignJob = await startJob(foreignUser, foreign.organizationId, 1);
  const foreignFile = await upload(
    t,
    foreignUser,
    foreign.organizationId,
    foreignJob,
    "2024.002.001.jpg",
  );
  const colleagueFile = await upload(
    t,
    colleagueUser,
    own.organizationId,
    jobId,
    "2024.002.001.jpg",
  );
  const ownFile = await upload(
    t,
    user,
    own.organizationId,
    jobId,
    "2024.002.001.jpg",
  );

  const fromOtherOrg = await user.mutation(
    api.mediaImports.recordUploadedFile,
    {
      organizationId: own.organizationId,
      jobId,
      itemNumber: 1,
      ...foreignFile,
    },
  );
  const fromOtherUploader = await user.mutation(
    api.mediaImports.recordUploadedFile,
    {
      organizationId: own.organizationId,
      jobId,
      itemNumber: 2,
      ...colleagueFile,
    },
  );
  await user.mutation(api.mediaImports.recordUploadedFile, {
    organizationId: own.organizationId,
    jobId,
    itemNumber: 3,
    ...ownFile,
  });
  // A file recorded for one item cannot be recorded again for another.
  await expect(
    user.mutation(api.mediaImports.recordUploadedFile, {
      organizationId: own.organizationId,
      jobId,
      itemNumber: 2,
      ...ownFile,
    }),
  ).rejects.toThrow("already recorded");

  expect(fromOtherOrg).toMatchObject({
    mapped: false,
    error: "File refused: File belongs to a different organization",
  });
  expect(fromOtherUploader).toMatchObject({
    mapped: false,
    error: "File refused: File belongs to a different uploader",
  });
  expect((await ownerOf(t, foreignFile.storageId))?.ownerType).toBeUndefined();
  expect(
    (await ownerOf(t, colleagueFile.storageId))?.ownerType,
  ).toBeUndefined();
  // Refused files are not offered for mapping because they were never accepted.
  expect(
    await user.query(api.mediaImports.getUnmappedFiles, { jobId }),
  ).toEqual([]);
  expect(await user.query(api.imports.getImportJob, { jobId })).toMatchObject({
    status: "completed_with_errors",
    attemptedItems: 3,
    acceptedItems: 1,
    failedItems: 2,
  });
  // The foreign organization can still use its own upload.
  const foreignRecorded = await foreignUser.mutation(
    api.mediaImports.recordUploadedFile,
    {
      organizationId: foreign.organizationId,
      jobId: foreignJob,
      itemNumber: 1,
      ...foreignFile,
    },
  );
  expect(foreignRecorded.error).toBe(
    "No object found for accession number 2024.002.001",
  );
});

test("media import jobs and items are refused without credentials, permission or ownership", async () => {
  const { t, own, user } = await setup();
  const outsider = await createOrgUserWithPermissions(t, MEDIA_PERMISSIONS);
  const outsiderUser = authedForUser(t, outsider.userId);
  const viewer = await createOrgUserWithPermissions(t, []);
  await t.run(async (ctx) => {
    const roleId = await ctx.db.insert("roles", {
      organizationId: own.organizationId,
      name: "No media",
      isSystemRole: false,
    });
    await ctx.db.insert("userOrganizations", {
      organizationId: own.organizationId,
      userId: viewer.userId,
      roleId,
      joinedAt: Date.now(),
    });
  });
  const viewerUser = authedForUser(t, viewer.userId);
  const jobId = await startJob(user, own.organizationId, 1);
  const file = await upload(t, user, own.organizationId, jobId, "x.jpg");
  const request = {
    organizationId: own.organizationId,
    jobId,
    itemNumber: 1,
    ...file,
  };

  await expect(
    t.mutation(api.mediaImports.recordUploadedFile, request),
  ).rejects.toThrow("Not authenticated");
  await expect(
    viewerUser.mutation(api.mediaImports.recordUploadedFile, request),
  ).rejects.toThrow();
  await expect(
    outsiderUser.mutation(api.mediaImports.recordUploadedFile, {
      ...request,
      organizationId: outsider.organizationId,
    }),
  ).rejects.toThrow("Import job not found");
  expect(
    await outsiderUser.query(api.mediaImports.getMediaImportJob, { jobId }),
  ).toBeNull();
  await expect(
    outsiderUser.query(api.mediaImports.getUnmappedFiles, { jobId }),
  ).rejects.toThrow();
  await expect(
    user.mutation(api.mediaImports.recordUploadedFile, {
      ...request,
      itemNumber: 2,
    }),
  ).rejects.toThrow("between 1 and 1");

  await user.mutation(api.mediaImports.recordUploadedFile, request);
  await expect(
    user.mutation(api.mediaImports.recordUploadedFile, {
      ...request,
      fileName: "y.jpg",
    }),
  ).rejects.toThrow("does not match");
  expect(await user.query(api.imports.getImportJob, { jobId })).toMatchObject({
    attemptedItems: 1,
  });
});

test("a cancelled media import refuses further files and upload sessions", async () => {
  const { t, own, user } = await setup();
  const jobId = await startJob(user, own.organizationId, 2);
  const file = await upload(t, user, own.organizationId, jobId, "a.jpg");
  await user.mutation(api.imports.cancelImportJob, { jobId });

  await expect(
    user.mutation(api.mediaImports.recordUploadedFile, {
      organizationId: own.organizationId,
      jobId,
      itemNumber: 1,
      ...file,
    }),
  ).rejects.toThrow("cancelled");
  await expect(
    user.mutation(api.mediaImports.generateBulkUploadUrl, {
      organizationId: own.organizationId,
      jobId,
      fileName: "b.jpg",
      fileSize: 5,
      mimeType: "image/jpeg",
    }),
  ).rejects.toThrow("cancelled");
  expect(await user.query(api.imports.getImportJob, { jobId })).toMatchObject({
    status: "cancelled",
    attemptedItems: 0,
  });
});

test("an unfinished media import of the same files can be found to resume", async () => {
  const { t, own, user } = await setup();
  const sourceFingerprint = "a".repeat(64);
  const jobId = await startJob(user, own.organizationId, 2, "filename", {
    sourceFingerprint,
  });
  const file = await upload(t, user, own.organizationId, jobId, "a.jpg");
  await user.mutation(api.mediaImports.recordUploadedFile, {
    organizationId: own.organizationId,
    jobId,
    itemNumber: 1,
    ...file,
  });

  expect(
    await user.query(api.mediaImports.findResumableMediaImportJob, {
      organizationId: own.organizationId,
      sourceFingerprint,
    }),
  ).toMatchObject({ _id: jobId, attemptedItems: 1, totalItems: 2 });

  await user.mutation(api.imports.cancelImportJob, { jobId });
  expect(
    await user.query(api.mediaImports.findResumableMediaImportJob, {
      organizationId: own.organizationId,
      sourceFingerprint,
    }),
  ).toBeNull();
});

test("an older client without item numbers cannot double count a replayed file", async () => {
  const { t, own, user } = await setup();
  const jobId = await startJob(user, own.organizationId, 1);
  const file = await upload(t, user, own.organizationId, jobId, "9.jpg");
  const request = { organizationId: own.organizationId, jobId, ...file };

  await user.mutation(api.mediaImports.recordUploadedFile, request);
  const replay = await user.mutation(
    api.mediaImports.recordUploadedFile,
    request,
  );

  expect(replay).toMatchObject({ itemNumber: 1, mapped: false });
  expect(await user.query(api.imports.getImportJob, { jobId })).toMatchObject({
    progress: 100,
    attemptedItems: 1,
    failedItems: 1,
  });
  expect(
    await user.query(api.mediaImports.getMediaImportJob, { jobId }),
  ).toMatchObject({ failedMappings: 1 });
});
