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
    ["collections.read", "collections.update", "collections.delete"],
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
  } = await t.run(async (ctx) => {
    const locationId = await ctx.db.insert("locations", {
      organizationId,
      name: "Main Gallery",
      type: "gallery",
      sortOrder: 0,
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
          currentLocationId: locationId,
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
    });

    return {
      anchorCollectionId,
      activeCollectionId,
      loanedCollectionId,
      exhibitionId,
      locationId,
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
  };
}

test("deleteCollection rejects loaned objects", async () => {
  const t = createConvexTest();
  const { authed, loanedCollectionId } = await createExhibitionFixture(t);

  await expect(
    authed.mutation(api.collections.deleteCollection, {
      collectionId: loanedCollectionId,
    }),
  ).rejects.toThrow("Cannot deaccession an object that is currently on loan");
});

test("deleteCollection rejects active objects on pending loans", async () => {
  const t = createConvexTest();
  const { authed, activeCollectionId, organizationId } =
    await createExhibitionFixture(t);

  await t.run(async (ctx) => {
    const loanId = await ctx.db.insert("loans", {
      organizationId,
      loanNumber: "LOAN-PENDING-001",
      type: "outgoing",
      lenderBorrowerName: "Borrowing Museum",
      startDate: Date.now(),
      status: "pending",
    });
    await ctx.db.insert("loanItems", {
      loanId,
      collectionId: activeCollectionId,
    });
  });

  await expect(
    authed.mutation(api.collections.deleteCollection, {
      collectionId: activeCollectionId,
    }),
  ).rejects.toThrow("Cannot deaccession an object that is currently on loan");
});

test("deleteCollection succeeds for active objects", async () => {
  const t = createConvexTest();
  const { authed, activeCollectionId } = await createExhibitionFixture(t);

  await authed.mutation(api.collections.deleteCollection, {
    collectionId: activeCollectionId,
  });

  const collection = await t.run(async (ctx) =>
    ctx.db.get(activeCollectionId),
  );
  expect(collection?.status).toBe("deaccessioned");
});

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
  const { authed, exhibitionId, loanedCollectionId, organizationId } =
    await createExhibitionFixture(t);

  const exhibitionObjectId = await t.run(async (ctx) => {
    return await ctx.db.insert("exhibitionObjects", {
      exhibitionId,
      organizationId,
      collectionId: loanedCollectionId,
      status: "pending",
    });
  });

  await expect(
    authed.mutation(api.exhibitions.installObject, {
      exhibitionObjectId,
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
  } = await createExhibitionFixture(t);

  const exhibitionObjectId = await t.run(async (ctx) => {
    return await ctx.db.insert("exhibitionObjects", {
      exhibitionId,
      organizationId,
      collectionId: activeCollectionId,
      status: "pending",
      exhibitionLocationId: locationId,
    });
  });

  await authed.mutation(api.exhibitions.installObject, {
    exhibitionObjectId,
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
  } = await createExhibitionFixture(t);

  await t.run(async (ctx) => {
    await ctx.db.insert("exhibitionObjects", {
      exhibitionId,
      organizationId,
      collectionId: activeCollectionId,
      status: "pending",
      exhibitionLocationId: locationId,
    });
  });

  await authed.mutation(api.exhibitions.activate, {
    exhibitionId,
    skipInstallationCheck: true,
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
  expect(result.exhibitionObjects).toHaveLength(1);
  expect(result.exhibitionObjects[0]?.status).toBe("installed");
  expect(result.collection?.currentLocationId).toBe(locationId);
});
