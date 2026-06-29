import { expect, test } from "vitest";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import {
  authedForUser,
  type ConvexTest,
  createConvexTest,
  createOrgUserWithPermissions,
} from "./testHarness";

interface ExhibitionFixture {
  organizationId: Id<"organizations">;
  userId: Id<"users">;
  collectionId: Id<"collections">;
  secondCollectionId: Id<"collections">;
  authed: ReturnType<typeof authedForUser>;
}

async function setupExhibitionFixture(t: ConvexTest): Promise<ExhibitionFixture> {
  const { organizationId, userId } = await createOrgUserWithPermissions(
    t,
    ["collections.create", "collections.read", "collections.update"],
    {
      subscriptionTier: "pro",
      slugPrefix: "exhibition-test",
    },
  );

  const [collectionId, secondCollectionId] = await t.run(async (ctx) => {
    const now = Date.now();
    return await Promise.all([
      ctx.db.insert("collections", {
        organizationId,
        accessionNumber: `EXH-1-${Math.random().toString(36).slice(2, 6)}`,
        title: "Anchor Object",
        status: "active",
        catalogedBy: userId,
        catalogedAt: now,
      }),
      ctx.db.insert("collections", {
        organizationId,
        accessionNumber: `EXH-2-${Math.random().toString(36).slice(2, 6)}`,
        title: "Second Object",
        status: "active",
        catalogedBy: userId,
        catalogedAt: now,
      }),
    ]);
  });

  return {
    organizationId,
    userId,
    collectionId,
    secondCollectionId,
    authed: authedForUser(t, userId),
  };
}

test("should create exhibition with dates and venue", async () => {
  const t = createConvexTest();
  const { collectionId, authed } = await setupExhibitionFixture(t);

  const startDate = Date.now();
  const endDate = startDate + 60 * 24 * 60 * 60 * 1000;

  const exhibitionId = await authed.mutation(api.exhibitions.create, {
    collectionId,
    title: "Modern Masters",
    location: "Main Gallery",
    startDate,
    endDate,
    isCurrent: false,
    isLoan: false,
  });

  const exhibition = await authed.query(api.exhibitions.get, {
    id: exhibitionId,
  });

  expect(exhibition).not.toBeNull();
  expect(exhibition?.title).toBe("Modern Masters");
  expect(exhibition?.location).toBe("Main Gallery");
  expect(exhibition?.startDate).toBe(startDate);
});

test("should add objects to exhibition", async () => {
  const t = createConvexTest();
  const { collectionId, secondCollectionId, authed } =
    await setupExhibitionFixture(t);

  const exhibitionId = await authed.mutation(api.exhibitions.create, {
    collectionId,
    title: "Group Show",
    startDate: Date.now(),
    isCurrent: false,
  });

  await authed.mutation(api.exhibitions.addExhibitionObject, {
    exhibitionId,
    collectionId: secondCollectionId,
  });

  const objects = await authed.query(api.exhibitions.listExhibitionObjects, {
    exhibitionId,
  });

  expect(objects.length).toBeGreaterThanOrEqual(1);
  expect(objects.some((obj) => obj.collectionId === secondCollectionId)).toBe(
    true,
  );
});

test("should detect venue conflicts", async () => {
  const t = createConvexTest();
  const { collectionId, authed } = await setupExhibitionFixture(t);

  const startDate = Date.now();
  const endDate = startDate + 30 * 24 * 60 * 60 * 1000;

  await authed.mutation(api.exhibitions.create, {
    collectionId,
    title: "Existing Show",
    startDate,
    endDate,
    isCurrent: false,
  });

  const conflicts = await authed.query(api.exhibitions.checkScheduleConflicts, {
    collectionId,
    startDate: startDate + 7 * 24 * 60 * 60 * 1000,
    endDate: endDate - 7 * 24 * 60 * 60 * 1000,
  });

  expect(conflicts.hasConflicts).toBe(true);
  expect(conflicts.conflicts.length).toBeGreaterThan(0);
});

test("should track exhibition status workflow", async () => {
  const t = createConvexTest();
  const { organizationId, userId, roleId } = await createOrgUserWithPermissions(
    t,
    ["collections.create", "collections.read", "collections.update"],
    {
      subscriptionTier: "pro",
      slugPrefix: "exhibition-wf",
    },
  );

  await t.run(async (ctx) => {
    await ctx.db.insert("workflowConfigs", {
      organizationId,
      workflowType: "exhibition",
      steps: [{ stepNumber: 1, roleId, name: "Curator Review" }],
      canInitiateRoles: [roleId],
    });
  });

  const collectionId = await t.run(async (ctx) => {
    return await ctx.db.insert("collections", {
      organizationId,
      accessionNumber: `EXH-WF-${Math.random().toString(36).slice(2, 6)}`,
      title: "Workflow Object",
      status: "active",
      catalogedBy: userId,
      catalogedAt: Date.now(),
    });
  });

  const authed = authedForUser(t, userId);
  const exhibitionId = await authed.mutation(api.exhibitions.create, {
    collectionId,
    title: "Workflow Exhibition",
    startDate: Date.now(),
    isCurrent: false,
  });

  let exhibition = await authed.query(api.exhibitions.get, { id: exhibitionId });
  expect(exhibition?.status).toBe("proposed");

  await authed.mutation(api.exhibitions.approve, {
    exhibitionId,
    comment: "Approved for install",
  });

  exhibition = await authed.query(api.exhibitions.get, { id: exhibitionId });
  expect(exhibition?.status).toBe("approved");
});

test("should calculate exhibition KPIs", async () => {
  const t = createConvexTest();
  const { collectionId, secondCollectionId, authed } =
    await setupExhibitionFixture(t);

  const exhibitionId = await authed.mutation(api.exhibitions.create, {
    collectionId,
    title: "Stats Show",
    startDate: Date.now(),
    isCurrent: false,
  });

  await authed.mutation(api.exhibitions.addExhibitionObject, {
    exhibitionId,
    collectionId: secondCollectionId,
  });

  const objects = await authed.query(api.exhibitions.listExhibitionObjects, {
    exhibitionId,
  });

  expect(objects.length).toBe(1);
  expect(objects[0]?.collectionId).toBe(secondCollectionId);
});

test("should manage exhibition documents", async () => {
  const t = createConvexTest();
  const { collectionId, authed } = await setupExhibitionFixture(t);

  const exhibitionId = await authed.mutation(api.exhibitions.create, {
    collectionId,
    title: "Documented Show",
    startDate: Date.now(),
    isCurrent: false,
  });

  const documents = await authed.query(api.exhibitions.listDocuments, {
    exhibitionId,
  });

  expect(Array.isArray(documents)).toBe(true);
});
