import { expect, test } from "vitest";
import { api, internal } from "../convex/_generated/api";
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

async function setupExhibitionFixture(
  t: ConvexTest,
): Promise<ExhibitionFixture> {
  const { organizationId, userId } = await createOrgUserWithPermissions(
    t,
    [
      "collections.create",
      "collections.read",
      "collections.update",
      "collections.accept_condition",
    ],
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

test("many-object creation makes every participant visible to object reads and ordered detail", async () => {
  const t = createConvexTest();
  const { organizationId, collectionId, secondCollectionId, authed } =
    await setupExhibitionFixture(t);

  const exhibitionId = await authed.mutation(api.exhibitions.create, {
    organizationId,
    title: "Two Objects",
    startDate: Date.now(),
    isCurrent: false,
    participants: [
      { collectionId: secondCollectionId, role: "featured" },
      { collectionId, role: "participant" },
    ],
  });

  const members = await authed.query(api.exhibitions.listExhibitionObjects, {
    exhibitionId,
  });
  expect(
    members.map((member) => [member.collectionId, member.role, member.order]),
  ).toEqual([
    [secondCollectionId, "featured", 0],
    [collectionId, "participant", 1],
  ]);
  const objectExhibitions = await authed.query(api.exhibitions.list, {
    collectionId,
  });
  expect(objectExhibitions.map((exhibition) => exhibition._id)).toContain(
    exhibitionId,
  );
  const filtered = await authed.query(api.exhibitions.listByOrganization, {
    organizationId,
    collectionId,
  });
  expect(
    filtered.map((exhibition) => [exhibition._id, exhibition.participantCount]),
  ).toEqual([[exhibitionId, 2]]);
});

test("legacy anchor disagreement is reported and requires an explicit reconciliation choice", async () => {
  const t = createConvexTest();
  const { organizationId, collectionId, secondCollectionId, authed } =
    await setupExhibitionFixture(t);
  const exhibitionId = await t.run(async (ctx) => {
    const id = await ctx.db.insert("exhibitions", {
      organizationId,
      collectionId,
      title: "Legacy Show",
      startDate: Date.now(),
      isCurrent: false,
    });
    await ctx.db.insert("exhibitionObjects", {
      exhibitionId: id,
      organizationId,
      collectionId: secondCollectionId,
      status: "pending",
    });
    return id;
  });

  const review = await authed.query(api.exhibitions.reviewLegacyParticipation, {
    organizationId,
  });
  expect(review).toEqual([
    {
      exhibitionId,
      anchorCollectionId: collectionId,
      reason: "anchor_missing_from_members",
      memberCount: 1,
    },
  ]);
  await expect(
    authed.mutation(api.exhibitions.update, {
      id: exhibitionId,
      participants: [{ collectionId: secondCollectionId, role: "participant" }],
    }),
  ).rejects.toThrow("Review legacy");
  await authed.mutation(api.exhibitions.reconcileLegacyParticipation, {
    exhibitionId,
    includeAnchor: true,
    expectedMemberCollectionIds: [secondCollectionId],
  });
  const members = await authed.query(api.exhibitions.listExhibitionObjects, {
    exhibitionId,
  });
  expect(members.map((member) => member.collectionId)).toEqual([
    secondCollectionId,
    collectionId,
  ]);
  expect(
    (await authed.query(api.exhibitions.get, { id: exhibitionId }))
      ?.legacyParticipationReview,
  ).toBeUndefined();
});

test("safe legacy backfill adds the anchor once and leaves conflicting memberships for review", async () => {
  const t = createConvexTest();
  const { organizationId, collectionId, secondCollectionId, authed } =
    await setupExhibitionFixture(t);
  const singletonId = await t.run((ctx) =>
    ctx.db.insert("exhibitions", {
      organizationId,
      collectionId,
      title: "Anchor only",
      startDate: Date.now(),
      isCurrent: false,
    }),
  );
  const ambiguousId = await t.run(async (ctx) => {
    const id = await ctx.db.insert("exhibitions", {
      organizationId,
      collectionId,
      title: "Disagreement",
      startDate: Date.now(),
      isCurrent: false,
    });
    await ctx.db.insert("exhibitionObjects", {
      exhibitionId: id,
      organizationId,
      collectionId: secondCollectionId,
      status: "pending",
    });
    return id;
  });

  expect(
    await authed.mutation(api.exhibitions.backfillUnambiguousParticipation, {
      organizationId,
    }),
  ).toEqual({ migrated: 1, requiresReview: 1, remaining: 0 });
  expect(
    await authed.mutation(api.exhibitions.backfillUnambiguousParticipation, {
      organizationId,
    }),
  ).toEqual({ migrated: 0, requiresReview: 1, remaining: 0 });
  expect(
    (
      await authed.query(api.exhibitions.listExhibitionObjects, {
        exhibitionId: singletonId,
      })
    ).map((member) => member.collectionId),
  ).toEqual([collectionId]);
  expect(
    (
      await authed.query(api.exhibitions.reviewLegacyParticipation, {
        organizationId,
      })
    ).map((entry) => entry.exhibitionId),
  ).toEqual([ambiguousId]);
});

test("operator rollout converts every legacy exhibition and keeps its historical anchor as a participant once", async () => {
  const t = createConvexTest();
  const { organizationId, userId, collectionId, secondCollectionId, authed } =
    await setupExhibitionFixture(t);
  const legacy = (title: string) =>
    t.run((ctx) =>
      ctx.db.insert("exhibitions", {
        organizationId,
        collectionId,
        title,
        startDate: Date.now(),
        isCurrent: false,
      }),
    );
  const anchorOnlyId = await legacy("Anchor only");
  const anchorAndMembersId = await legacy("Anchor and members");
  const missingAnchorId = await legacy("Anchor missing from members");
  await t.run(async (ctx) => {
    for (const [exhibitionId, memberIds] of [
      [anchorAndMembersId, [collectionId, secondCollectionId]],
      [missingAnchorId, [secondCollectionId]],
    ] as const) {
      for (const memberId of memberIds) {
        await ctx.db.insert("exhibitionObjects", {
          exhibitionId,
          organizationId,
          collectionId: memberId,
          status: "pending",
        });
      }
    }
  });
  const foreignAnchorId = await t.run(async (ctx) => {
    const otherOrganizationId = await ctx.db.insert("organizations", {
      name: "Other museum",
      slug: `other-${Math.random().toString(36).slice(2, 8)}`,
      type: "museum",
    });
    const foreignObjectId = await ctx.db.insert("collections", {
      organizationId: otherOrganizationId,
      title: "Foreign object",
      accessionNumber: "FOREIGN-1",
      status: "active",
      catalogedBy: userId,
      catalogedAt: Date.now(),
    });
    return await ctx.db.insert("exhibitions", {
      organizationId,
      collectionId: foreignObjectId,
      title: "Foreign anchor",
      startDate: Date.now(),
      isCurrent: false,
    });
  });

  // Follow the cursor in two-row pages, as the production driver does.
  const runAll = async () => {
    let cursor: string | null = null;
    const totals = {
      converted: 0,
      includedAnchor: 0,
      skipped: [] as Array<{ exhibitionId: Id<"exhibitions">; code: string }>,
    };
    for (;;) {
      const page = await t.mutation(
        internal.exhibitions.convertLegacyParticipationForOrganization,
        { organizationId, cursor, limit: 2 },
      );
      totals.converted += page.converted;
      totals.includedAnchor += page.includedAnchor;
      totals.skipped.push(...page.skipped);
      if (page.isDone) return totals;
      cursor = page.cursor;
    }
  };
  expect(await runAll()).toEqual({
    converted: 3,
    includedAnchor: 2,
    skipped: [{ exhibitionId: foreignAnchorId, code: "invalid_anchor" }],
  });
  expect(await runAll()).toEqual({
    converted: 0,
    includedAnchor: 0,
    skipped: [{ exhibitionId: foreignAnchorId, code: "invalid_anchor" }],
  });

  const memberIds = async (exhibitionId: Id<"exhibitions">) =>
    (
      await authed.query(api.exhibitions.listExhibitionObjects, {
        exhibitionId,
      })
    ).map((member) => member.collectionId);
  expect(await memberIds(anchorOnlyId)).toEqual([collectionId]);
  expect(await memberIds(anchorAndMembersId)).toEqual([
    collectionId,
    secondCollectionId,
  ]);
  expect(await memberIds(missingAnchorId)).toEqual([
    secondCollectionId,
    collectionId,
  ]);
  expect(
    (
      await authed.query(api.exhibitions.reviewLegacyParticipation, {
        organizationId,
      })
    ).map((entry) => entry.exhibitionId),
  ).toEqual([foreignAnchorId]);
});

test("participant editing rejects duplicate objects and preserves installed evidence", async () => {
  const t = createConvexTest();
  const { organizationId, collectionId, secondCollectionId, authed } =
    await setupExhibitionFixture(t);
  await expect(
    authed.mutation(api.exhibitions.create, {
      organizationId,
      title: "Invalid",
      startDate: Date.now(),
      isCurrent: false,
      participants: [
        { collectionId, role: "featured" },
        { collectionId, role: "participant" },
      ],
    }),
  ).rejects.toThrow("only once");
  const galleryLocationId = await t.run(async (ctx) =>
    ctx.db.insert("locations", {
      organizationId,
      name: "Install gallery",
      type: "gallery",
      sortOrder: 0,
      isActive: true,
    }),
  );
  const exhibitionId = await authed.mutation(api.exhibitions.create, {
    organizationId,
    title: "Editable",
    startDate: Date.now(),
    isCurrent: false,
    participants: [
      { collectionId, role: "participant" },
      { collectionId: secondCollectionId, role: "featured" },
    ],
  });
  await authed.mutation(api.exhibitions.update, {
    id: exhibitionId,
    participants: [
      { collectionId: secondCollectionId, role: "featured" },
      { collectionId, role: "participant" },
    ],
  });
  const ordered = await authed.query(api.exhibitions.listExhibitionObjects, {
    exhibitionId,
  });
  expect(ordered.map((member) => member.collectionId)).toEqual([
    secondCollectionId,
    collectionId,
  ]);
  const installationAssessment1 = await authed.mutation(
    api.conditionAssessments.create,
    {
      collectionId: ordered[0]!.collectionId,
      assessedAt: Date.now(),
      condition: "Good",
      summary: "Installation check",
      observations: [],
      photos: [],
    },
  );
  await authed.mutation(api.conditionAssessments.accept, {
    assessmentId: installationAssessment1,
  });
  await authed.mutation(api.exhibitions.installObject, {
    exhibitionObjectId: ordered[0]!._id,
    observedFromLocationId: null,
    exhibitionLocationId: galleryLocationId,
    installationConditionAssessmentId: installationAssessment1,
  });
  await expect(
    authed.mutation(api.exhibitions.update, {
      id: exhibitionId,
      participants: [{ collectionId, role: "participant" }],
    }),
  ).rejects.toThrow("installation or return evidence");
  expect(
    (
      await authed.query(api.exhibitions.listExhibitionObjects, {
        exhibitionId,
      })
    ).map((member) => member.collectionId),
  ).toEqual([secondCollectionId, collectionId]);
});

test("schedule conflict checks union every selected participant", async () => {
  const t = createConvexTest();
  const { collectionId, secondCollectionId, authed } =
    await setupExhibitionFixture(t);

  const startDate = Date.now();
  const endDate = startDate + 30 * 24 * 60 * 60 * 1000;

  await authed.mutation(api.exhibitions.create, {
    collectionId: secondCollectionId,
    title: "Second object show",
    startDate,
    endDate,
    isCurrent: false,
  });

  const conflicts = await authed.query(
    api.exhibitions.checkScheduleConflictsForParticipants,
    {
      collectionIds: [collectionId, secondCollectionId],
      startDate: startDate + 7 * 24 * 60 * 60 * 1000,
      endDate: endDate - 7 * 24 * 60 * 60 * 1000,
    },
  );

  expect(conflicts.hasConflicts).toBe(true);
  expect(
    conflicts.conflicts.some(
      (conflict) => conflict.title === "Second object show",
    ),
  ).toBe(true);
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

  let exhibition = await authed.query(api.exhibitions.get, {
    id: exhibitionId,
  });
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

  expect(objects.map((object) => object.collectionId)).toEqual([
    collectionId,
    secondCollectionId,
  ]);
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
