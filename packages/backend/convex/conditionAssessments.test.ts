import { convexTest } from "convex-test";
import { expect, test, vi } from "vitest";

import { modules } from "../tests/testSetup";
import { workColumn } from "../tests/workBoardHarness";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";
import {
  type ConditionAssessmentErrorCode,
  conditionAssessmentErrorFromError,
} from "./utils/conditionAssessmentErrors";
import { WORK_COLUMN_PAGE } from "./utils/workBoardColumns";

const REVIEWER_PERMISSIONS = [
  "collections.read",
  "collections.update",
  "collections.accept_condition",
  "media.read",
] as const;

/** How many submitted assessments the viewer's Work board shows waiting. */
async function waitingForAcceptance(
  client: Parameters<typeof workColumn>[0],
  organizationId: Id<"organizations">,
) {
  const column = await workColumn(client, organizationId, "conditionApprovals");
  return column && { count: column.cards.length, hasMore: column.hasMore };
}

async function setup() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", { name: "Assessor" });
    const organizationId = await ctx.db.insert("organizations", {
      name: "Museum",
      slug: "museum",
      type: "museum",
    });
    const roleId = await ctx.db.insert("roles", {
      organizationId,
      name: "Registrar",
      description: "Assessment role",
      isSystemRole: false,
    });
    for (const name of REVIEWER_PERMISSIONS) {
      const permissionId = await ctx.db.insert("permissions", {
        name,
        category: "collections",
        description: name,
      });
      await ctx.db.insert("rolePermissions", { roleId, permissionId });
    }
    await ctx.db.insert("userOrganizations", {
      userId,
      organizationId,
      roleId,
      joinedAt: Date.now(),
    });
    const collectionId = await ctx.db.insert("collections", {
      organizationId,
      accessionNumber: "A-1",
      title: "Vase",
      condition: "Fair",
      status: "active",
      catalogedBy: userId,
      catalogedAt: Date.now(),
    });
    return { userId, organizationId, roleId, collectionId };
  });
  return { t, ...ids };
}

type Setup = Awaited<ReturnType<typeof setup>>;

function content(condition = "Poor") {
  return {
    assessedAt: Date.UTC(2026, 9, 1),
    condition,
    summary: `${condition} check`,
    observations: [],
    photos: [],
  };
}

function draftInput(collectionId: Id<"collections">, condition = "Poor") {
  return { collectionId, ...content(condition) };
}

async function errorCodeOf(
  call: Promise<unknown>,
): Promise<ConditionAssessmentErrorCode | undefined> {
  try {
    await call;
  } catch (error) {
    return conditionAssessmentErrorFromError(error)?.code;
  }
  throw new Error("Expected the call to be rejected");
}

async function revoke(t: Setup["t"], roleId: Id<"roles">, name: string) {
  await t.run(async (ctx) => {
    const grants = await ctx.db
      .query("rolePermissions")
      .withIndex("by_role", (q) => q.eq("roleId", roleId))
      .collect();
    for (const grant of grants) {
      const permission = await ctx.db.get(grant.permissionId);
      if (permission?.name === name) await ctx.db.delete(grant._id);
    }
  });
}

async function addObject(
  t: Setup["t"],
  organizationId: Id<"organizations">,
  userId: Id<"users">,
  title: string,
) {
  return await t.run(async (ctx) =>
    ctx.db.insert("collections", {
      organizationId,
      accessionNumber: `A-${title}`,
      title,
      status: "active",
      catalogedBy: userId,
      catalogedAt: Date.now(),
    }),
  );
}

test("accepted assessment becomes current while legacy condition remains visible", async () => {
  const { t, userId, collectionId } = await setup();
  const asUser = t.withIdentity({ subject: userId });

  const assessmentId = await asUser.mutation(api.conditionAssessments.create, {
    collectionId,
    assessedAt: Date.UTC(2026, 9, 1),
    condition: "Poor",
    summary: "Crack at base",
    observations: [
      { area: "Base", description: "Fine crack", severity: "moderate" },
    ],
    photos: [],
    submit: true,
  });
  expect(
    (
      await asUser.query(api.conditionAssessments.getForObject, {
        collectionId,
      })
    ).current,
  ).toMatchObject({
    source: "legacy",
    condition: "Fair",
  });

  await asUser.mutation(api.conditionAssessments.accept, { assessmentId });
  const detail = await asUser.query(api.conditionAssessments.getForObject, {
    collectionId,
  });
  expect(detail.current).toMatchObject({
    source: "assessment",
    condition: "Poor",
    assessmentId,
  });
  expect(detail.open).toBeNull();
  const history = await asUser.query(api.conditionAssessments.listForObject, {
    collectionId,
    paginationOpts: { numItems: 10, cursor: null },
  });
  expect(history.page).toMatchObject([
    { _id: assessmentId, status: "accepted" },
  ]);
  expect(detail.legacy).toMatchObject({
    condition: "Fair",
    provenance: "uncertain",
  });
});

test("Save draft keeps the assessment a draft that no reviewer can accept", async () => {
  const { t, userId, organizationId, collectionId } = await setup();
  const asUser = t.withIdentity({ subject: userId });

  const assessmentId = await asUser.mutation(
    api.conditionAssessments.create,
    draftInput(collectionId),
  );

  const detail = await asUser.query(api.conditionAssessments.getForObject, {
    collectionId,
  });
  expect(detail.open).toMatchObject({
    assessmentId,
    status: "draft",
    condition: "Poor",
    summary: "Poor check",
  });
  expect(await waitingForAcceptance(asUser, organizationId)).toEqual({
    count: 0,
    hasMore: false,
  });
  expect(
    await errorCodeOf(
      asUser.mutation(api.conditionAssessments.accept, { assessmentId }),
    ),
  ).toBe("ASSESSMENT_NOT_SUBMITTED");
  const stored = await t.run(async (ctx) => ctx.db.get(assessmentId));
  expect(stored?.status).toBe("draft");
  expect(stored?.submittedAt).toBeUndefined();
  expect(
    (await t.run(async (ctx) => ctx.db.get(collectionId)))?.condition,
  ).toBe("Fair");
});

test("a draft can be edited and stays a draft until it is submitted", async () => {
  const { t, userId, organizationId, collectionId } = await setup();
  const asUser = t.withIdentity({ subject: userId });
  const assessmentId = await asUser.mutation(
    api.conditionAssessments.create,
    draftInput(collectionId),
  );

  await asUser.mutation(api.conditionAssessments.update, {
    assessmentId,
    assessedAt: Date.UTC(2026, 9, 2),
    condition: "Good",
    summary: "  Cleaned and re-checked  ",
    observations: [
      { area: "Rim", description: "Small chip", severity: "minor" },
    ],
    photos: [],
  });
  let stored = await t.run(async (ctx) => ctx.db.get(assessmentId));
  expect(stored).toMatchObject({
    status: "draft",
    condition: "Good",
    summary: "Cleaned and re-checked",
    assessedAt: Date.UTC(2026, 9, 2),
    observations: [
      { area: "Rim", description: "Small chip", severity: "minor" },
    ],
  });
  expect(stored?.submittedAt).toBeUndefined();

  await asUser.mutation(api.conditionAssessments.update, {
    assessmentId,
    assessedAt: Date.UTC(2026, 9, 2),
    condition: "Good",
    summary: "Ready for review",
    observations: [],
    photos: [],
    submit: true,
  });
  stored = await t.run(async (ctx) => ctx.db.get(assessmentId));
  expect(stored).toMatchObject({
    status: "submitted",
    summary: "Ready for review",
    submittedBy: userId,
  });
  expect(stored?.submittedAt).toEqual(expect.any(Number));
  expect(await waitingForAcceptance(asUser, organizationId)).toEqual({
    count: 1,
    hasMore: false,
  });
  expect(
    (
      await asUser.query(api.conditionAssessments.getForObject, {
        collectionId,
      })
    ).open,
  ).toMatchObject({ assessmentId, status: "submitted" });

  expect(
    await errorCodeOf(
      asUser.mutation(api.conditionAssessments.update, {
        assessmentId,
        ...content(),
      }),
    ),
  ).toBe("ASSESSMENT_NOT_DRAFT");
  const audit = await t.run(async (ctx) =>
    ctx.db
      .query("auditLog")
      .filter((q) => q.eq(q.field("entityId"), assessmentId))
      .collect(),
  );
  expect(audit.map((entry) => entry.action)).toEqual([
    "created_condition_assessment",
    "updated_condition_assessment",
    "updated_condition_assessment",
    "submitted_condition_assessment",
  ]);
});

test("editing a draft requires collections.update", async () => {
  const { t, userId, roleId, collectionId } = await setup();
  const asUser = t.withIdentity({ subject: userId });
  const assessmentId = await asUser.mutation(
    api.conditionAssessments.create,
    draftInput(collectionId),
  );
  await revoke(t, roleId, "collections.update");

  await expect(
    asUser.mutation(api.conditionAssessments.update, {
      assessmentId,
      assessedAt: Date.UTC(2026, 9, 1),
      condition: "Good",
      summary: "Blocked edit",
      observations: [],
      photos: [],
      submit: true,
    }),
  ).rejects.toThrow();
  expect((await t.run(async (ctx) => ctx.db.get(assessmentId)))?.status).toBe(
    "draft",
  );
});

test("an object has one draft or submitted assessment until a reviewer decides it", async () => {
  const { t, userId, organizationId, collectionId } = await setup();
  const asUser = t.withIdentity({ subject: userId });
  const otherObjectId = await addObject(t, organizationId, userId, "Bowl");

  const draftId = await asUser.mutation(
    api.conditionAssessments.create,
    draftInput(collectionId),
  );
  expect(
    await errorCodeOf(
      asUser.mutation(
        api.conditionAssessments.create,
        draftInput(collectionId, "Good"),
      ),
    ),
  ).toBe("ASSESSMENT_ALREADY_OPEN");
  await asUser.mutation(
    api.conditionAssessments.create,
    draftInput(otherObjectId),
  );

  await asUser.mutation(api.conditionAssessments.update, {
    assessmentId: draftId,
    ...content(),
    submit: true,
  });
  expect(
    await errorCodeOf(
      asUser.mutation(api.conditionAssessments.create, {
        ...draftInput(collectionId, "Good"),
        submit: true,
      }),
    ),
  ).toBe("ASSESSMENT_ALREADY_OPEN");

  await asUser.mutation(api.conditionAssessments.reject, {
    assessmentId: draftId,
  });
  const secondId = await asUser.mutation(api.conditionAssessments.create, {
    ...draftInput(collectionId, "Good"),
    submit: true,
  });
  expect(
    await errorCodeOf(
      asUser.mutation(
        api.conditionAssessments.create,
        draftInput(collectionId, "Excellent"),
      ),
    ),
  ).toBe("ASSESSMENT_ALREADY_OPEN");

  await asUser.mutation(api.conditionAssessments.accept, {
    assessmentId: secondId,
  });
  await asUser.mutation(
    api.conditionAssessments.create,
    draftInput(collectionId, "Excellent"),
  );
});

test("a reviewer rejects a submitted assessment once, and a decided one stays decided", async () => {
  const { t, userId, collectionId } = await setup();
  const asUser = t.withIdentity({ subject: userId });
  const assessmentId = await asUser.mutation(api.conditionAssessments.create, {
    ...draftInput(collectionId),
    submit: true,
  });

  await asUser.mutation(api.conditionAssessments.reject, {
    assessmentId,
    reason: "  Photos missing  ",
  });
  await asUser.mutation(api.conditionAssessments.reject, { assessmentId });

  const stored = await t.run(async (ctx) => ctx.db.get(assessmentId));
  expect(stored).toMatchObject({
    status: "rejected",
    rejectedBy: userId,
    rejectionReason: "Photos missing",
  });
  expect(stored?.statusChangedAt).toBe(stored?.rejectedAt);
  expect(
    await errorCodeOf(
      asUser.mutation(api.conditionAssessments.accept, { assessmentId }),
    ),
  ).toBe("ASSESSMENT_ALREADY_DECIDED");
  expect(
    await errorCodeOf(
      asUser.mutation(api.conditionAssessments.update, {
        assessmentId,
        ...content(),
      }),
    ),
  ).toBe("ASSESSMENT_NOT_DRAFT");
  const detail = await asUser.query(api.conditionAssessments.getForObject, {
    collectionId,
  });
  expect(detail.current).toMatchObject({ source: "legacy", condition: "Fair" });
  expect(detail.open).toBeNull();
  const history = await asUser.query(api.conditionAssessments.listForObject, {
    collectionId,
    paginationOpts: { numItems: 10, cursor: null },
  });
  expect(history.page).toMatchObject([
    {
      _id: assessmentId,
      status: "rejected",
      rejectionReason: "Photos missing",
      rejectedByName: "Assessor",
    },
  ]);
});

test("a reviewer can reject a draft nobody will finish, which frees the object", async () => {
  const { t, userId, collectionId } = await setup();
  const asUser = t.withIdentity({ subject: userId });
  const draftId = await asUser.mutation(
    api.conditionAssessments.create,
    draftInput(collectionId),
  );

  await asUser.mutation(api.conditionAssessments.reject, {
    assessmentId: draftId,
    reason: "Abandoned",
  });

  expect((await t.run(async (ctx) => ctx.db.get(draftId)))?.status).toBe(
    "rejected",
  );
  const acceptedId = await asUser.mutation(api.conditionAssessments.create, {
    ...draftInput(collectionId, "Good"),
    submit: true,
  });
  await asUser.mutation(api.conditionAssessments.accept, {
    assessmentId: acceptedId,
  });
  expect(
    await errorCodeOf(
      asUser.mutation(api.conditionAssessments.reject, {
        assessmentId: acceptedId,
      }),
    ),
  ).toBe("ASSESSMENT_ALREADY_DECIDED");
});

test("capture and acceptance require separate permissions", async () => {
  const { t, userId, roleId, collectionId } = await setup();
  const asUser = t.withIdentity({ subject: userId });
  const assessmentId = await asUser.mutation(api.conditionAssessments.create, {
    ...draftInput(collectionId, "Good"),
    submit: true,
  });
  await revoke(t, roleId, "collections.accept_condition");

  await expect(
    asUser.mutation(api.conditionAssessments.accept, { assessmentId }),
  ).rejects.toThrow();
  await expect(
    asUser.mutation(api.conditionAssessments.reject, { assessmentId }),
  ).rejects.toThrow();
  expect(
    (
      await asUser.query(api.conditionAssessments.getForObject, {
        collectionId,
      })
    ).current.condition,
  ).toBe("Fair");
  expect((await t.run(async (ctx) => ctx.db.get(assessmentId)))?.status).toBe(
    "submitted",
  );
});

test("the Work board counts submitted assessments for members who can accept them", async () => {
  const { t, userId, organizationId, roleId, collectionId } = await setup();
  const asUser = t.withIdentity({ subject: userId });
  const bowlId = await addObject(t, organizationId, userId, "Bowl");
  const jugId = await addObject(t, organizationId, userId, "Jug");
  const plateId = await addObject(t, organizationId, userId, "Plate");

  await asUser.mutation(
    api.conditionAssessments.create,
    draftInput(collectionId),
  );
  await asUser.mutation(api.conditionAssessments.create, {
    ...draftInput(bowlId),
    submit: true,
  });
  const acceptedId = await asUser.mutation(api.conditionAssessments.create, {
    ...draftInput(jugId),
    submit: true,
  });
  await asUser.mutation(api.conditionAssessments.accept, {
    assessmentId: acceptedId,
  });
  const rejectedId = await asUser.mutation(api.conditionAssessments.create, {
    ...draftInput(plateId),
    submit: true,
  });
  await asUser.mutation(api.conditionAssessments.reject, {
    assessmentId: rejectedId,
  });
  const { otherOrganizationId, outsiderId } = await t.run(async (ctx) => {
    const otherOrganizationId = await ctx.db.insert("organizations", {
      name: "Other museum",
      slug: "other",
      type: "museum",
    });
    const otherObjectId = await ctx.db.insert("collections", {
      organizationId: otherOrganizationId,
      accessionNumber: "O-1",
      title: "Other",
      status: "active",
      catalogedBy: userId,
      catalogedAt: Date.now(),
    });
    await ctx.db.insert("conditionAssessments", {
      organizationId: otherOrganizationId,
      collectionId: otherObjectId,
      assessedBy: userId,
      assessedAt: Date.UTC(2026, 9, 1),
      recordedAt: Date.now(),
      condition: "Poor",
      summary: "Elsewhere",
      observations: [],
      photos: [],
      status: "submitted",
    });
    const outsiderId = await ctx.db.insert("users", { name: "Outsider" });
    return { otherOrganizationId, outsiderId };
  });

  expect(await waitingForAcceptance(asUser, organizationId)).toEqual({
    count: 1,
    hasMore: false,
  });
  await expect(
    waitingForAcceptance(
      t.withIdentity({ subject: outsiderId }),
      organizationId,
    ),
  ).rejects.toThrow("Permission denied");
  await expect(
    waitingForAcceptance(asUser, otherOrganizationId),
  ).rejects.toThrow("Permission denied");

  await revoke(t, roleId, "collections.accept_condition");
  expect(await waitingForAcceptance(asUser, organizationId)).toBeUndefined();
});

test("the Work board shows a page of waiting assessments and says there are more", async () => {
  const { t, userId, organizationId } = await setup();
  await t.run(async (ctx) => {
    for (let index = 0; index <= WORK_COLUMN_PAGE; index += 1) {
      const collectionId = await ctx.db.insert("collections", {
        organizationId,
        accessionNumber: `B-${index}`,
        title: `Object ${index}`,
        status: "active",
        catalogedBy: userId,
        catalogedAt: Date.now(),
      });
      await ctx.db.insert("conditionAssessments", {
        organizationId,
        collectionId,
        assessedBy: userId,
        assessedAt: Date.UTC(2026, 9, 1),
        recordedAt: Date.now(),
        condition: "Poor",
        summary: "Waiting",
        observations: [],
        photos: [],
        status: "submitted",
      });
    }
  });

  expect(
    await waitingForAcceptance(
      t.withIdentity({ subject: userId }),
      organizationId,
    ),
  ).toEqual({ count: WORK_COLUMN_PAGE, hasMore: true });
});

test("the board lists each status in its own column with counts and search", async () => {
  const { t, userId, organizationId, collectionId } = await setup();
  const asUser = t.withIdentity({ subject: userId });
  const bowlId = await addObject(t, organizationId, userId, "Bowl");
  const jugId = await addObject(t, organizationId, userId, "Jug");

  const draftId = await asUser.mutation(
    api.conditionAssessments.create,
    draftInput(collectionId),
  );
  const submittedId = await asUser.mutation(api.conditionAssessments.create, {
    ...draftInput(bowlId, "Good"),
    submit: true,
  });
  const acceptedId = await asUser.mutation(api.conditionAssessments.create, {
    ...draftInput(jugId, "Excellent"),
    submit: true,
  });
  await asUser.mutation(api.conditionAssessments.accept, {
    assessmentId: acceptedId,
  });

  const column = (
    status: "draft" | "submitted" | "accepted" | "rejected",
    search?: string,
  ) =>
    asUser.query(api.conditionAssessments.listBoardColumn, {
      organizationId,
      column: status,
      search,
      paginationOpts: { numItems: 10, cursor: null },
    });

  expect((await column("draft")).page).toMatchObject([
    { _id: draftId, objectTitle: "Vase", accessionNumber: "A-1" },
  ]);
  expect((await column("submitted")).page).toMatchObject([
    {
      _id: submittedId,
      objectTitle: "Bowl",
      condition: "Good",
      assessorName: "Assessor",
      submittedAt: expect.any(Number),
    },
  ]);
  expect((await column("accepted")).page).toMatchObject([
    {
      _id: acceptedId,
      objectTitle: "Jug",
      decidedByName: "Assessor",
      decidedAt: expect.any(Number),
    },
  ]);
  expect((await column("rejected")).page).toEqual([]);
  expect((await column("submitted", "bowl")).page).toHaveLength(1);
  expect((await column("submitted", "vase")).page).toHaveLength(0);
  expect(
    await asUser.query(api.conditionAssessments.getBoardCounts, {
      organizationId,
    }),
  ).toEqual({
    draft: { count: 1, hasMore: false },
    submitted: { count: 1, hasMore: false },
    accepted: { count: 1, hasMore: false },
    rejected: { count: 0, hasMore: false },
  });

  const outsiderId = await t.run(async (ctx) =>
    ctx.db.insert("users", { name: "Outsider" }),
  );
  await expect(
    t
      .withIdentity({ subject: outsiderId })
      .query(api.conditionAssessments.getBoardCounts, { organizationId }),
  ).rejects.toThrow();
});

test("board columns list the latest submission or decision first", async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  try {
    const { t, userId, organizationId } = await setup();
    const asUser = t.withIdentity({ subject: userId });
    const olderId = await addObject(t, organizationId, userId, "Older");
    const newerId = await addObject(t, organizationId, userId, "Newer");
    vi.setSystemTime(Date.UTC(2026, 9, 10));
    const olderDraft = await asUser.mutation(
      api.conditionAssessments.create,
      draftInput(olderId),
    );
    vi.setSystemTime(Date.UTC(2026, 9, 11));
    const newerSubmission = await asUser.mutation(
      api.conditionAssessments.create,
      { ...draftInput(newerId), submit: true },
    );
    vi.setSystemTime(Date.UTC(2026, 9, 12));
    await asUser.mutation(api.conditionAssessments.update, {
      assessmentId: olderDraft,
      ...content(),
      submit: true,
    });

    const pending = await asUser.query(
      api.conditionAssessments.listBoardColumn,
      {
        organizationId,
        column: "submitted",
        paginationOpts: { numItems: 10, cursor: null },
      },
    );
    expect(pending.page.map((item) => item._id)).toEqual([
      olderDraft,
      newerSubmission,
    ]);

    vi.setSystemTime(Date.UTC(2026, 9, 13));
    await asUser.mutation(api.conditionAssessments.accept, {
      assessmentId: newerSubmission,
    });
    vi.setSystemTime(Date.UTC(2026, 9, 14));
    await asUser.mutation(api.conditionAssessments.accept, {
      assessmentId: olderDraft,
    });
    const accepted = await asUser.query(
      api.conditionAssessments.listBoardColumn,
      {
        organizationId,
        column: "accepted",
        paginationOpts: { numItems: 10, cursor: null },
      },
    );
    expect(accepted.page.map((item) => item._id)).toEqual([
      olderDraft,
      newerSubmission,
    ]);
  } finally {
    vi.useRealTimers();
  }
});

test("assessment history pages without losing earlier accepted evidence", async () => {
  const { t, userId, collectionId } = await setup();
  const asUser = t.withIdentity({ subject: userId });
  for (const condition of ["First", "Second", "Third"]) {
    const assessmentId = await asUser.mutation(
      api.conditionAssessments.create,
      {
        collectionId,
        assessedAt: Date.UTC(2026, 9, 1),
        condition,
        summary: `${condition} check`,
        observations: [
          { area: "Base", description: "Inspected", severity: "minor" },
        ],
        photos: [],
        submit: true,
      },
    );
    await asUser.mutation(api.conditionAssessments.accept, { assessmentId });
  }
  const firstPage = await asUser.query(api.conditionAssessments.listForObject, {
    collectionId,
    paginationOpts: { numItems: 2, cursor: null },
  });
  const secondPage = await asUser.query(
    api.conditionAssessments.listForObject,
    {
      collectionId,
      paginationOpts: { numItems: 2, cursor: firstPage.continueCursor },
    },
  );
  expect(
    [...firstPage.page, ...secondPage.page].map((item) => item.condition),
  ).toEqual(["Third", "Second", "First"]);
});

test("photo evidence belongs to the object and remains linked after acceptance", async () => {
  const { t, userId, collectionId } = await setup();
  const { photoId, otherPhotoId } = await t.run(async (ctx) => {
    const collection = await ctx.db.get(collectionId);
    if (!collection) throw new Error("Missing test object");
    const otherCollectionId = await ctx.db.insert("collections", {
      organizationId: collection.organizationId,
      accessionNumber: "A-2",
      title: "Other vase",
      status: "active",
      catalogedBy: userId,
      catalogedAt: Date.now(),
    });
    const createPhoto = async (targetId: typeof collectionId) => {
      const storageId = await ctx.storage.store(
        new Blob(["photo"], { type: "image/jpeg" }),
      );
      return await ctx.db.insert("mediaFiles", {
        collectionId: targetId,
        organizationId: collection.organizationId,
        storageId,
        fileName: "base.jpg",
        fileType: "image",
        fileSize: 5,
        mimeType: "image/jpeg",
        isPrimary: false,
        uploadedBy: userId,
        uploadedAt: Date.now(),
        uploadStatus: "completed",
      });
    };
    return {
      photoId: await createPhoto(collectionId),
      otherPhotoId: await createPhoto(otherCollectionId),
    };
  });
  const asUser = t.withIdentity({ subject: userId });
  const input = {
    collectionId,
    assessedAt: Date.UTC(2026, 9, 1),
    condition: "Fair",
    summary: "Base photographed",
    observations: [
      { area: "Base", description: "Fine mark", severity: "minor" as const },
    ],
    submit: true,
  };
  expect(
    await errorCodeOf(
      asUser.mutation(api.conditionAssessments.create, {
        ...input,
        photos: [otherPhotoId],
      }),
    ),
  ).toBe("ASSESSMENT_PHOTO_UNAVAILABLE");
  const assessmentId = await asUser.mutation(api.conditionAssessments.create, {
    ...input,
    photos: [photoId],
  });
  expect(
    (
      await asUser.query(api.conditionAssessments.getForObject, {
        collectionId,
      })
    ).open?.photoIds,
  ).toEqual([photoId]);
  await asUser.mutation(api.conditionAssessments.accept, { assessmentId });
  await asUser.mutation(api.conditionAssessments.accept, { assessmentId });
  const page = await asUser.query(api.conditionAssessments.listForObject, {
    collectionId,
    paginationOpts: { numItems: 10, cursor: null },
  });
  expect(page.page[0]?.photos[0]).toMatchObject({
    id: photoId,
    name: "base.jpg",
  });
  await expect(
    asUser.mutation(api.collections.update, {
      collectionId,
      condition: "Good",
      conditionChangeNote: "manual",
    }),
  ).rejects.toThrow("accepted assessment");
});

test("accepting an assessment whose photo is gone is refused with a code", async () => {
  const { t, userId, collectionId } = await setup();
  const asUser = t.withIdentity({ subject: userId });
  const photoId = await t.run(async (ctx) => {
    const collection = await ctx.db.get(collectionId);
    if (!collection) throw new Error("Missing test object");
    const storageId = await ctx.storage.store(
      new Blob(["photo"], { type: "image/jpeg" }),
    );
    return await ctx.db.insert("mediaFiles", {
      collectionId,
      organizationId: collection.organizationId,
      storageId,
      fileName: "base.jpg",
      fileType: "image",
      fileSize: 5,
      mimeType: "image/jpeg",
      isPrimary: false,
      uploadedBy: userId,
      uploadedAt: Date.now(),
      uploadStatus: "completed",
    });
  });
  const assessmentId = await asUser.mutation(api.conditionAssessments.create, {
    ...draftInput(collectionId),
    photos: [photoId],
    submit: true,
  });
  await t.run(async (ctx) => ctx.db.delete(photoId));

  expect(
    await errorCodeOf(
      asUser.mutation(api.conditionAssessments.accept, { assessmentId }),
    ),
  ).toBe("ASSESSMENT_EVIDENCE_UNAVAILABLE");
  await asUser.mutation(api.conditionAssessments.reject, { assessmentId });
  expect((await t.run(async (ctx) => ctx.db.get(assessmentId)))?.status).toBe(
    "rejected",
  );
});

test("capture requires collections.update permission", async () => {
  const { t, userId, roleId, collectionId } = await setup();
  const asUser = t.withIdentity({ subject: userId });
  await revoke(t, roleId, "collections.update");
  await expect(
    asUser.mutation(api.conditionAssessments.create, {
      collectionId,
      assessedAt: Date.UTC(2026, 9, 1),
      condition: "Good",
      summary: "Blocked capture",
      observations: [],
      photos: [],
    }),
  ).rejects.toThrow();
});

test("rejects unauthenticated capture and future assessment dates", async () => {
  const { t, userId, collectionId } = await setup();
  await expect(
    t.mutation(api.conditionAssessments.create, {
      collectionId,
      assessedAt: Date.UTC(2026, 9, 1),
      condition: "Good",
      summary: "No auth",
      observations: [],
      photos: [],
    }),
  ).rejects.toThrow("Not authenticated");
  const asUser = t.withIdentity({ subject: userId });
  await expect(
    asUser.mutation(api.conditionAssessments.create, {
      collectionId,
      assessedAt: Date.now() + 86_400_000,
      condition: "Good",
      summary: "Future date",
      observations: [],
      photos: [],
    }),
  ).rejects.toThrow("future");
});

test("comparison has no accepted current condition until an assessment is accepted", async () => {
  const { t, userId, collectionId } = await setup();
  const asUser = t.withIdentity({ subject: userId });
  await asUser.mutation(api.conditionAssessments.create, {
    collectionId,
    assessedAt: Date.UTC(2026, 9, 1),
    condition: "Poor",
    summary: "Submitted only",
    observations: [],
    photos: [],
    submit: true,
  });

  const detail = await asUser.query(api.conditionAssessments.getForObject, {
    collectionId,
  });

  expect(detail.current).toMatchObject({ source: "legacy", condition: "Fair" });
  expect(detail.comparison).toEqual({
    legacyCondition: "Fair",
    previousAccepted: null,
    currentCondition: null,
  });
});

test("comparison exposes previous accepted assessment after a second acceptance", async () => {
  const { t, userId, collectionId } = await setup();
  const asUser = t.withIdentity({ subject: userId });
  for (const condition of ["First", "Second"]) {
    const assessmentId = await asUser.mutation(
      api.conditionAssessments.create,
      {
        collectionId,
        assessedAt: Date.UTC(2026, 9, 1),
        condition,
        summary: `${condition} check`,
        observations: [],
        photos: [],
        submit: true,
      },
    );
    await asUser.mutation(api.conditionAssessments.accept, { assessmentId });
  }
  const detail = await asUser.query(api.conditionAssessments.getForObject, {
    collectionId,
  });
  expect(detail.comparison).toMatchObject({
    previousAccepted: { condition: "First" },
    currentCondition: "Second",
  });
});

test("comparison keeps the previous accepted assessment when rejected ones fill the recent window", async () => {
  const { t, userId, organizationId, collectionId } = await setup();
  const asUser = t.withIdentity({ subject: userId });
  const firstId = await asUser.mutation(api.conditionAssessments.create, {
    collectionId,
    assessedAt: Date.UTC(2026, 8, 1),
    condition: "First",
    summary: "Earlier accepted check",
    observations: [],
    photos: [],
    submit: true,
  });
  await asUser.mutation(api.conditionAssessments.accept, {
    assessmentId: firstId,
  });
  await t.run(async (ctx) => {
    for (let index = 0; index < 24; index += 1) {
      await ctx.db.insert("conditionAssessments", {
        organizationId,
        collectionId,
        assessedBy: userId,
        assessedAt: Date.UTC(2026, 8, 2),
        recordedAt: Date.now(),
        condition: `Rejected ${index}`,
        summary: `Unaccepted assessment ${index}`,
        observations: [],
        photos: [],
        status: "rejected",
      });
    }
  });
  const secondId = await asUser.mutation(api.conditionAssessments.create, {
    collectionId,
    assessedAt: Date.UTC(2026, 8, 3),
    condition: "Second",
    summary: "Later accepted check",
    observations: [],
    photos: [],
    submit: true,
  });
  await asUser.mutation(api.conditionAssessments.accept, {
    assessmentId: secondId,
  });

  const detail = await asUser.query(api.conditionAssessments.getForObject, {
    collectionId,
  });
  expect(detail.comparison.previousAccepted).toMatchObject({
    assessmentId: firstId,
    condition: "First",
  });
  expect(detail.comparison.currentCondition).toBe("Second");
});

test("comparison orders the previous accepted assessment by acceptedAt", async () => {
  const { t, userId, organizationId, collectionId } = await setup();
  const asUser = t.withIdentity({ subject: userId });
  // Two submissions of one object can only predate the one-open rule.
  const [earlierCreatedId, laterCreatedId] = await t.run(async (ctx) => {
    const insert = (condition: string, assessedAt: number) =>
      ctx.db.insert("conditionAssessments", {
        organizationId,
        collectionId,
        assessedBy: userId,
        assessedAt,
        recordedAt: Date.now(),
        condition,
        summary: condition,
        observations: [],
        photos: [],
        status: "submitted",
      });
    return [
      await insert("Created first", Date.UTC(2026, 7, 1)),
      await insert("Created second", Date.UTC(2026, 7, 2)),
    ];
  });
  await asUser.mutation(api.conditionAssessments.accept, {
    assessmentId: laterCreatedId,
  });
  await asUser.mutation(api.conditionAssessments.accept, {
    assessmentId: earlierCreatedId,
  });

  const detail = await asUser.query(api.conditionAssessments.getForObject, {
    collectionId,
  });
  expect(detail.comparison.currentCondition).toBe("Created first");
  expect(detail.comparison.previousAccepted).toMatchObject({
    assessmentId: laterCreatedId,
    condition: "Created second",
  });
});

test("legacy drafts are finished one at a time, newest first", async () => {
  const { t, userId, organizationId, collectionId } = await setup();
  const asUser = t.withIdentity({ subject: userId });
  const [olderId, newerId] = await t.run(async (ctx) => {
    const insert = (condition: string) =>
      ctx.db.insert("conditionAssessments", {
        organizationId,
        collectionId,
        assessedBy: userId,
        assessedAt: Date.UTC(2026, 7, 1),
        recordedAt: Date.now(),
        condition,
        summary: condition,
        observations: [],
        photos: [],
        status: "draft",
      });
    return [await insert("Older"), await insert("Newer")];
  });
  const openId = async () =>
    (
      await asUser.query(api.conditionAssessments.getForObject, {
        collectionId,
      })
    ).open?.assessmentId;

  expect(await openId()).toBe(newerId);
  await asUser.mutation(api.conditionAssessments.update, {
    assessmentId: newerId,
    ...content("Newer"),
    submit: true,
  });
  expect(await openId()).toBe(newerId);
  await asUser.mutation(api.conditionAssessments.accept, {
    assessmentId: newerId,
  });
  expect(await openId()).toBe(olderId);
});
