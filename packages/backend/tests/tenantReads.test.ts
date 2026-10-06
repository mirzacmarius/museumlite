import { expect, test } from "vitest";
import { api } from "../convex/_generated/api";
import {
  authedForUser,
  createConvexTest,
  createOrgUserCollectionWithPermissions,
  createOrgUserWithPermissions,
} from "./testHarness";

test("import diagnostics are available to operators only in their organization", async () => {
  const t = createConvexTest();
  const operator = await createOrgUserWithPermissions(t, [
    "collections.create",
  ]);
  const stranger = await createOrgUserWithPermissions(t, [
    "collections.create",
  ]);
  const wrongRole = await createOrgUserWithPermissions(t, []);
  await t.run((ctx) =>
    ctx.db.insert("userOrganizations", {
      userId: wrongRole.userId,
      organizationId: operator.organizationId,
      roleId: wrongRole.roleId,
      joinedAt: Date.now(),
    }),
  );
  const jobId = await t.run((ctx) =>
    ctx.db.insert("importJobs", {
      organizationId: operator.organizationId,
      type: "csv",
      status: "failed",
      progress: 50,
      totalItems: 2,
      processedItems: 1,
      errors: ["Private donor: invalid accession"],
      createdBy: operator.userId,
      createdAt: Date.now(),
    }),
  );

  expect(
    await authedForUser(t, operator.userId).query(api.imports.getImportJob, {
      jobId,
    }),
  ).toMatchObject({
    status: "failed",
    errors: ["Private donor: invalid accession"],
  });
  expect(
    await authedForUser(t, operator.userId).query(api.imports.listImportJobs, {
      organizationId: operator.organizationId,
    }),
  ).toHaveLength(1);
  for (const caller of [
    t,
    authedForUser(t, stranger.userId),
    authedForUser(t, wrongRole.userId),
  ]) {
    expect(await caller.query(api.imports.getImportJob, { jobId })).toBeNull();
    expect(
      await caller.query(api.imports.listImportJobs, {
        organizationId: operator.organizationId,
      }),
    ).toEqual([]);
  }
});

test("primary image batch rejects foreign objects in first, middle and last positions", async () => {
  const t = createConvexTest();
  const own = await createOrgUserCollectionWithPermissions(t, ["media.read"]);
  const foreign = await createOrgUserCollectionWithPermissions(t, [
    "media.read",
  ]);
  const wrongRole = await createOrgUserWithPermissions(t, []);
  await t.run((ctx) =>
    ctx.db.insert("userOrganizations", {
      userId: wrongRole.userId,
      organizationId: own.organizationId,
      roleId: wrongRole.roleId,
      joinedAt: Date.now(),
    }),
  );
  await t.run(async (ctx) => {
    for (const collection of [own, foreign]) {
      const storageId = await ctx.storage.store(
        new Blob(["image"], { type: "image/jpeg" }),
      );
      await ctx.db.insert("mediaFiles", {
        organizationId: collection.organizationId,
        collectionId: collection.collectionId,
        storageId,
        fileName: "private.jpg",
        fileType: "image",
        fileSize: 5,
        mimeType: "image/jpeg",
        isPrimary: true,
        uploadedBy: collection.userId,
        uploadedAt: Date.now(),
        uploadStatus: "completed",
      });
    }
  });
  const authorized = authedForUser(t, own.userId);
  expect(
    (
      await authorized.query(api.media.getBatchPrimaryImageUrls, {
        collectionIds: [own.collectionId],
      })
    )[0]?.url,
  ).toBeTruthy();
  const secondOwnCollectionId = await t.run((ctx) =>
    ctx.db.insert("collections", {
      organizationId: own.organizationId,
      accessionNumber: "SECOND-OWN-IMAGE",
      title: "Second object",
      status: "active",
      catalogedBy: own.userId,
      catalogedAt: Date.now(),
    }),
  );
  expect(
    await authorized.query(api.media.getBatchPrimaryImageUrls, {
      collectionIds: [own.collectionId, secondOwnCollectionId],
    }),
  ).toMatchObject([
    { collectionId: own.collectionId },
    { collectionId: secondOwnCollectionId, url: null },
  ]);
  for (const collectionIds of [
    [own.collectionId, foreign.collectionId],
    [foreign.collectionId, own.collectionId],
    [own.collectionId, foreign.collectionId, secondOwnCollectionId],
  ]) {
    await expect(
      authorized.query(api.media.getBatchPrimaryImageUrls, { collectionIds }),
    ).rejects.toThrow();
  }
  const missingCollectionId = await t.run(async (ctx) => {
    const id = await ctx.db.insert("collections", {
      organizationId: own.organizationId,
      accessionNumber: "MISSING",
      title: "Missing",
      status: "active",
      catalogedBy: own.userId,
      catalogedAt: Date.now(),
    });
    await ctx.db.delete(id);
    return id;
  });
  expect(
    await authorized.query(api.media.getBatchPrimaryImageUrls, {
      collectionIds: [
        own.collectionId,
        missingCollectionId,
        secondOwnCollectionId,
      ],
    }),
  ).toMatchObject([
    { collectionId: own.collectionId },
    { collectionId: missingCollectionId, url: null },
    { collectionId: secondOwnCollectionId, url: null },
  ]);
  await expect(
    authorized.query(api.media.getBatchPrimaryImageUrls, {
      collectionIds: Array.from({ length: 201 }, () => own.collectionId),
    }),
  ).rejects.toThrow("Collection batch is too large");
  await expect(
    t.query(api.media.getBatchPrimaryImageUrls, {
      collectionIds: [own.collectionId],
    }),
  ).rejects.toThrow();
  await expect(
    authedForUser(t, wrongRole.userId).query(
      api.media.getBatchPrimaryImageUrls,
      { collectionIds: [own.collectionId] },
    ),
  ).rejects.toThrow();
});

test("active loan batch rejects foreign objects in first, middle and last positions", async () => {
  const t = createConvexTest();
  const own = await createOrgUserCollectionWithPermissions(t, ["loans.read"], {
    subscriptionTier: "pro",
  });
  const foreign = await createOrgUserCollectionWithPermissions(
    t,
    ["loans.read"],
    { subscriptionTier: "pro" },
  );
  const wrongRole = await createOrgUserWithPermissions(t, [], {
    subscriptionTier: "pro",
  });
  await t.run((ctx) =>
    ctx.db.insert("userOrganizations", {
      userId: wrongRole.userId,
      organizationId: own.organizationId,
      roleId: wrongRole.roleId,
      joinedAt: Date.now(),
    }),
  );
  await t.run(async (ctx) => {
    for (const [collection, loanNumber] of [
      [own, "OWN-LOAN"],
      [foreign, "PRIVATE-LOAN"],
    ] as const) {
      const loanId = await ctx.db.insert("loans", {
        organizationId: collection.organizationId,
        loanNumber,
        lenderBorrowerName: "Partner",
        type: "outgoing",
        status: "active",
        startDate: Date.now(),
      });
      await ctx.db.insert("loanItems", {
        loanId,
        collectionId: collection.collectionId,
      });
    }
  });
  const authorized = authedForUser(t, own.userId);
  expect(
    await authorized.query(api.loans.checkCollectionsInActiveLoans, {
      collectionIds: [own.collectionId],
    }),
  ).toMatchObject([{ loanNumber: "OWN-LOAN" }]);
  const secondOwnCollectionId = await t.run((ctx) =>
    ctx.db.insert("collections", {
      organizationId: own.organizationId,
      accessionNumber: "SECOND-OWN-LOAN",
      title: "Second object",
      status: "active",
      catalogedBy: own.userId,
      catalogedAt: Date.now(),
    }),
  );
  expect(
    await authorized.query(api.loans.checkCollectionsInActiveLoans, {
      collectionIds: [own.collectionId, secondOwnCollectionId],
    }),
  ).toMatchObject([{ loanNumber: "OWN-LOAN" }]);
  for (const collectionIds of [
    [own.collectionId, foreign.collectionId],
    [foreign.collectionId, own.collectionId],
    [own.collectionId, foreign.collectionId, secondOwnCollectionId],
  ]) {
    await expect(
      authorized.query(api.loans.checkCollectionsInActiveLoans, {
        collectionIds,
      }),
    ).rejects.toThrow();
  }
  const missingCollectionId = await t.run(async (ctx) => {
    const id = await ctx.db.insert("collections", {
      organizationId: own.organizationId,
      accessionNumber: "MISSING",
      title: "Missing",
      status: "active",
      catalogedBy: own.userId,
      catalogedAt: Date.now(),
    });
    await ctx.db.delete(id);
    return id;
  });
  expect(
    await authorized.query(api.loans.checkCollectionsInActiveLoans, {
      collectionIds: [
        own.collectionId,
        missingCollectionId,
        secondOwnCollectionId,
      ],
    }),
  ).toMatchObject([{ loanNumber: "OWN-LOAN" }]);
  await expect(
    authorized.query(api.loans.checkCollectionsInActiveLoans, {
      collectionIds: Array.from({ length: 201 }, () => own.collectionId),
    }),
  ).rejects.toThrow("Collection batch is too large");
  await expect(
    t.query(api.loans.checkCollectionsInActiveLoans, {
      collectionIds: [own.collectionId],
    }),
  ).rejects.toThrow();
  await expect(
    authedForUser(t, wrongRole.userId).query(
      api.loans.checkCollectionsInActiveLoans,
      { collectionIds: [own.collectionId] },
    ),
  ).rejects.toThrow();
});

test("entity relationships return only authorized organization rows", async () => {
  const t = createConvexTest();
  const own = await createOrgUserWithPermissions(t, ["accounts.read"], {
    enabledModules: ["accounts"],
  });
  const foreign = await createOrgUserWithPermissions(t, ["accounts.read"], {
    enabledModules: ["accounts"],
  });
  const wrongRole = await createOrgUserWithPermissions(t, [], {
    enabledModules: ["accounts"],
  });
  await t.run((ctx) =>
    ctx.db.insert("userOrganizations", {
      userId: wrongRole.userId,
      organizationId: own.organizationId,
      roleId: wrongRole.roleId,
      joinedAt: Date.now(),
    }),
  );
  await t.run(async (ctx) => {
    for (const organization of [own, foreign]) {
      const accountId = await ctx.db.insert("accounts", {
        organizationId: organization.organizationId,
        accountNumber: "ACC-1",
        accountType: "institution",
        businessName: "Private party",
        createdBy: organization.userId,
        createdAt: Date.now(),
      });
      await ctx.db.insert("accountRelationships", {
        organizationId: organization.organizationId,
        accountId,
        relatedEntityType: "loan",
        relatedEntityId: "SHARED-ID",
        relationshipType: "lender",
        startDate: Date.now(),
        createdAt: Date.now(),
      });
    }
  });
  const args = {
    relatedEntityType: "loan" as const,
    relatedEntityId: "SHARED-ID",
  };
  expect(
    (
      await authedForUser(t, own.userId).query(
        api.accountRelationships.listByEntity,
        args,
      )
    ).map((row) => row.organizationId),
  ).toEqual([own.organizationId]);
  expect(await t.query(api.accountRelationships.listByEntity, args)).toEqual(
    [],
  );
  expect(
    await authedForUser(t, wrongRole.userId).query(
      api.accountRelationships.listByEntity,
      args,
    ),
  ).toEqual([]);
});

test("linked records with conflicting organizations cannot disclose media or loan metadata", async () => {
  const t = createConvexTest();
  const own = await createOrgUserCollectionWithPermissions(
    t,
    ["media.read", "loans.read"],
    { subscriptionTier: "pro" },
  );
  const foreign = await createOrgUserCollectionWithPermissions(t, [], {
    subscriptionTier: "pro",
  });
  await t.run(async (ctx) => {
    const storageId = await ctx.storage.store(
      new Blob(["private"], { type: "image/jpeg" }),
    );
    await ctx.db.insert("mediaFiles", {
      organizationId: foreign.organizationId,
      collectionId: own.collectionId,
      storageId,
      fileName: "private.jpg",
      fileType: "image",
      fileSize: 7,
      mimeType: "image/jpeg",
      isPrimary: true,
      uploadedBy: foreign.userId,
      uploadedAt: Date.now(),
      uploadStatus: "completed",
    });
    const loanId = await ctx.db.insert("loans", {
      organizationId: foreign.organizationId,
      loanNumber: "PRIVATE-LOAN",
      lenderBorrowerName: "Private partner",
      type: "outgoing",
      status: "active",
      startDate: Date.now(),
    });
    await ctx.db.insert("loanItems", {
      loanId,
      collectionId: own.collectionId,
    });
  });
  const authorized = authedForUser(t, own.userId);
  await expect(
    authorized.query(api.media.getPrimaryImageUrl, {
      collectionId: own.collectionId,
    }),
  ).rejects.toThrow();
  await expect(
    authorized.query(api.media.getBatchPrimaryImageUrls, {
      collectionIds: [own.collectionId],
    }),
  ).rejects.toThrow();
  await expect(
    authorized.query(api.loans.checkCollectionsInActiveLoans, {
      collectionIds: [own.collectionId],
    }),
  ).rejects.toThrow();
  expect(
    await authorized.query(api.loans.getLoansForCollection, {
      collectionId: own.collectionId,
    }),
  ).toEqual([]);
});

test("relationship reads ignore rows linked across organization boundaries", async () => {
  const t = createConvexTest();
  const own = await createOrgUserWithPermissions(t, ["accounts.read"], {
    enabledModules: ["accounts"],
  });
  const foreign = await createOrgUserWithPermissions(t, [], {
    enabledModules: ["accounts"],
  });
  const accountId = await t.run((ctx) =>
    ctx.db.insert("accounts", {
      organizationId: own.organizationId,
      accountNumber: "OWN-ACC",
      accountType: "institution",
      businessName: "Own",
      createdBy: own.userId,
      createdAt: Date.now(),
    }),
  );
  const foreignAccountId = await t.run((ctx) =>
    ctx.db.insert("accounts", {
      organizationId: foreign.organizationId,
      accountNumber: "FOREIGN-ACC",
      accountType: "institution",
      businessName: "Foreign",
      createdBy: foreign.userId,
      createdAt: Date.now(),
    }),
  );
  await t.run(async (ctx) => {
    await ctx.db.insert("accountRelationships", {
      organizationId: foreign.organizationId,
      accountId,
      relatedEntityType: "loan",
      relatedEntityId: "OWN-LOAN",
      relationshipType: "lender",
      startDate: Date.now(),
      createdAt: Date.now(),
    });
    await ctx.db.insert("accountRelationships", {
      organizationId: own.organizationId,
      accountId: foreignAccountId,
      relatedEntityType: "loan",
      relatedEntityId: "OWN-LOAN",
      relationshipType: "lender",
      startDate: Date.now(),
      createdAt: Date.now(),
    });
  });
  const authorized = authedForUser(t, own.userId);
  expect(
    await authorized.query(api.accountRelationships.list, { accountId }),
  ).toEqual([]);
  expect(
    (await authorized.query(api.accountRelationships.timeline, { accountId }))
      .events,
  ).toEqual([]);
  expect(
    await authorized.query(api.accountRelationships.listByEntity, {
      relatedEntityType: "loan",
      relatedEntityId: "OWN-LOAN",
    }),
  ).toEqual([]);
});
