import sharp from "sharp";
import { expect, test, vi } from "vitest";
import { api, internal } from "../convex/_generated/api";
import {
  authedForUser,
  createConvexTest,
  createOrgUserCollectionWithPermissions,
  createOrgUserWithPermissions,
} from "./testHarness";

vi.stubEnv("CONVEX_SITE_URL", "https://example.convex.site");

test("bulk edit rejects a foreign destination before creating a job", async () => {
  const t = createConvexTest();
  const own = await createOrgUserCollectionWithPermissions(t, [
    "collections.update",
    "collections.read",
  ]);
  const foreign = await createOrgUserWithPermissions(t, []);
  const foreignLocationId = await t.run((ctx) =>
    ctx.db.insert("locations", {
      organizationId: foreign.organizationId,
      name: "Private vault",
      type: "room",
      sortOrder: 0,
      isActive: true,
    }),
  );

  await expect(
    authedForUser(t, own.userId).mutation(
      api.batchOperations.createBulkEditJob,
      {
        organizationId: own.organizationId,
        collectionIds: [own.collectionId],
        updates: { currentLocationId: foreignLocationId },
      },
    ),
  ).rejects.toThrow();
  expect(
    await authedForUser(t, own.userId).query(
      api.batchOperations.listBatchJobs,
      { organizationId: own.organizationId },
    ),
  ).toEqual([]);
});

test("delayed bulk edit rechecks references and records observed movement", async () => {
  const t = createConvexTest();
  const own = await createOrgUserCollectionWithPermissions(t, [
    "collections.update",
    "collections.read",
  ]);
  const [fromLocationId, toLocationId] = await t.run(async (ctx) =>
    Promise.all(
      ["From", "To"].map((name) =>
        ctx.db.insert("locations", {
          organizationId: own.organizationId,
          name,
          type: "room",
          sortOrder: 0,
          isActive: true,
        }),
      ),
    ),
  );
  await t.run((ctx) =>
    ctx.db.patch(own.collectionId, { currentLocationId: fromLocationId }),
  );
  vi.useFakeTimers();
  const jobId = await authedForUser(t, own.userId).mutation(
    api.batchOperations.createBulkEditJob,
    {
      organizationId: own.organizationId,
      collectionIds: [own.collectionId],
      updates: { currentLocationId: toLocationId },
    },
  );
  await t.finishAllScheduledFunctions(() => vi.runAllTimers());
  const authorized = authedForUser(t, own.userId);
  const collection = await authorized.query(api.collections.get, {
    collectionId: own.collectionId,
  });
  const history = await authorized.query(
    api.locations.getCollectionLocationHistory,
    { collectionId: own.collectionId },
  );
  expect(collection?.currentLocationId).toBe(toLocationId);
  expect(history).toMatchObject([
    {
      collectionId: own.collectionId,
      fromLocationId,
      toLocationId,
      movedBy: own.userId,
      reason: "Bulk edit location change",
    },
  ]);
  expect(
    await authorized.query(api.batchOperations.getBatchJobStatus, { jobId }),
  ).toMatchObject({ successCount: 1, failureCount: 0 });
  vi.useRealTimers();
});

test("direct bulk location write rejects a foreign destination without partial changes", async () => {
  const t = createConvexTest();
  const own = await createOrgUserCollectionWithPermissions(t, [
    "locations.update",
    "collections.read",
  ]);
  const secondId = await t.run((ctx) =>
    ctx.db.insert("collections", {
      organizationId: own.organizationId,
      accessionNumber: "SECOND",
      title: "Second",
      status: "active",
      catalogedBy: own.userId,
      catalogedAt: Date.now(),
    }),
  );
  const foreign = await createOrgUserWithPermissions(t, []);
  const locationId = await t.run((ctx) =>
    ctx.db.insert("locations", {
      organizationId: foreign.organizationId,
      name: "Foreign",
      type: "room",
      sortOrder: 0,
      isActive: true,
    }),
  );
  await expect(
    authedForUser(t, own.userId).mutation(api.collections.bulkUpdateLocation, {
      collectionIds: [own.collectionId, secondId],
      locationId,
    }),
  ).rejects.toThrow();
  expect(
    (
      await authedForUser(t, own.userId).query(api.collections.get, {
        collectionId: own.collectionId,
      })
    )?.currentLocationId,
  ).toBeUndefined();
  expect(
    (
      await authedForUser(t, own.userId).query(api.collections.get, {
        collectionId: secondId,
      })
    )?.currentLocationId,
  ).toBeUndefined();
});

test("quick bulk edit rejects foreign locations and retains accountable valid movement", async () => {
  const t = createConvexTest();
  const own = await createOrgUserCollectionWithPermissions(t, [
    "collections.update",
    "collections.read",
  ]);
  const foreign = await createOrgUserWithPermissions(t, []);
  const [valid, invalid] = await t.run(async (ctx) =>
    Promise.all(
      [own, foreign].map(({ organizationId }) =>
        ctx.db.insert("locations", {
          organizationId,
          name: "Room",
          type: "room",
          sortOrder: 0,
          isActive: true,
        }),
      ),
    ),
  );
  const authorized = authedForUser(t, own.userId);
  await expect(
    authorized.mutation(api.batchOperations.quickBulkEdit, {
      organizationId: own.organizationId,
      collectionIds: [own.collectionId],
      updates: { currentLocationId: invalid, condition: "good" },
    }),
  ).rejects.toThrow();
  expect(
    await authorized.query(api.locations.getCollectionLocationHistory, {
      collectionId: own.collectionId,
    }),
  ).toEqual([]);
  await authorized.mutation(api.batchOperations.quickBulkEdit, {
    organizationId: own.organizationId,
    collectionIds: [own.collectionId],
    updates: { currentLocationId: valid },
  });
  expect(
    await authorized.query(api.locations.getCollectionLocationHistory, {
      collectionId: own.collectionId,
    }),
  ).toMatchObject([
    {
      toLocationId: valid,
      movedBy: own.userId,
      reason: "Bulk edit location change",
    },
  ]);
});

test("exhibition installation observes the current source and invalid return leaves status intact", async () => {
  const t = createConvexTest();
  const own = await createOrgUserCollectionWithPermissions(
    t,
    ["collections.update", "collections.read", "collections.accept_condition"],
    { subscriptionTier: "pro" },
  );
  const [original, observed, display] = await t.run(async (ctx) =>
    Promise.all(
      ["Original", "Observed", "Display"].map((name) =>
        ctx.db.insert("locations", {
          organizationId: own.organizationId,
          name,
          type: "room",
          sortOrder: 0,
          isActive: true,
        }),
      ),
    ),
  );
  const exhibitionId = await t.run((ctx) =>
    ctx.db.insert("exhibitions", {
      collectionId: own.collectionId,
      organizationId: own.organizationId,
      title: "Show",
      startDate: Date.now(),
      isCurrent: false,
      status: "approved",
      locationId: display,
      participationVersion: "members",
    }),
  );
  const authorized = authedForUser(t, own.userId);
  const exhibitionObjectId = await authorized.mutation(
    api.exhibitions.addExhibitionObject,
    {
      exhibitionId,
      collectionId: own.collectionId,
      originalLocationId: original,
    },
  );
  await t.run((ctx) =>
    ctx.db.patch(own.collectionId, { currentLocationId: observed }),
  );
  const assessmentId = await authorized.mutation(
    api.conditionAssessments.create,
    {
      collectionId: own.collectionId,
      assessedAt: Date.now(),
      condition: "Good",
      summary: "Observed before installation",
      observations: [],
      photos: [],
    },
  );
  await authorized.mutation(api.conditionAssessments.accept, { assessmentId });
  await authorized.mutation(api.exhibitions.installObject, {
    exhibitionObjectId,
    observedFromLocationId: observed,
    installationConditionAssessmentId: assessmentId,
  });
  expect(
    await authorized.query(api.locations.getCollectionLocationHistory, {
      collectionId: own.collectionId,
    }),
  ).toMatchObject([
    {
      fromLocationId: observed,
      toLocationId: display,
      movedBy: own.userId,
      reason: "Exhibition installation",
    },
  ]);
  await t.run((ctx) => ctx.db.patch(original, { isActive: false }));
  await expect(
    authorized.mutation(api.exhibitions.returnObjectToOriginalLocation, {
      exhibitionObjectId,
    }),
  ).rejects.toThrow();
  expect(
    await authorized.query(api.exhibitions.listExhibitionObjects, {
      exhibitionId,
    }),
  ).toMatchObject([{ status: "installed" }]);
});

test("owned upload binds organization and uploader before attachment and sessions are single use", async () => {
  const t = createConvexTest();
  const own = await createOrgUserCollectionWithPermissions(t, [
    "media.upload",
    "media.read",
  ]);
  const foreign = await createOrgUserCollectionWithPermissions(t, [
    "media.upload",
    "media.read",
  ]);
  const authorized = authedForUser(t, own.userId);
  const file = new Blob(["image"], { type: "image/jpeg" });
  const { uploadUrl } = await authorized.mutation(api.media.generateUploadUrl, {
    organizationId: own.organizationId,
    collectionId: own.collectionId,
    fileName: "owned.jpg",
    fileSize: file.size,
    mimeType: file.type,
  });
  const path = new URL(uploadUrl).pathname + new URL(uploadUrl).search;
  const response = await t.fetch(path, { method: "POST", body: file });
  expect(response.status).toBe(200);
  const result: {
    storageId: import("../convex/_generated/dataModel").Id<"_storage">;
  } = await response.json();
  expect((await t.fetch(path, { method: "POST", body: file })).status).toBe(
    403,
  );
  const uploadArgs = {
    storageId: result.storageId,
    fileName: "owned.jpg",
    fileSize: file.size,
    mimeType: file.type,
  };
  await expect(
    authedForUser(t, foreign.userId).mutation(api.media.create, {
      ...uploadArgs,
      organizationId: foreign.organizationId,
      collectionId: foreign.collectionId,
      isPrimary: false,
    }),
  ).rejects.toThrow("different organization");
  expect(
    await authedForUser(t, foreign.userId).query(api.media.list, {
      collectionId: foreign.collectionId,
    }),
  ).toEqual([]);
  await authorized.mutation(api.media.create, {
    ...uploadArgs,
    organizationId: own.organizationId,
    collectionId: own.collectionId,
    isPrimary: false,
  });
  expect(
    await authorized.query(api.media.list, { collectionId: own.collectionId }),
  ).toMatchObject([{ storageId: result.storageId }]);
  const unbound = await t.run((ctx) => ctx.storage.store(file));
  await expect(
    authorized.mutation(api.media.create, {
      ...uploadArgs,
      storageId: unbound,
      organizationId: own.organizationId,
      collectionId: own.collectionId,
    }),
  ).rejects.toThrow("authorized upload session");
  expect(
    await authorized.query(api.media.list, { collectionId: own.collectionId }),
  ).toHaveLength(1);
});

test("legacy integrity review reports foreign references and unbound media without modifying attachments", async () => {
  const t = createConvexTest();
  const own = await createOrgUserCollectionWithPermissions(t, [
    "collections.read",
    "media.read",
  ]);
  const foreign = await createOrgUserCollectionWithPermissions(t, []);
  const storageId = await t.run(async (ctx) => {
    const storageId = await ctx.storage.store(
      new Blob(["legacy"], { type: "image/jpeg" }),
    );
    await ctx.db.patch(own.collectionId, {
      parentObjectId: foreign.collectionId,
    });
    await ctx.db.insert("mediaFiles", {
      collectionId: own.collectionId,
      organizationId: own.organizationId,
      storageId,
      fileName: "legacy.jpg",
      fileType: "image",
      mimeType: "image/jpeg",
      fileSize: 6,
      isPrimary: false,
      uploadedBy: own.userId,
      uploadedAt: Date.now(),
      uploadStatus: "completed",
    });
    return storageId;
  });
  const authorized = authedForUser(t, own.userId);
  const args = {
    organizationId: own.organizationId,
    paginationOpts: { cursor: null, numItems: 25 },
  };
  expect(
    await authorized.query(api.media.reviewIntegrity, {
      ...args,
      kind: "collections",
    }),
  ).toMatchObject({
    issues: [
      { issue: "Parent object is missing or belongs to another organization" },
    ],
  });
  expect(
    await authorized.query(api.media.reviewIntegrity, {
      ...args,
      kind: "media",
    }),
  ).toMatchObject({
    issues: [
      {
        referencedId: storageId,
        issue: "File ownership is unverified; retain the file for review",
      },
    ],
  });
  expect(
    await authorized.query(api.media.list, { collectionId: own.collectionId }),
  ).toMatchObject([{ storageId }]);
  await expect(
    authedForUser(t, foreign.userId).query(api.media.reviewIntegrity, {
      ...args,
      kind: "media",
    }),
  ).rejects.toThrow();
});

test("delayed bulk edit rejects a destination closed after queuing without partial object changes", async () => {
  const t = createConvexTest();
  const own = await createOrgUserCollectionWithPermissions(t, [
    "collections.update",
    "collections.read",
  ]);
  const locationId = await t.run((ctx) =>
    ctx.db.insert("locations", {
      organizationId: own.organizationId,
      name: "Destination",
      type: "room",
      sortOrder: 0,
      isActive: true,
    }),
  );
  const authorized = authedForUser(t, own.userId);
  vi.useFakeTimers();
  try {
    const jobId = await authorized.mutation(
      api.batchOperations.createBulkEditJob,
      {
        organizationId: own.organizationId,
        collectionIds: [own.collectionId],
        updates: { currentLocationId: locationId, condition: "changed" },
      },
    );
    await t.run((ctx) => ctx.db.patch(locationId, { isActive: false }));
    await t.finishAllScheduledFunctions(() => vi.runAllTimers());
    expect(
      await authorized.query(api.batchOperations.getBatchJobStatus, { jobId }),
    ).toMatchObject({
      successCount: 0,
      failureCount: 1,
      errors: [
        {
          itemId: own.collectionId,
          error: "Location Destination is unavailable for moves",
        },
      ],
    });
    const collection = await authorized.query(api.collections.get, {
      collectionId: own.collectionId,
    });
    expect(collection?.currentLocationId).toBeUndefined();
    expect(collection?.condition).toBeUndefined();
    expect(
      await authorized.query(api.locations.getCollectionLocationHistory, {
        collectionId: own.collectionId,
      }),
    ).toEqual([]);
  } finally {
    vi.useRealTimers();
  }
});

test("scheduled bulk move records the observed source, requesting actor and supplied reason", async () => {
  const t = createConvexTest();
  const own = await createOrgUserCollectionWithPermissions(t, [
    "locations.update",
    "collections.read",
  ]);
  const [queuedSource, observedSource, destination] = await t.run((ctx) =>
    Promise.all(
      ["Queued", "Observed", "Destination"].map((name) =>
        ctx.db.insert("locations", {
          organizationId: own.organizationId,
          name,
          type: "room",
          sortOrder: 0,
          isActive: true,
        }),
      ),
    ),
  );
  const authorized = authedForUser(t, own.userId);
  await t.run((ctx) =>
    ctx.db.patch(own.collectionId, { currentLocationId: queuedSource }),
  );
  vi.useFakeTimers();
  try {
    const jobId = await authorized.mutation(
      api.batchOperations.createBulkMoveJob,
      {
        organizationId: own.organizationId,
        collectionIds: [own.collectionId],
        toLocationId: destination,
        reason: "Prepare conservation treatment",
      },
    );
    await t.run((ctx) =>
      ctx.db.patch(own.collectionId, { currentLocationId: observedSource }),
    );
    await t.finishAllScheduledFunctions(() => vi.runAllTimers());
    expect(
      await authorized.query(api.batchOperations.getBatchJobStatus, { jobId }),
    ).toMatchObject({ successCount: 1, failureCount: 0 });
    expect(
      await authorized.query(api.locations.getCollectionLocationHistory, {
        collectionId: own.collectionId,
      }),
    ).toMatchObject([
      {
        fromLocationId: observedSource,
        toLocationId: destination,
        movedBy: own.userId,
        reason: "Prepare conservation treatment",
      },
    ]);
  } finally {
    vi.useRealTimers();
  }
});

test("account relationships reject a foreign or missing related record before creating a link", async () => {
  const t = createConvexTest();
  const own = await createOrgUserWithPermissions(
    t,
    ["accounts.write", "accounts.read", "organization.manage_settings"],
    { enabledModules: ["accounts"] },
  );
  const foreign = await createOrgUserWithPermissions(t, []);
  const [accountId, ownLoanId, foreignLoanId] = await t.run(async (ctx) =>
    Promise.all([
      ctx.db.insert("accounts", {
        organizationId: own.organizationId,
        accountNumber: "A-1",
        accountType: "institution",
        businessName: "Own partner",
        createdBy: own.userId,
        createdAt: Date.now(),
      }),
      ctx.db.insert("loans", {
        organizationId: own.organizationId,
        loanNumber: "L-1",
        lenderBorrowerName: "Own",
        type: "outgoing",
        status: "pending",
        startDate: Date.now(),
      }),
      ctx.db.insert("loans", {
        organizationId: foreign.organizationId,
        loanNumber: "FOREIGN",
        lenderBorrowerName: "Foreign",
        type: "outgoing",
        status: "pending",
        startDate: Date.now(),
      }),
    ]),
  );
  const authorized = authedForUser(t, own.userId);
  const args = {
    accountId,
    relatedEntityType: "loan" as const,
    relationshipType: "lender" as const,
    startDate: Date.now(),
  };
  for (const relatedEntityId of [foreignLoanId, "missing-record"])
    await expect(
      authorized.mutation(api.accountRelationships.create, {
        ...args,
        relatedEntityId,
      }),
    ).rejects.toThrow();
  expect(
    await authorized.query(api.accountRelationships.list, { accountId }),
  ).toEqual([]);
  await authorized.mutation(api.accountRelationships.create, {
    ...args,
    relatedEntityId: ownLoanId,
  });
  expect(
    await authorized.query(api.accountRelationships.list, { accountId }),
  ).toMatchObject([{ relatedEntityId: ownLoanId }]);
});

test("bulk exhibition install rejects a foreign middle destination without partial moves or foreign names", async () => {
  const t = createConvexTest();
  const own = await createOrgUserCollectionWithPermissions(
    t,
    ["collections.update", "collections.read"],
    { subscriptionTier: "pro" },
  );
  const foreign = await createOrgUserWithPermissions(t, []);
  const { exhibitionId, collectionIds } = await t.run(async (ctx) => {
    const valid = await ctx.db.insert("locations", {
      organizationId: own.organizationId,
      name: "Gallery",
      type: "room",
      sortOrder: 0,
      isActive: true,
    });
    const invalid = await ctx.db.insert("locations", {
      organizationId: foreign.organizationId,
      name: "Private foreign vault",
      type: "room",
      sortOrder: 0,
      isActive: true,
    });
    const exhibitionId = await ctx.db.insert("exhibitions", {
      organizationId: own.organizationId,
      collectionId: own.collectionId,
      title: "Show",
      startDate: Date.now(),
      isCurrent: false,
      status: "approved",
      locationId: valid,
    });
    const collectionIds = [own.collectionId];
    for (const index of [1, 2])
      collectionIds.push(
        await ctx.db.insert("collections", {
          organizationId: own.organizationId,
          accessionNumber: `B-${index}`,
          title: `Object ${index}`,
          status: "active",
          catalogedBy: own.userId,
          catalogedAt: Date.now(),
        }),
      );
    for (const [index, collectionId] of collectionIds.entries())
      await ctx.db.insert("exhibitionObjects", {
        exhibitionId,
        organizationId: own.organizationId,
        collectionId,
        exhibitionLocationId: index === 1 ? invalid : valid,
        status: "pending",
      });
    return { exhibitionId, collectionIds };
  });
  const authorized = authedForUser(t, own.userId);
  const before = await authorized.query(api.exhibitions.listExhibitionObjects, {
    exhibitionId,
  });
  expect(before[1]?.exhibitionLocationName).toBeUndefined();
  await expect(
    authorized.mutation(api.exhibitions.bulkInstallObjects, { exhibitionId }),
  ).rejects.toThrow();
  expect(
    await authorized.query(api.exhibitions.listExhibitionObjects, {
      exhibitionId,
    }),
  ).toMatchObject([
    { status: "pending" },
    { status: "pending" },
    { status: "pending" },
  ]);
  for (const collectionId of collectionIds)
    expect(
      await authorized.query(api.locations.getCollectionLocationHistory, {
        collectionId,
      }),
    ).toEqual([]);
});

test("an upload session cannot be used after expiry and another member cannot claim its file", async () => {
  const t = createConvexTest();
  const own = await createOrgUserCollectionWithPermissions(t, [
    "media.upload",
    "media.read",
  ]);
  const other = await createOrgUserWithPermissions(t, []);
  await t.run((ctx) =>
    ctx.db.insert("userOrganizations", {
      organizationId: own.organizationId,
      userId: other.userId,
      roleId: own.roleId,
      joinedAt: Date.now(),
    }),
  );
  const authorized = authedForUser(t, own.userId);
  const args = {
    organizationId: own.organizationId,
    collectionId: own.collectionId,
    fileName: "owned.jpg",
    fileSize: 5,
    mimeType: "image/jpeg",
  };
  const first = new URL(
    (await authorized.mutation(api.media.generateUploadUrl, args)).uploadUrl,
  );
  const uploaded = await t.fetch(first.pathname + first.search, {
    method: "POST",
    body: new Blob(["image"], { type: "image/jpeg" }),
  });
  const {
    storageId,
  }: { storageId: import("../convex/_generated/dataModel").Id<"_storage"> } =
    await uploaded.json();
  await expect(
    authedForUser(t, other.userId).mutation(api.media.create, {
      ...args,
      storageId,
      isPrimary: false,
    }),
  ).rejects.toThrow("different uploader");
  expect(
    await authorized.query(api.media.list, { collectionId: own.collectionId }),
  ).toEqual([]);
  vi.useFakeTimers();
  try {
    const expired = new URL(
      (await authorized.mutation(api.media.generateUploadUrl, args)).uploadUrl,
    );
    vi.advanceTimersByTime(10 * 60 * 1000 + 1);
    expect(
      (
        await t.fetch(expired.pathname + expired.search, {
          method: "POST",
          body: new Blob(["image"]),
        })
      ).status,
    ).toBe(403);
  } finally {
    vi.useRealTimers();
  }
});

test("a trusted HTTP upload passes public-image ownership review and a fresh version revokes display", async () => {
  const t = createConvexTest();
  const own = await createOrgUserCollectionWithPermissions(t, [
    "media.upload",
    "media.read",
    "organization.manage_settings",
  ]);
  const { slug, accessionNumber } = await t.run(async (ctx) => {
    const org = await ctx.db.get(own.organizationId);
    const collection = await ctx.db.get(own.collectionId);
    await ctx.db.patch(own.organizationId, {
      settings: { portalSettings: { isEnabled: true } },
    });
    await ctx.db.patch(own.collectionId, { isPubliclyVisible: true });
    return {
      slug: org?.slug ?? "",
      accessionNumber: collection?.accessionNumber ?? "",
    };
  });
  const input = await sharp({
    create: { width: 20, height: 10, channels: 3, background: "red" },
  })
    .png()
    .toBuffer();
  const file = new Blob([new Uint8Array(input)], { type: "image/png" });
  const authorized = authedForUser(t, own.userId);
  const uploadArgs = {
    organizationId: own.organizationId,
    collectionId: own.collectionId,
    fileName: "verified.png",
    fileSize: file.size,
    mimeType: file.type,
  };
  const uploadUrl = new URL(
    (await authorized.mutation(api.media.generateUploadUrl, uploadArgs))
      .uploadUrl,
  );
  const uploaded = await t.fetch(uploadUrl.pathname + uploadUrl.search, {
    method: "POST",
    body: file,
  });
  const {
    storageId,
  }: { storageId: import("../convex/_generated/dataModel").Id<"_storage"> } =
    await uploaded.json();
  const mediaId = await authorized.mutation(api.media.create, {
    ...uploadArgs,
    storageId,
    isPrimary: false,
  });
  await authorized.mutation(api.media.updateRights, {
    mediaId,
    rightsStatus: "owned",
  });
  const fetchMock = vi
    .spyOn(globalThis, "fetch")
    .mockImplementation(
      async () => new Response(new Uint8Array(input), { status: 200 }),
    );
  vi.useFakeTimers();
  try {
    await authorized.mutation(api.mediaPublications.approve, { mediaId });
    await t.finishAllScheduledFunctions(() => vi.runAllTimers());
    expect(
      await authorized.query(api.mediaPublications.getReview, { mediaId }),
    ).toMatchObject({
      status: "approved",
      blocker: null,
      originalDownloadAllowed: false,
    });
    const publicArgs = { organizationSlug: slug, accessionNumber };
    expect(
      (await t.query(api.collections.getPublic, publicArgs))?.images,
    ).toHaveLength(1);
    const versionUrl = new URL(
      (await authorized.mutation(api.media.generateUploadUrl, uploadArgs))
        .uploadUrl,
    );
    const versionUpload = await t.fetch(
      versionUrl.pathname + versionUrl.search,
      { method: "POST", body: file },
    );
    const version: {
      storageId: import("../convex/_generated/dataModel").Id<"_storage">;
    } = await versionUpload.json();
    await authorized.mutation(api.mediaVersions.createVersion, {
      mediaId,
      storageId: version.storageId,
      editType: "crop",
    });
    expect(
      (await t.query(api.collections.getPublic, publicArgs))?.images,
    ).toEqual([]);
    expect(
      await authorized.query(api.mediaPublications.getReview, { mediaId }),
    ).toMatchObject({ status: "private", blocker: null });
  } finally {
    fetchMock.mockRestore();
    vi.useRealTimers();
  }
});

test("primary upload thumbnail attaches an owned derivative without stranding approval", async () => {
  const t = createConvexTest();
  const own = await createOrgUserCollectionWithPermissions(t, [
    "media.upload",
    "media.read",
    "organization.manage_settings",
  ]);
  const input = await sharp({
    create: { width: 900, height: 600, channels: 3, background: "blue" },
  })
    .png()
    .toBuffer();
  const file = new Blob([new Uint8Array(input)], { type: "image/png" });
  const authorized = authedForUser(t, own.userId);
  const uploadArgs = {
    organizationId: own.organizationId,
    collectionId: own.collectionId,
    fileName: "primary.png",
    fileSize: file.size,
    mimeType: file.type,
  };
  const uploadUrl = new URL(
    (await authorized.mutation(api.media.generateUploadUrl, uploadArgs))
      .uploadUrl,
  );
  const uploaded = await t.fetch(uploadUrl.pathname + uploadUrl.search, {
    method: "POST",
    body: file,
  });
  const {
    storageId,
  }: { storageId: import("../convex/_generated/dataModel").Id<"_storage"> } =
    await uploaded.json();
  const fetchMock = vi
    .spyOn(globalThis, "fetch")
    .mockImplementation(
      async () => new Response(new Uint8Array(input), { status: 200 }),
    );
  vi.useFakeTimers();
  try {
    const mediaId = await authorized.mutation(api.media.create, {
      ...uploadArgs,
      storageId,
      isPrimary: true,
    });
    await t.finishAllScheduledFunctions(() => vi.runAllTimers());
    const [listed] = await authorized.query(api.media.list, {
      collectionId: own.collectionId,
    });
    expect(listed).toMatchObject({
      _id: mediaId,
      storageId,
      uploadStatus: "completed",
    });
    expect(listed?.thumbnailStorageId).toBeDefined();
    expect(listed?.thumbnailUrl).toEqual(expect.any(String));
    await authorized.mutation(api.media.updateRights, {
      mediaId,
      rightsStatus: "owned",
    });
    expect(
      await authorized.query(api.mediaPublications.getReview, { mediaId }),
    ).toMatchObject({ blocker: null });
    await authorized.mutation(api.mediaPublications.approve, { mediaId });
    await t.finishAllScheduledFunctions(() => vi.runAllTimers());
    expect(
      await authorized.query(api.mediaPublications.getReview, { mediaId }),
    ).toMatchObject({ status: "approved", blocker: null });

    // Re-requesting a thumbnail for an image that already has one must not
    // create another derivative.
    await authorized.mutation(api.media.setPrimary, { mediaId });
    await t.finishAllScheduledFunctions(() => vi.runAllTimers());
    const [again] = await authorized.query(api.media.list, {
      collectionId: own.collectionId,
    });
    expect(again?.thumbnailStorageId).toBe(listed?.thumbnailStorageId);
    expect(again?.uploadStatus).toBe("completed");
  } finally {
    fetchMock.mockRestore();
    vi.useRealTimers();
  }
});

test("a legacy image stranded in thumbnail processing recovers when re-selected as primary", async () => {
  const t = createConvexTest();
  const own = await createOrgUserCollectionWithPermissions(t, [
    "media.upload",
    "media.read",
  ]);
  const input = await sharp({
    create: { width: 40, height: 20, channels: 3, background: "green" },
  })
    .png()
    .toBuffer();
  const mediaId = await t.run(async (ctx) => {
    const storageId = await ctx.storage.store(
      new Blob([new Uint8Array(input)], { type: "image/png" }),
    );
    return await ctx.db.insert("mediaFiles", {
      organizationId: own.organizationId,
      collectionId: own.collectionId,
      storageId,
      fileName: "stranded.png",
      fileType: "image",
      fileSize: input.length,
      mimeType: "image/png",
      isPrimary: true,
      uploadedBy: own.userId,
      uploadedAt: Date.now(),
      uploadStatus: "processing",
    });
  });
  const authorized = authedForUser(t, own.userId);
  const fetchMock = vi
    .spyOn(globalThis, "fetch")
    .mockImplementation(
      async () => new Response(new Uint8Array(input), { status: 200 }),
    );
  vi.useFakeTimers();
  try {
    await authorized.mutation(api.media.setPrimary, { mediaId });
    await t.finishAllScheduledFunctions(() => vi.runAllTimers());
  } finally {
    fetchMock.mockRestore();
    vi.useRealTimers();
  }
  const [listed] = await authorized.query(api.media.list, {
    collectionId: own.collectionId,
  });
  expect(listed).toMatchObject({ _id: mediaId, uploadStatus: "completed" });
  expect(listed?.thumbnailStorageId).toBeDefined();
});

test("stranded upload recovery restores completed originals and leaves chunked uploads in progress", async () => {
  const t = createConvexTest();
  const own = await createOrgUserCollectionWithPermissions(t, [
    "media.read",
    "media.upload",
    "organization.manage_settings",
  ]);
  const input = await sharp({
    create: { width: 30, height: 30, channels: 3, background: "white" },
  })
    .png()
    .toBuffer();
  const { strandedId, chunkedId } = await t.run(async (ctx) => {
    const storageId = await ctx.storage.store(
      new Blob([new Uint8Array(input)], { type: "image/png" }),
    );
    const base = {
      organizationId: own.organizationId,
      collectionId: own.collectionId,
      storageId,
      fileType: "image",
      fileSize: input.length,
      mimeType: "image/png",
      uploadedBy: own.userId,
      uploadedAt: Date.now(),
      uploadStatus: "processing" as const,
    };
    await ctx.db.insert("storageOwnership", {
      storageId,
      organizationId: own.organizationId,
      uploadedBy: own.userId,
      uploadedAt: Date.now(),
      ownerType: "media",
    });
    const strandedId = await ctx.db.insert("mediaFiles", {
      ...base,
      fileName: "stranded.png",
      isPrimary: true,
      rightsStatus: "owned",
    });
    const chunkedId = await ctx.db.insert("mediaFiles", {
      ...base,
      fileName: "chunked.png",
      isPrimary: false,
      chunkedUploadId: "chunk-in-progress",
    });
    return { strandedId, chunkedId };
  });
  const fetchMock = vi
    .spyOn(globalThis, "fetch")
    .mockImplementation(
      async () => new Response(new Uint8Array(input), { status: 200 }),
    );
  vi.useFakeTimers();
  try {
    await t.mutation(internal.migrations.recoverStrandedMediaUploads, {});
    await t.finishAllScheduledFunctions(() => vi.runAllTimers());
  } finally {
    fetchMock.mockRestore();
    vi.useRealTimers();
  }
  const authorized = authedForUser(t, own.userId);
  const media = await authorized.query(api.media.list, {
    collectionId: own.collectionId,
  });
  expect(media.find((item) => item._id === strandedId)).toMatchObject({
    uploadStatus: "completed",
    thumbnailStorageId: expect.any(String),
  });
  expect(media.find((item) => item._id === chunkedId)?.uploadStatus).toBe(
    "processing",
  );
});
