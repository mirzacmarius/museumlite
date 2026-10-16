import { expect, test } from "vitest";
import { api } from "../convex/_generated/api";
import {
  authedForUser,
  createConvexTest,
  createOrgUserWithPermissions,
} from "./testHarness";

async function createExhibitionFixture(t: ReturnType<typeof createConvexTest>) {
  const { organizationId, userId } = await createOrgUserWithPermissions(
    t,
    [
      "collections.read",
      "collections.update",
      "collections.delete",
      "collections.accept_condition",
    ],
    {
      subscriptionTier: "pro",
      slugPrefix: "loan-guards",
      organizationName: "Loan Guards Museum",
    },
  );

  const {
    anchorCollectionId,
    activeCollectionId,
    loanedCollectionId,
    exhibitionId,
    locationId,
    storageLocationId,
  } = await t.run(async (ctx) => {
    const storageLocationId = await ctx.db.insert("locations", {
      organizationId,
      name: "Storage",
      type: "storage",
      sortOrder: 0,
      isActive: true,
    });
    const locationId = await ctx.db.insert("locations", {
      organizationId,
      name: "Main Gallery",
      type: "gallery",
      sortOrder: 1,
      isActive: true,
    });

    const [anchorCollectionId, activeCollectionId, loanedCollectionId] =
      await Promise.all([
        ctx.db.insert("collections", {
          organizationId,
          accessionNumber: "EXH-001",
          title: "Exhibition anchor",
          status: "active",
          catalogedBy: userId,
          catalogedAt: Date.now(),
        }),
        ctx.db.insert("collections", {
          organizationId,
          accessionNumber: "OBJ-ACTIVE",
          title: "Active object",
          status: "active",
          catalogedBy: userId,
          catalogedAt: Date.now(),
          currentLocationId: storageLocationId,
        }),
        ctx.db.insert("collections", {
          organizationId,
          accessionNumber: "OBJ-LOANED",
          title: "Loaned object",
          status: "loaned",
          catalogedBy: userId,
          catalogedAt: Date.now(),
        }),
      ]);

    const exhibitionId = await ctx.db.insert("exhibitions", {
      collectionId: anchorCollectionId,
      organizationId,
      title: "Summer Show",
      startDate: Date.now(),
      isCurrent: false,
      status: "approved",
      locationId,
      participationVersion: "members",
    });
    await ctx.db.insert("exhibitionObjects", {
      exhibitionId,
      organizationId,
      collectionId: anchorCollectionId,
      role: "participant",
      order: 0,
      status: "pending",
      exhibitionLocationId: locationId,
    });

    return {
      anchorCollectionId,
      activeCollectionId,
      loanedCollectionId,
      exhibitionId,
      locationId,
      storageLocationId,
    };
  });

  const authed = authedForUser(t, userId);

  return {
    authed,
    organizationId,
    userId,
    anchorCollectionId,
    activeCollectionId,
    loanedCollectionId,
    exhibitionId,
    locationId,
    storageLocationId,
  };
}

test("addExhibitionObject rejects loaned objects", async () => {
  const t = createConvexTest();
  const { authed, exhibitionId, loanedCollectionId } =
    await createExhibitionFixture(t);

  await expect(
    authed.mutation(api.exhibitions.addExhibitionObject, {
      exhibitionId,
      collectionId: loanedCollectionId,
    }),
  ).rejects.toThrow("Cannot add an object that is currently on loan");
});

test("addExhibitionObject succeeds for active objects", async () => {
  const t = createConvexTest();
  const { authed, exhibitionId, activeCollectionId } =
    await createExhibitionFixture(t);

  const exhibitionObjectId = await authed.mutation(
    api.exhibitions.addExhibitionObject,
    {
      exhibitionId,
      collectionId: activeCollectionId,
    },
  );

  const exhibitionObject = await t.run(async (ctx) =>
    ctx.db.get(exhibitionObjectId),
  );
  expect(exhibitionObject?.status).toBe("pending");
  expect(exhibitionObject?.collectionId).toBe(activeCollectionId);
});

test("installObject rejects loaned objects", async () => {
  const t = createConvexTest();
  const {
    authed,
    exhibitionId,
    loanedCollectionId,
    organizationId,
    locationId,
    storageLocationId,
  } = await createExhibitionFixture(t);

  const exhibitionObjectId = await t.run(async (ctx) => {
    return await ctx.db.insert("exhibitionObjects", {
      exhibitionId,
      organizationId,
      collectionId: loanedCollectionId,
      status: "pending",
      exhibitionLocationId: locationId,
    });
  });

  await expect(
    authed.mutation(api.exhibitions.installObject, {
      exhibitionObjectId,
      observedFromLocationId: storageLocationId,
    }),
  ).rejects.toThrow("Cannot install an object that is currently on loan");
});

test("installObject succeeds for active objects", async () => {
  const t = createConvexTest();
  const {
    authed,
    exhibitionId,
    activeCollectionId,
    organizationId,
    locationId,
    storageLocationId,
  } = await createExhibitionFixture(t);

  const exhibitionObjectId = await t.run(async (ctx) => {
    return await ctx.db.insert("exhibitionObjects", {
      exhibitionId,
      organizationId,
      collectionId: activeCollectionId,
      status: "pending",
      exhibitionLocationId: locationId,
      originalLocationId: storageLocationId,
    });
  });

  const installationAssessment1 = await authed.mutation(
    api.conditionAssessments.create,
    {
      collectionId: activeCollectionId,
      assessedAt: Date.now(),
      condition: "Good",
      summary: "Installation check",
      observations: [],
      photos: [],
      submit: true,
    },
  );
  await authed.mutation(api.conditionAssessments.accept, {
    assessmentId: installationAssessment1,
  });
  await authed.mutation(api.exhibitions.installObject, {
    exhibitionObjectId,
    observedFromLocationId: storageLocationId,
    installationConditionAssessmentId: installationAssessment1,
  });

  const result = await t.run(async (ctx) => {
    const [exhibitionObject, collection] = await Promise.all([
      ctx.db.get(exhibitionObjectId),
      ctx.db.get(activeCollectionId),
    ]);
    return { collection, exhibitionObject };
  });

  expect(result.exhibitionObject?.status).toBe("installed");
  expect(result.collection?.currentLocationId).toBe(locationId);
});

test("activateExhibition rejects when a pending object is on loan", async () => {
  const t = createConvexTest();
  const { authed, exhibitionId, loanedCollectionId, organizationId } =
    await createExhibitionFixture(t);

  await t.run(async (ctx) => {
    await ctx.db.insert("exhibitionObjects", {
      exhibitionId,
      organizationId,
      collectionId: loanedCollectionId,
      status: "pending",
    });
  });

  await expect(
    authed.mutation(api.exhibitions.activate, {
      exhibitionId,
      skipInstallationCheck: true,
    }),
  ).rejects.toThrow(
    'Cannot activate exhibition: object "Loaned object" is currently on loan',
  );

  const exhibition = await t.run(async (ctx) => ctx.db.get(exhibitionId));
  expect(exhibition?.status).toBe("approved");
});

test("activateExhibition succeeds when pending objects are active", async () => {
  const t = createConvexTest();
  const {
    authed,
    exhibitionId,
    activeCollectionId,
    organizationId,
    locationId,
    storageLocationId,
  } = await createExhibitionFixture(t);

  await t.run(async (ctx) => {
    await ctx.db.insert("exhibitionObjects", {
      exhibitionId,
      organizationId,
      collectionId: activeCollectionId,
      status: "pending",
      exhibitionLocationId: locationId,
      originalLocationId: storageLocationId,
    });
  });

  const exhibitionObjects = await t.run(async (ctx) =>
    ctx.db
      .query("exhibitionObjects")
      .withIndex("by_exhibition", (q) => q.eq("exhibitionId", exhibitionId))
      .collect(),
  );
  const activeObject = exhibitionObjects.find(
    (row) => row.collectionId === activeCollectionId,
  );
  const anchorObject = exhibitionObjects.find(
    (row) => row.collectionId !== activeCollectionId,
  );
  if (!activeObject || !anchorObject)
    throw new Error("Missing exhibition objects");

  const installationAssessment2 = await authed.mutation(
    api.conditionAssessments.create,
    {
      collectionId: activeCollectionId,
      assessedAt: Date.now(),
      condition: "Good",
      summary: "Installation check",
      observations: [],
      photos: [],
      submit: true,
    },
  );
  await authed.mutation(api.conditionAssessments.accept, {
    assessmentId: installationAssessment2,
  });
  await authed.mutation(api.exhibitions.installObject, {
    exhibitionObjectId: activeObject._id,
    observedFromLocationId: storageLocationId,
    installationConditionAssessmentId: installationAssessment2,
  });
  const installationAssessment3 = await authed.mutation(
    api.conditionAssessments.create,
    {
      collectionId: anchorObject.collectionId,
      assessedAt: Date.now(),
      condition: "Good",
      summary: "Installation check",
      observations: [],
      photos: [],
      submit: true,
    },
  );
  await authed.mutation(api.conditionAssessments.accept, {
    assessmentId: installationAssessment3,
  });
  await authed.mutation(api.exhibitions.installObject, {
    exhibitionObjectId: anchorObject._id,
    observedFromLocationId: null,
    installationConditionAssessmentId: installationAssessment3,
  });

  await authed.mutation(api.exhibitions.activate, {
    exhibitionId,
  });

  const result = await t.run(async (ctx) => {
    const [exhibition, exhibitionObjects, collection] = await Promise.all([
      ctx.db.get(exhibitionId),
      ctx.db
        .query("exhibitionObjects")
        .withIndex("by_exhibition", (q) => q.eq("exhibitionId", exhibitionId))
        .collect(),
      ctx.db.get(activeCollectionId),
    ]);
    return { collection, exhibition, exhibitionObjects };
  });

  expect(result.exhibition?.status).toBe("active");
  expect(result.exhibitionObjects).toHaveLength(2);
  expect(
    result.exhibitionObjects.every((row) => row.status === "installed"),
  ).toBe(true);
  expect(result.collection?.currentLocationId).toBe(locationId);
});
