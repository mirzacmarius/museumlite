import { expect, test } from "vitest";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import * as exhibitions from "../convex/exhibitions";
import { expectMatchesReturns } from "./returnsValidation";
import {
  authedForUser,
  createConvexTest,
  createOrgUserWithPermissions,
  custodyConflictOf,
} from "./testHarness";

interface HandoffFixture {
  organizationId: Id<"organizations">;
  userId: Id<"users">;
  acceptedAssessmentId: Id<"conditionAssessments">;
  authed: ReturnType<typeof authedForUser>;
  exhibitionId: Id<"exhibitions">;
  exhibitionObjectId: Id<"exhibitionObjects">;
  collectionId: Id<"collections">;
  storageLocationId: Id<"locations">;
  galleryLocationId: Id<"locations">;
}

async function createHandoffFixture(
  t: ReturnType<typeof createConvexTest>,
): Promise<HandoffFixture> {
  const { organizationId, userId } = await createOrgUserWithPermissions(
    t,
    ["collections.read", "collections.update", "collections.accept_condition"],
    {
      subscriptionTier: "pro",
      slugPrefix: "exh-handoff",
    },
  );

  const {
    collectionId,
    storageLocationId,
    galleryLocationId,
    exhibitionId,
    exhibitionObjectId,
  } = await t.run(async (ctx) => {
    const storageLocationId = await ctx.db.insert("locations", {
      organizationId,
      name: "Storage",
      type: "storage",
      sortOrder: 0,
      isActive: true,
    });
    const galleryLocationId = await ctx.db.insert("locations", {
      organizationId,
      name: "Gallery A",
      type: "gallery",
      sortOrder: 1,
      isActive: true,
    });
    const collectionId = await ctx.db.insert("collections", {
      organizationId,
      accessionNumber: "EXH-OBJ-1",
      title: "Handoff object",
      status: "active",
      catalogedBy: userId,
      catalogedAt: Date.now(),
      currentLocationId: storageLocationId,
    });
    const exhibitionId = await ctx.db.insert("exhibitions", {
      organizationId,
      title: "Handoff show",
      startDate: Date.now(),
      isCurrent: false,
      status: "approved",
      locationId: galleryLocationId,
      participationVersion: "members",
    });
    const exhibitionObjectId = await ctx.db.insert("exhibitionObjects", {
      exhibitionId,
      organizationId,
      collectionId,
      role: "featured",
      order: 0,
      originalLocationId: storageLocationId,
      exhibitionLocationId: galleryLocationId,
      status: "pending",
    });
    return {
      collectionId,
      storageLocationId,
      galleryLocationId,
      exhibitionId,
      exhibitionObjectId,
    };
  });

  const acceptedAssessmentId = await acceptAssessment(
    t,
    authedForUser(t, userId),
    collectionId,
  );
  return {
    acceptedAssessmentId,
    organizationId,
    userId,
    authed: authedForUser(t, userId),
    exhibitionId,
    exhibitionObjectId,
    collectionId,
    storageLocationId,
    galleryLocationId,
  };
}

async function acceptAssessment(
  _t: ReturnType<typeof createConvexTest>,
  authed: ReturnType<typeof authedForUser>,
  collectionId: Id<"collections">,
) {
  const assessmentId = await authed.mutation(api.conditionAssessments.create, {
    collectionId,
    assessedAt: Date.now(),
    condition: "Good",
    summary: "Pre-install check",
    observations: [],
    photos: [],
  });
  await authed.mutation(api.conditionAssessments.accept, { assessmentId });
  return assessmentId;
}

test("install records guarded movement and accepted assessment", async () => {
  const t = createConvexTest();
  const {
    authed,
    exhibitionObjectId,
    collectionId,
    storageLocationId,
    galleryLocationId,
  } = await createHandoffFixture(t);
  const assessmentId = await acceptAssessment(t, authed, collectionId);

  await authed.mutation(api.exhibitions.installObject, {
    exhibitionObjectId,
    observedFromLocationId: storageLocationId,
    installationConditionAssessmentId: assessmentId,
  });

  const result = await t.run(async (ctx) => {
    const [exhibitionObject, collection, history] = await Promise.all([
      ctx.db.get(exhibitionObjectId),
      ctx.db.get(collectionId),
      ctx.db
        .query("locationHistory")
        .withIndex("by_collection", (q) => q.eq("collectionId", collectionId))
        .collect(),
    ]);
    return { collection, exhibitionObject, history };
  });

  expect(result.exhibitionObject?.status).toBe("installed");
  expect(result.exhibitionObject?.installationMovementId).toBeDefined();
  expect(result.exhibitionObject?.installationConditionAssessmentId).toBe(
    assessmentId,
  );
  expect(result.collection?.currentLocationId).toBe(galleryLocationId);
  expect(
    result.history.some((row) => row.movementKind === "exhibition_install"),
  ).toBe(true);
});

test("install rejects stale observed source", async () => {
  const t = createConvexTest();
  const {
    authed,
    acceptedAssessmentId,
    exhibitionObjectId,
    galleryLocationId,
  } = await createHandoffFixture(t);

  await t.run(async (ctx) => {
    await ctx.db.insert("locations", {
      organizationId: (await ctx.db.get(exhibitionObjectId))!.organizationId,
      name: "Wrong source",
      type: "storage",
      sortOrder: 2,
      isActive: true,
    });
  });

  expect(
    await custodyConflictOf(
      authed.mutation(api.exhibitions.installObject, {
        exhibitionObjectId,
        observedFromLocationId: galleryLocationId,
        installationConditionAssessmentId: acceptedAssessmentId,
      }),
    ),
  ).toMatchObject({ code: "SOURCE_CHANGED", currentLocationName: "Storage" });

  const stillPending = await t.run(async (ctx) =>
    ctx.db.get(exhibitionObjectId),
  );
  expect(stillPending?.status).toBe("pending");
  expect(stillPending?.installedAt).toBeUndefined();
});

test("install into a full destination reports the location and capacity", async () => {
  const t = createConvexTest();
  const {
    authed,
    acceptedAssessmentId,
    exhibitionObjectId,
    organizationId,
    userId,
    storageLocationId,
    galleryLocationId,
  } = await createHandoffFixture(t);
  await t.run(async (ctx) => {
    await ctx.db.patch(galleryLocationId, { capacity: 1 });
    await ctx.db.insert("collections", {
      organizationId,
      accessionNumber: "EXH-OCCUPANT",
      title: "Occupant",
      status: "active",
      catalogedBy: userId,
      catalogedAt: Date.now(),
      currentLocationId: galleryLocationId,
    });
  });

  expect(
    await custodyConflictOf(
      authed.mutation(api.exhibitions.installObject, {
        exhibitionObjectId,
        observedFromLocationId: storageLocationId,
        installationConditionAssessmentId: acceptedAssessmentId,
      }),
    ),
  ).toMatchObject({
    code: "DESTINATION_FULL",
    locationName: "Gallery A",
    capacity: 1,
  });
});

test("install without an accepted assessment asks for one", async () => {
  const t = createConvexTest();
  const { authed, exhibitionObjectId, storageLocationId } =
    await createHandoffFixture(t);

  expect(
    await custodyConflictOf(
      authed.mutation(api.exhibitions.installObject, {
        exhibitionObjectId,
        observedFromLocationId: storageLocationId,
      }),
    ),
  ).toMatchObject({ code: "ASSESSMENT_REQUIRED" });
});

test("replayed install reports the handoff as already recorded", async () => {
  const t = createConvexTest();
  const {
    authed,
    acceptedAssessmentId,
    exhibitionObjectId,
    storageLocationId,
  } = await createHandoffFixture(t);
  const install = {
    exhibitionObjectId,
    observedFromLocationId: storageLocationId,
    installationConditionAssessmentId: acceptedAssessmentId,
  };
  await authed.mutation(api.exhibitions.installObject, install);

  expect(
    await custodyConflictOf(
      authed.mutation(api.exhibitions.installObject, install),
    ),
  ).toMatchObject({ code: "HANDOFF_ALREADY_RECORDED" });
});

test("activate does not auto-install pending participants", async () => {
  const t = createConvexTest();
  const { authed, exhibitionId } = await createHandoffFixture(t);

  await expect(
    authed.mutation(api.exhibitions.activate, { exhibitionId }),
  ).rejects.toThrow("not installed");

  const exhibition = await t.run(async (ctx) => ctx.db.get(exhibitionId));
  expect(exhibition?.status).toBe("approved");
});

test("close blocks outstanding returns and does not invent them", async () => {
  const t = createConvexTest();
  const {
    authed,
    exhibitionId,
    exhibitionObjectId,
    collectionId,
    storageLocationId,
  } = await createHandoffFixture(t);
  const assessmentId = await acceptAssessment(t, authed, collectionId);

  await authed.mutation(api.exhibitions.installObject, {
    exhibitionObjectId,
    observedFromLocationId: storageLocationId,
    installationConditionAssessmentId: assessmentId,
  });

  await authed.mutation(api.exhibitions.activate, { exhibitionId });

  expect(
    await custodyConflictOf(
      authed.mutation(api.exhibitions.close, { exhibitionId }),
    ),
  ).toMatchObject({ code: "CLOSURE_BLOCKED", outstandingCount: 1 });

  const afterFailedClose = await t.run(async (ctx) => {
    const [exhibition, exhibitionObject] = await Promise.all([
      ctx.db.get(exhibitionId),
      ctx.db.get(exhibitionObjectId),
    ]);
    return { exhibition, exhibitionObject };
  });
  expect(afterFailedClose.exhibition?.status).toBe("active");
  expect(afterFailedClose.exhibitionObject?.status).toBe("installed");
});

test("physical return path and authorized exception allow closure", async () => {
  const t = createConvexTest();
  const {
    authed,
    exhibitionId,
    exhibitionObjectId,
    collectionId,
    storageLocationId,
    galleryLocationId,
  } = await createHandoffFixture(t);
  const installAssessmentId = await acceptAssessment(t, authed, collectionId);

  await authed.mutation(api.exhibitions.installObject, {
    exhibitionObjectId,
    observedFromLocationId: storageLocationId,
    installationConditionAssessmentId: installAssessmentId,
  });
  await authed.mutation(api.exhibitions.activate, { exhibitionId });
  await authed.mutation(api.exhibitions.startDeinstallation, { exhibitionId });
  const deinstallAssessmentId = await acceptAssessment(t, authed, collectionId);
  await authed.mutation(api.exhibitions.deinstallObject, {
    exhibitionObjectId,
    deinstallationConditionAssessmentId: deinstallAssessmentId,
  });
  const returnAssessmentId = await acceptAssessment(t, authed, collectionId);
  await authed.mutation(api.exhibitions.returnObjectToOriginalLocation, {
    exhibitionObjectId,
    observedFromLocationId: galleryLocationId,
    returnConditionAssessmentId: returnAssessmentId,
  });

  await authed.mutation(api.exhibitions.close, { exhibitionId });

  const closed = await t.run(async (ctx) => ctx.db.get(exhibitionId));
  expect(closed?.status).toBe("closed");
});

test("authorizeReturnException documents outcome without moving the object", async () => {
  const t = createConvexTest();
  const {
    authed,
    acceptedAssessmentId,
    exhibitionId,
    exhibitionObjectId,
    collectionId,
    storageLocationId,
    galleryLocationId,
  } = await createHandoffFixture(t);
  const installAssessmentId = await acceptAssessment(t, authed, collectionId);

  await authed.mutation(api.exhibitions.installObject, {
    exhibitionObjectId,
    observedFromLocationId: storageLocationId,
    installationConditionAssessmentId: installAssessmentId,
  });
  await authed.mutation(api.exhibitions.activate, { exhibitionId });
  await authed.mutation(api.exhibitions.startDeinstallation, { exhibitionId });
  await authed.mutation(api.exhibitions.deinstallObject, {
    exhibitionObjectId,
    deinstallationConditionAssessmentId: acceptedAssessmentId,
  });

  await authed.mutation(api.exhibitions.authorizeReturnException, {
    exhibitionObjectId,
    reason:
      "Object remains on extended loan display; return deferred with approval",
  });

  await authed.mutation(api.exhibitions.close, { exhibitionId });

  const result = await t.run(async (ctx) => {
    const [exhibition, exhibitionObject, collection] = await Promise.all([
      ctx.db.get(exhibitionId),
      ctx.db.get(exhibitionObjectId),
      ctx.db.get(collectionId),
    ]);
    return { collection, exhibition, exhibitionObject };
  });

  expect(result.exhibition?.status).toBe("closed");
  expect(result.exhibitionObject?.returnException?.reason).toContain(
    "extended loan",
  );
  expect(result.exhibitionObject?.returnedAt).toBeUndefined();
  expect(result.collection?.currentLocationId).toBe(galleryLocationId);
});

test("activate ignores skipInstallationCheck for participants", async () => {
  const t = createConvexTest();
  const { authed, exhibitionId } = await createHandoffFixture(t);

  await t.run(async (ctx) => {
    await ctx.db.patch(exhibitionId, {
      installationChecklist: [
        {
          taskId: "lights",
          task: "Check lights",
          required: true,
          completed: false,
        },
      ],
    });
  });

  await expect(
    authed.mutation(api.exhibitions.activate, {
      exhibitionId,
      skipInstallationCheck: true,
    }),
  ).rejects.toThrow(/not installed/i);

  const exhibition = await t.run(async (ctx) => ctx.db.get(exhibitionId));
  expect(exhibition?.status).toBe("approved");
});

test("skipInstallationCheck still skips the checklist once participants are installed", async () => {
  const t = createConvexTest();
  const {
    authed,
    acceptedAssessmentId,
    exhibitionId,
    exhibitionObjectId,
    storageLocationId,
  } = await createHandoffFixture(t);

  await t.run(async (ctx) => {
    await ctx.db.patch(exhibitionId, {
      installationChecklist: [
        {
          taskId: "lights",
          task: "Check lights",
          required: true,
          completed: false,
        },
      ],
    });
  });

  await authed.mutation(api.exhibitions.installObject, {
    exhibitionObjectId,
    observedFromLocationId: storageLocationId,
    installationConditionAssessmentId: acceptedAssessmentId,
  });

  await authed.mutation(api.exhibitions.activate, {
    exhibitionId,
    skipInstallationCheck: true,
  });

  const exhibition = await t.run(async (ctx) => ctx.db.get(exhibitionId));
  expect(exhibition?.status).toBe("active");
});

test("close ignores skipDeinstallationCheck while a participant is installed", async () => {
  const t = createConvexTest();
  const {
    authed,
    acceptedAssessmentId,
    exhibitionId,
    exhibitionObjectId,
    storageLocationId,
  } = await createHandoffFixture(t);

  await authed.mutation(api.exhibitions.installObject, {
    exhibitionObjectId,
    observedFromLocationId: storageLocationId,
    installationConditionAssessmentId: acceptedAssessmentId,
  });
  await authed.mutation(api.exhibitions.activate, { exhibitionId });

  await t.run(async (ctx) => {
    await ctx.db.patch(exhibitionId, {
      deinstallationChecklist: [
        {
          taskId: "crates",
          task: "Pack crates",
          required: true,
          completed: false,
        },
      ],
    });
  });

  await expect(
    authed.mutation(api.exhibitions.close, {
      exhibitionId,
      skipDeinstallationCheck: true,
    }),
  ).rejects.toThrow(/outstanding/i);

  const result = await t.run(async (ctx) => {
    const [exhibition, exhibitionObject] = await Promise.all([
      ctx.db.get(exhibitionId),
      ctx.db.get(exhibitionObjectId),
    ]);
    return { exhibition, exhibitionObject };
  });
  expect(result.exhibition?.status).toBe("active");
  expect(result.exhibitionObject?.status).toBe("installed");
  expect(result.exhibitionObject?.returnException).toBeUndefined();
  expect(result.exhibitionObject?.returnMovementId).toBeUndefined();
});

test("exhibition return to another location does not claim the original location", async () => {
  const t = createConvexTest();
  const {
    authed,
    acceptedAssessmentId,
    organizationId,
    exhibitionId,
    exhibitionObjectId,
    collectionId,
    storageLocationId,
    galleryLocationId,
  } = await createHandoffFixture(t);

  const labLocationId = await t.run(async (ctx) => {
    return await ctx.db.insert("locations", {
      organizationId,
      name: "Conservation lab",
      type: "storage",
      sortOrder: 2,
      isActive: true,
    });
  });

  await authed.mutation(api.exhibitions.installObject, {
    exhibitionObjectId,
    observedFromLocationId: storageLocationId,
    installationConditionAssessmentId: acceptedAssessmentId,
  });
  await authed.mutation(api.exhibitions.activate, { exhibitionId });
  await authed.mutation(api.exhibitions.startDeinstallation, { exhibitionId });
  await authed.mutation(api.exhibitions.deinstallObject, {
    exhibitionObjectId,
    deinstallationConditionAssessmentId: acceptedAssessmentId,
  });
  await authed.mutation(api.exhibitions.returnObjectToOriginalLocation, {
    exhibitionObjectId,
    observedFromLocationId: galleryLocationId,
    overrideLocationId: labLocationId,
    returnConditionAssessmentId: acceptedAssessmentId,
  });

  const result = await t.run(async (ctx) => {
    const [exhibitionObject, collection] = await Promise.all([
      ctx.db.get(exhibitionObjectId),
      ctx.db.get(collectionId),
    ]);
    return { collection, exhibitionObject };
  });

  expect(result.exhibitionObject?.status).toBe("returned");
  expect(result.exhibitionObject?.returnedToOriginalLocation).toBe(false);
  expect(result.collection?.currentLocationId).toBe(labLocationId);
  expect(result.collection?.currentLocationId).not.toBe(storageLocationId);
  expect(result.exhibitionObject?.returnMovementId).toBeDefined();
});

test("each exhibition handoff requires an accepted object assessment", async () => {
  const t = createConvexTest();
  const {
    authed,
    exhibitionObjectId,
    exhibitionId,
    collectionId,
    storageLocationId,
    galleryLocationId,
  } = await createHandoffFixture(t);
  await expect(
    authed.mutation(api.exhibitions.installObject, {
      exhibitionObjectId,
      observedFromLocationId: storageLocationId,
    }),
  ).rejects.toThrow(/accepted condition assessment/i);
  const assessmentId = await acceptAssessment(t, authed, collectionId);
  await authed.mutation(api.exhibitions.installObject, {
    exhibitionObjectId,
    observedFromLocationId: storageLocationId,
    installationConditionAssessmentId: assessmentId,
  });
  await authed.mutation(api.exhibitions.activate, { exhibitionId });
  await authed.mutation(api.exhibitions.startDeinstallation, { exhibitionId });
  await expect(
    authed.mutation(api.exhibitions.deinstallObject, {
      exhibitionObjectId,
    }),
  ).rejects.toThrow(/accepted condition assessment/i);
  await authed.mutation(api.exhibitions.deinstallObject, {
    exhibitionObjectId,
    deinstallationConditionAssessmentId: assessmentId,
  });
  await expect(
    authed.mutation(api.exhibitions.returnObjectToOriginalLocation, {
      exhibitionObjectId,
      observedFromLocationId: galleryLocationId,
    }),
  ).rejects.toThrow(/accepted condition assessment/i);
  const summary = await authed.query(
    api.exhibitions.getPhysicalHandoffSummary,
    { exhibitionId },
  );
  expect(summary.participants[0]?.status).toBe("deinstalled");
  expect(summary.participants[0]?.returnMovementId).toBeUndefined();
});

test("handoff summary retains a chronological assessment and movement timeline", async () => {
  const t = createConvexTest();
  const {
    authed,
    exhibitionId,
    exhibitionObjectId,
    acceptedAssessmentId,
    storageLocationId,
    galleryLocationId,
  } = await createHandoffFixture(t);
  await authed.mutation(api.exhibitions.installObject, {
    exhibitionObjectId,
    observedFromLocationId: storageLocationId,
    installationConditionAssessmentId: acceptedAssessmentId,
  });
  await authed.mutation(api.exhibitions.deinstallObject, {
    exhibitionObjectId,
    deinstallationConditionAssessmentId: acceptedAssessmentId,
  });
  await authed.mutation(api.exhibitions.returnObjectToOriginalLocation, {
    exhibitionObjectId,
    observedFromLocationId: galleryLocationId,
    returnConditionAssessmentId: acceptedAssessmentId,
  });
  const summary = await authed.query(
    api.exhibitions.getPhysicalHandoffSummary,
    { exhibitionId },
  );
  expect(summary.timeline.map((event) => event.phase)).toEqual([
    "installed",
    "deinstalled",
    "returned",
  ]);
  expect(
    summary.timeline.every(
      (event) => event.conditionAssessmentId === acceptedAssessmentId,
    ),
  ).toBe(true);
  expect(summary.timeline.every((event) => event.actorId !== undefined)).toBe(
    true,
  );
  expect(summary.timeline[0]?.movementId).toBe(
    summary.participants[0]?.installationMovementId,
  );
  expect(summary.timeline[2]?.movementId).toBe(
    summary.participants[0]?.returnMovementId,
  );
});

test("historical exhibition summary retains handoff evidence without exposing another institution's object metadata", async () => {
  const t = createConvexTest();
  const fixture = await createHandoffFixture(t);
  const { organizationId: targetOrganizationId } =
    await createOrgUserWithPermissions(t, ["collections.read"], {
      subscriptionTier: "pro",
      slugPrefix: "exhibition-history-target",
    });
  await t.run(async (ctx) => {
    await ctx.db.patch(fixture.collectionId, {
      organizationId: targetOrganizationId,
      title: "Receiving institution private title",
      accessionNumber: "TARGET-PRIVATE",
    });
  });
  const summary = await fixture.authed.query(
    api.exhibitions.getPhysicalHandoffSummary,
    { exhibitionId: fixture.exhibitionId },
  );
  expect(summary.participants[0]?.collectionTitle).toBeUndefined();
  expect(summary.participants[0]?.collectionAccessionNumber).toBeUndefined();
  expect(summary.participants[0]?.collectionId).toBe(fixture.collectionId);
});

test("the handoff summary says where each object is recorded now, so staff confirm the observed source", async () => {
  const t = createConvexTest();
  const fixture = await createHandoffFixture(t);
  const before = await fixture.authed.query(
    api.exhibitions.getPhysicalHandoffSummary,
    { exhibitionId: fixture.exhibitionId },
  );
  expect(before.participants[0]?.currentLocationId).toBe(
    fixture.storageLocationId,
  );

  await fixture.authed.mutation(api.exhibitions.installObject, {
    exhibitionObjectId: fixture.exhibitionObjectId,
    observedFromLocationId: before.participants[0]?.currentLocationId ?? null,
    installationConditionAssessmentId: fixture.acceptedAssessmentId,
  });

  const after = await fixture.authed.query(
    api.exhibitions.getPhysicalHandoffSummary,
    { exhibitionId: fixture.exhibitionId },
  );
  expect(after.participants[0]?.currentLocationId).toBe(
    fixture.galleryLocationId,
  );
  expectMatchesReturns(exhibitions.getPhysicalHandoffSummary, after);
});

test("an object with no recorded original location returns by default to where it was installed from", async () => {
  const t = createConvexTest();
  const fixture = await createHandoffFixture(t);
  await t.run((ctx) =>
    ctx.db.patch(fixture.exhibitionObjectId, { originalLocationId: undefined }),
  );
  await fixture.authed.mutation(api.exhibitions.installObject, {
    exhibitionObjectId: fixture.exhibitionObjectId,
    observedFromLocationId: fixture.storageLocationId,
    installationConditionAssessmentId: fixture.acceptedAssessmentId,
  });
  await fixture.authed.mutation(api.exhibitions.deinstallObject, {
    exhibitionObjectId: fixture.exhibitionObjectId,
    deinstallationConditionAssessmentId: fixture.acceptedAssessmentId,
  });

  const summary = await fixture.authed.query(
    api.exhibitions.getPhysicalHandoffSummary,
    { exhibitionId: fixture.exhibitionId },
  );

  expect(summary.participants[0]?.returnLocationId).toBe(
    fixture.storageLocationId,
  );
});
