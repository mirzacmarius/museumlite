import type { FunctionArgs } from "convex/server";
import { expect, test } from "vitest";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import {
  type WorkErrorCode,
  workErrorFromError,
} from "../convex/utils/workErrors";
import {
  authedForUser,
  type ConvexTest,
  createConvexTest,
} from "./testHarness";

const STAFF_PERMISSIONS = [
  "collections.read",
  "collections.update",
  "loans.read",
  "loans.update",
  "organization.view_analytics",
];

async function addMember(
  t: ConvexTest,
  organizationId: Id<"organizations">,
  name: string,
  permissions: string[],
) {
  return t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", {
      name,
      email: `${name.toLowerCase().replaceAll(" ", ".")}@example.test`,
    });
    const roleId = await ctx.db.insert("roles", {
      organizationId,
      name: `${name} role`,
      isSystemRole: false,
    });
    for (const permission of permissions) {
      const existing = await ctx.db
        .query("permissions")
        .collect()
        .then((rows) => rows.find((row) => row.name === permission));
      const permissionId =
        existing?._id ??
        (await ctx.db.insert("permissions", {
          name: permission,
          category: permission.startsWith("loans.")
            ? "loans"
            : permission.startsWith("organization.")
              ? "organization"
              : "collections",
        }));
      await ctx.db.insert("rolePermissions", { roleId, permissionId });
    }
    await ctx.db.insert("userOrganizations", {
      userId,
      organizationId,
      roleId,
      joinedAt: 1,
    });
    return userId;
  });
}

async function createOrganization(t: ConvexTest, name: string) {
  return t.run((ctx) =>
    ctx.db.insert("organizations", {
      name,
      slug: name.toLowerCase().replaceAll(" ", "-"),
      type: "museum",
      subscriptionTier: "enterprise",
    }),
  );
}

async function createCases(
  t: ConvexTest,
  organizationId: Id<"organizations">,
  userId: Id<"users">,
  prefix: string,
) {
  return t.run(async (ctx) => {
    const storageId = await ctx.db.insert("locations", {
      organizationId,
      name: `${prefix} storage`,
      type: "storage",
      sortOrder: 0,
      isActive: true,
    });
    const galleryId = await ctx.db.insert("locations", {
      organizationId,
      name: `${prefix} gallery`,
      type: "gallery",
      sortOrder: 1,
      isActive: true,
    });
    const objectId = await ctx.db.insert("collections", {
      organizationId,
      accessionNumber: `${prefix}-OBJ-1`,
      title: `${prefix} vase`,
      status: "active",
      catalogedBy: userId,
      catalogedAt: 1,
      currentLocationId: galleryId,
    });
    const movementId = await ctx.db.insert("locationHistory", {
      collectionId: objectId,
      fromLocationId: storageId,
      toLocationId: galleryId,
      movedBy: userId,
      movedAt: 2,
    });
    const assessmentId = await ctx.db.insert("conditionAssessments", {
      organizationId,
      collectionId: objectId,
      assessedBy: userId,
      assessedAt: 3,
      recordedAt: 3,
      condition: "fair",
      summary: "Hairline crack on rim",
      observations: [],
      photos: [],
      status: "accepted",
      acceptedBy: userId,
      acceptedAt: 3,
    });
    const draftAssessmentId = await ctx.db.insert("conditionAssessments", {
      organizationId,
      collectionId: objectId,
      assessedBy: userId,
      assessedAt: 4,
      recordedAt: 4,
      condition: "good",
      summary: "Unreviewed draft",
      observations: [],
      photos: [],
      status: "draft",
    });
    const loanId = await ctx.db.insert("loans", {
      organizationId,
      loanNumber: `${prefix}-L-001`,
      type: "outgoing",
      lenderBorrowerName: "Partner Museum",
      startDate: 1,
      status: "pending",
    });
    await ctx.db.insert("loanItems", {
      loanId,
      collectionId: objectId,
      custodyStatus: "pending",
    });
    const accessionId = await ctx.db.insert("accessions", {
      organizationId,
      accessionNumber: `${prefix}-A-001`,
      dateReceived: 1,
      source: "Donor",
      method: "gift",
      status: "pending",
      collectionId: objectId,
    });
    const deaccessionId = await ctx.db.insert("deaccessions", {
      organizationId,
      collectionId: objectId,
      deaccessionNumber: `${prefix}-D-001`,
      dateDeaccessioned: 1,
      reason: "Duplicate",
      method: "transfer",
      status: "pending",
    });
    const exhibitionId = await ctx.db.insert("exhibitions", {
      organizationId,
      title: `${prefix} exhibition`,
      startDate: 1,
      isCurrent: false,
      status: "proposed",
    });
    const treatmentId = await ctx.db.insert("conservationTreatments", {
      organizationId,
      collectionId: objectId,
      treatmentType: "cleaning",
      title: `${prefix} cleaning`,
      description: "Surface clean",
      performedBy: userId,
      performedAt: 1,
      status: "proposed",
    });
    return {
      objectId,
      galleryId,
      movementId,
      assessmentId,
      draftAssessmentId,
      loanId,
      accessionId,
      deaccessionId,
      exhibitionId,
      treatmentId,
    };
  });
}

async function setup() {
  const t = createConvexTest();
  const organizationId = await createOrganization(t, "Home Museum");
  const registrarId = await addMember(
    t,
    organizationId,
    "Rita Registrar",
    STAFF_PERMISSIONS,
  );
  const reviewerId = await addMember(
    t,
    organizationId,
    "Victor Reviewer",
    STAFF_PERMISSIONS,
  );
  const viewerId = await addMember(t, organizationId, "Vera Viewer", [
    "collections.read",
  ]);
  const cases = await createCases(t, organizationId, registrarId, "HOME");

  const foreignOrganizationId = await createOrganization(t, "Other Museum");
  const foreignStaffId = await addMember(
    t,
    foreignOrganizationId,
    "Fiona Foreign",
    STAFF_PERMISSIONS,
  );
  const foreignCases = await createCases(
    t,
    foreignOrganizationId,
    foreignStaffId,
    "OTHER",
  );
  const outsiderId = await t.run((ctx) =>
    ctx.db.insert("users", {
      name: "Olly Outsider",
      email: "olly@example.test",
    }),
  );

  return {
    t,
    organizationId,
    registrarId,
    reviewerId,
    viewerId,
    outsiderId,
    foreignOrganizationId,
    foreignStaffId,
    cases,
    foreignCases,
    registrar: authedForUser(t, registrarId),
    reviewer: authedForUser(t, reviewerId),
    viewer: authedForUser(t, viewerId),
    foreignStaff: authedForUser(t, foreignStaffId),
  };
}

async function workErrorCodeOf(call: Promise<unknown>): Promise<WorkErrorCode> {
  try {
    await call;
  } catch (error) {
    const data = workErrorFromError(error);
    if (!data) throw error;
    return data.code;
  }
  throw new Error("Expected the call to be rejected");
}

test("staff create an owned, dated task on a loan case and see it on the case", async () => {
  const { registrar, organizationId, reviewerId, cases } = await setup();

  const taskId = await registrar.mutation(api.caseTasks.create, {
    organizationId,
    caseType: "loan",
    caseId: cases.loanId,
    title: "Confirm courier booking",
    ownerId: reviewerId,
    dueDate: Date.UTC(2026, 11, 1),
  });

  const view = await registrar.query(api.caseTasks.listForCase, {
    organizationId,
    caseType: "loan",
    caseId: cases.loanId,
  });
  expect(view.canManage).toBe(true);
  expect(view.tasks).toMatchObject([
    {
      _id: taskId,
      title: "Confirm courier booking",
      status: "todo",
      caseLabel: "HOME-L-001",
      ownerName: "Victor Reviewer",
      dueDate: Date.UTC(2026, 11, 1),
      openDependencyCount: 0,
    },
  ]);
});

test("a case id from another organization or of another case type is not a valid link", async () => {
  const { registrar, organizationId, reviewerId, cases, foreignCases } =
    await setup();

  for (const [caseType, caseId] of [
    ["loan", foreignCases.loanId],
    ["accession", foreignCases.accessionId],
    ["exhibition", foreignCases.exhibitionId],
    ["loan", cases.accessionId],
    ["conservation", "not-a-convex-id"],
  ] as const) {
    expect(
      await workErrorCodeOf(
        registrar.mutation(api.caseTasks.create, {
          organizationId,
          caseType,
          caseId,
          title: "Leak attempt",
          ownerId: reviewerId,
        }),
      ),
    ).toBe("CASE_NOT_FOUND");
  }
  expect(
    await workErrorCodeOf(
      registrar.query(api.caseTasks.listForCase, {
        organizationId,
        caseType: "loan",
        caseId: foreignCases.loanId,
      }),
    ),
  ).toBe("CASE_NOT_FOUND");
});

test("an unknown case type is rejected", async () => {
  const { registrar, organizationId, reviewerId, cases } = await setup();
  const args = {
    organizationId,
    caseType: "invoice",
    caseId: cases.loanId,
    title: "Untyped link",
    ownerId: reviewerId,
  };
  await expect(
    registrar.mutation(
      api.caseTasks.create,
      args as unknown as FunctionArgs<typeof api.caseTasks.create>,
    ),
  ).rejects.toThrow(/Validator error.*"invoice"/s);
});

test("staff without access to the case cannot read or add its tasks", async () => {
  const { viewer, foreignStaff, organizationId, reviewerId, cases } =
    await setup();

  await expect(
    viewer.query(api.caseTasks.listForCase, {
      organizationId,
      caseType: "loan",
      caseId: cases.loanId,
    }),
  ).rejects.toThrow("Permission denied: loans.read");
  await expect(
    viewer.mutation(api.caseTasks.create, {
      organizationId,
      caseType: "accession",
      caseId: cases.accessionId,
      title: "Read-only staff cannot add work",
      ownerId: reviewerId,
    }),
  ).rejects.toThrow("Permission denied: collections.update");
  await expect(
    foreignStaff.query(api.caseTasks.listForCase, {
      organizationId,
      caseType: "accession",
      caseId: cases.accessionId,
    }),
  ).rejects.toThrow("Permission denied");

  const readOnly = await viewer.query(api.caseTasks.listForCase, {
    organizationId,
    caseType: "accession",
    caseId: cases.accessionId,
  });
  expect(readOnly.canManage).toBe(false);
});

test("owners must be members who can work on the case and only they are notified", async () => {
  const {
    t,
    registrar,
    organizationId,
    reviewerId,
    viewerId,
    outsiderId,
    foreignStaffId,
    cases,
  } = await setup();

  for (const ownerId of [outsiderId, foreignStaffId, viewerId]) {
    expect(
      await workErrorCodeOf(
        registrar.mutation(api.caseTasks.create, {
          organizationId,
          caseType: "loan",
          caseId: cases.loanId,
          title: "Secret courier plan",
          ownerId,
        }),
      ),
    ).toBe("ASSIGNEE_NOT_ELIGIBLE");
  }
  for (const userId of [outsiderId, foreignStaffId, viewerId]) {
    const inbox = await authedForUser(t, userId).query(
      api.notifications.getNotificationCenter,
      { organizationId },
    );
    expect(inbox.notifications).toEqual([]);
  }

  await registrar.mutation(api.caseTasks.create, {
    organizationId,
    caseType: "loan",
    caseId: cases.loanId,
    title: "Secret courier plan",
    ownerId: reviewerId,
  });
  const ownerInbox = await authedForUser(t, reviewerId).query(
    api.notifications.getNotificationCenter,
    { organizationId },
  );
  expect(ownerInbox.notifications).toMatchObject([
    {
      type: "task_assigned",
      message: "You own a task: Secret courier plan",
      relatedEntityType: "loan",
      relatedEntityId: cases.loanId,
    },
  ]);
});

test("dependencies must be tasks on the same case, wherever a foreign one appears", async () => {
  const {
    registrar,
    foreignStaff,
    organizationId,
    foreignOrganizationId,
    registrarId,
    reviewerId,
    foreignStaffId,
    cases,
    foreignCases,
  } = await setup();
  const onLoan = (title: string, dependsOnTaskIds?: Id<"caseTasks">[]) =>
    registrar.mutation(api.caseTasks.create, {
      organizationId,
      caseType: "loan",
      caseId: cases.loanId,
      title,
      ownerId: registrarId,
      dependsOnTaskIds,
    });
  const first = await onLoan("Pack crate");
  const second = await onLoan("Book courier");
  const otherCase = await registrar.mutation(api.caseTasks.create, {
    organizationId,
    caseType: "accession",
    caseId: cases.accessionId,
    title: "Accession paperwork",
    ownerId: reviewerId,
  });
  const foreign = await foreignStaff.mutation(api.caseTasks.create, {
    organizationId: foreignOrganizationId,
    caseType: "loan",
    caseId: foreignCases.loanId,
    title: "Foreign task",
    ownerId: foreignStaffId,
  });

  for (const outsider of [otherCase, foreign]) {
    for (const dependsOnTaskIds of [
      [outsider, first, second],
      [first, outsider, second],
      [first, second, outsider],
    ]) {
      expect(await workErrorCodeOf(onLoan("Ship", dependsOnTaskIds))).toBe(
        "DEPENDENCY_INVALID",
      );
    }
  }
  const view = await registrar.query(api.caseTasks.listForCase, {
    organizationId,
    caseType: "loan",
    caseId: cases.loanId,
  });
  expect(view.tasks.map((task) => task.title)).toEqual([
    "Pack crate",
    "Book courier",
  ]);
});

async function loanTasks(
  staff: ReturnType<typeof authedForUser>,
  organizationId: Id<"organizations">,
  loanId: Id<"loans">,
) {
  const view = await staff.query(api.caseTasks.listForCase, {
    organizationId,
    caseType: "loan",
    caseId: loanId,
  });
  return new Map(view.tasks.map((task) => [task.title, task]));
}

test("a task waits for open dependencies, and blockers keep a reason until unblocked", async () => {
  const { registrar, organizationId, registrarId, cases } = await setup();
  const pack = await registrar.mutation(api.caseTasks.create, {
    organizationId,
    caseType: "loan",
    caseId: cases.loanId,
    title: "Pack crate",
    ownerId: registrarId,
  });
  const ship = await registrar.mutation(api.caseTasks.create, {
    organizationId,
    caseType: "loan",
    caseId: cases.loanId,
    title: "Ship crate",
    ownerId: registrarId,
    dependsOnTaskIds: [pack],
  });

  expect(
    (await loanTasks(registrar, organizationId, cases.loanId)).get(
      "Ship crate",
    ),
  ).toMatchObject({
    openDependencyCount: 1,
    dependsOn: [{ _id: pack, title: "Pack crate", status: "todo" }],
  });
  expect(
    await workErrorCodeOf(
      registrar.mutation(api.caseTasks.start, { taskId: ship }),
    ),
  ).toBe("DEPENDENCIES_OPEN");
  expect(
    await workErrorCodeOf(
      registrar.mutation(api.caseTasks.complete, { taskId: ship }),
    ),
  ).toBe("DEPENDENCIES_OPEN");

  await registrar.mutation(api.caseTasks.start, { taskId: pack });
  await registrar.mutation(api.caseTasks.block, {
    taskId: pack,
    reason: "Crate supplier delayed",
  });
  expect(
    (await loanTasks(registrar, organizationId, cases.loanId)).get(
      "Pack crate",
    ),
  ).toMatchObject({
    status: "blocked",
    blockedReason: "Crate supplier delayed",
  });
  expect(
    await workErrorCodeOf(
      registrar.mutation(api.caseTasks.complete, { taskId: pack }),
    ),
  ).toBe("STATUS_CHANGED");

  await registrar.mutation(api.caseTasks.unblock, { taskId: pack });
  const resumed = (
    await loanTasks(registrar, organizationId, cases.loanId)
  ).get("Pack crate");
  expect(resumed?.status).toBe("in_progress");
  expect(resumed?.blockedReason).toBeUndefined();

  await registrar.mutation(api.caseTasks.complete, {
    taskId: pack,
    note: "Crate sealed",
  });
  await registrar.mutation(api.caseTasks.complete, { taskId: pack });
  await registrar.mutation(api.caseTasks.start, { taskId: ship });
  const after = await loanTasks(registrar, organizationId, cases.loanId);
  expect(after.get("Pack crate")).toMatchObject({
    status: "done",
    completionNote: "Crate sealed",
  });
  expect(after.get("Ship crate")).toMatchObject({
    status: "in_progress",
    openDependencyCount: 0,
  });
});

test("a reviewed task is approved only by its reviewer, with every step on the case history", async () => {
  const {
    t,
    registrar,
    reviewer,
    organizationId,
    registrarId,
    reviewerId,
    cases,
  } = await setup();
  const taskId = await registrar.mutation(api.caseTasks.create, {
    organizationId,
    caseType: "loan",
    caseId: cases.loanId,
    title: "Check insurance certificate",
    ownerId: registrarId,
    reviewerId,
  });

  expect(
    await workErrorCodeOf(
      registrar.mutation(api.caseTasks.complete, { taskId }),
    ),
  ).toBe("REVIEW_REQUIRED");
  await registrar.mutation(api.caseTasks.submitForReview, {
    taskId,
    note: "Certificate attached",
  });
  await registrar.mutation(api.caseTasks.submitForReview, { taskId });

  const queue = await reviewer.query(api.caseTasks.listReviewQueue, {
    organizationId,
    paginationOpts: { numItems: 10, cursor: null },
  });
  expect(queue.page).toMatchObject([
    {
      _id: taskId,
      status: "in_review",
      caseLabel: "HOME-L-001",
      ownerName: "Rita Registrar",
      viewerIsReviewer: true,
    },
  ]);
  expect(
    await workErrorCodeOf(
      registrar.mutation(api.caseTasks.approve, { taskId }),
    ),
  ).toBe("REVIEWER_ONLY");

  await reviewer.mutation(api.caseTasks.returnForChanges, {
    taskId,
    note: "Wrong policy year",
  });
  const ownerInbox = await authedForUser(t, registrarId).query(
    api.notifications.getNotificationCenter,
    { organizationId },
  );
  expect(ownerInbox.notifications[0]).toMatchObject({
    type: "task_returned",
    relatedEntityType: "loan",
    relatedEntityId: cases.loanId,
  });
  expect(
    (await loanTasks(registrar, organizationId, cases.loanId)).get(
      "Check insurance certificate",
    ),
  ).toMatchObject({ status: "in_progress", reviewNote: "Wrong policy year" });

  await registrar.mutation(api.caseTasks.submitForReview, { taskId });
  await reviewer.mutation(api.caseTasks.approve, {
    taskId,
    note: "Correct now",
  });
  await reviewer.mutation(api.caseTasks.approve, { taskId });
  expect(
    (
      await reviewer.query(api.caseTasks.listReviewQueue, {
        organizationId,
        paginationOpts: { numItems: 10, cursor: null },
      })
    ).page,
  ).toEqual([]);
  expect(
    (await loanTasks(registrar, organizationId, cases.loanId)).get(
      "Check insurance certificate",
    ),
  ).toMatchObject({ status: "done", reviewNote: "Correct now" });

  const history = await registrar.query(api.auditLog.list, {
    organizationId,
    caseId: `loan:${cases.loanId}`,
  });
  expect(
    history.entries
      .filter((entry) => entry.entityType === "caseTask")
      .map((entry) => entry.action)
      .reverse(),
  ).toEqual([
    "task_created",
    "task_submitted_for_review",
    "task_returned",
    "task_submitted_for_review",
    "task_approved",
  ]);
});

test("completing a task with evidence does not change custody, condition or approval", async () => {
  const { registrar, organizationId, registrarId, cases } = await setup();
  const before = {
    loan: await registrar.query(api.loans.get, { loanId: cases.loanId }),
    accession: await registrar.query(api.accessions.get, {
      accessionId: cases.accessionId,
    }),
    object: await registrar.query(api.collections.get, {
      collectionId: cases.objectId,
    }),
    assessments: await registrar.query(api.conditionAssessments.listForObject, {
      collectionId: cases.objectId,
      paginationOpts: { numItems: 10, cursor: null },
    }),
  };

  const loanTask = await registrar.mutation(api.caseTasks.create, {
    organizationId,
    caseType: "loan",
    caseId: cases.loanId,
    title: "Courier handover",
    ownerId: registrarId,
  });
  const accessionTask = await registrar.mutation(api.caseTasks.create, {
    organizationId,
    caseType: "accession",
    caseId: cases.accessionId,
    title: "Deed of gift signed",
    ownerId: registrarId,
  });
  await registrar.mutation(api.caseTasks.linkEvidence, {
    taskId: loanTask,
    reference: { kind: "movement", id: cases.movementId },
  });
  await registrar.mutation(api.caseTasks.linkEvidence, {
    taskId: loanTask,
    reference: { kind: "conditionAssessment", id: cases.assessmentId },
  });
  await registrar.mutation(api.caseTasks.complete, { taskId: loanTask });
  await registrar.mutation(api.caseTasks.complete, { taskId: accessionTask });

  expect(
    await registrar.query(api.loans.get, { loanId: cases.loanId }),
  ).toEqual(before.loan);
  expect(
    await registrar.query(api.accessions.get, {
      accessionId: cases.accessionId,
    }),
  ).toEqual(before.accession);
  expect(
    await registrar.query(api.collections.get, {
      collectionId: cases.objectId,
    }),
  ).toEqual(before.object);
  expect(
    await registrar.query(api.conditionAssessments.listForObject, {
      collectionId: cases.objectId,
      paginationOpts: { numItems: 10, cursor: null },
    }),
  ).toEqual(before.assessments);

  const done = (await loanTasks(registrar, organizationId, cases.loanId)).get(
    "Courier handover",
  );
  expect(done?.status).toBe("done");
  expect(done?.evidence).toMatchObject([
    {
      kind: "movement",
      visible: true,
      label: "HOME vase: HOME storage -> HOME gallery",
      objectId: cases.objectId,
      recordedAt: 2,
    },
    {
      kind: "conditionAssessment",
      visible: true,
      label: "fair: Hairline crack on rim",
      objectId: cases.objectId,
      recordedAt: 3,
    },
  ]);
});

test("My work pages open owned tasks soonest due first and stays bounded", async () => {
  const {
    t,
    registrar,
    reviewer,
    foreignStaff,
    organizationId,
    registrarId,
    reviewerId,
    cases,
  } = await setup();
  const day = 24 * 60 * 60 * 1000;
  const titles = [
    "Due day 5",
    "Undated",
    "Due day 1",
    "Due day 3",
    "Due day 2",
  ];
  const dueDates = [5 * day, undefined, day, 3 * day, 2 * day];
  for (const [index, title] of titles.entries()) {
    await registrar.mutation(api.caseTasks.create, {
      organizationId,
      caseType: index % 2 === 0 ? "loan" : "accession",
      caseId: index % 2 === 0 ? cases.loanId : cases.accessionId,
      title,
      ownerId: registrarId,
      dueDate: dueDates[index],
    });
  }
  const finished = await registrar.mutation(api.caseTasks.create, {
    organizationId,
    caseType: "loan",
    caseId: cases.loanId,
    title: "Already finished",
    ownerId: registrarId,
    dueDate: 0,
  });
  await registrar.mutation(api.caseTasks.complete, { taskId: finished });
  await registrar.mutation(api.caseTasks.create, {
    organizationId,
    caseType: "loan",
    caseId: cases.loanId,
    title: "Someone else's work",
    ownerId: reviewerId,
    dueDate: 0,
  });

  const seen: string[] = [];
  let cursor: string | null = null;
  let pages = 0;
  do {
    const result = await registrar.query(api.caseTasks.listMyWork, {
      organizationId,
      paginationOpts: { numItems: 2, cursor },
    });
    expect(result.page.length).toBeLessThanOrEqual(2);
    seen.push(...result.page.map((task) => task.title));
    cursor = result.isDone ? null : result.continueCursor;
    pages++;
  } while (cursor && pages < 10);
  expect(seen).toEqual([
    "Due day 1",
    "Due day 2",
    "Due day 3",
    "Due day 5",
    "Undated",
  ]);

  expect(
    await workErrorCodeOf(
      registrar.query(api.caseTasks.listMyWork, {
        organizationId,
        paginationOpts: { numItems: 51, cursor: null },
      }),
    ),
  ).toBe("INVALID_INPUT");
  await expect(
    foreignStaff.query(api.caseTasks.listMyWork, {
      organizationId,
      paginationOpts: { numItems: 10, cursor: null },
    }),
  ).rejects.toThrow("Permission denied");

  await t.run((ctx) =>
    ctx.db.patch(organizationId, { subscriptionTier: "free" }),
  );
  const withoutLoans = await registrar.query(api.caseTasks.listMyWork, {
    organizationId,
    paginationOpts: { numItems: 10, cursor: null },
  });
  expect(withoutLoans.page.map((task) => task.title)).toEqual([
    "Due day 3",
    "Undated",
  ]);
  expect(
    (
      await reviewer.query(api.caseTasks.listMyWork, {
        organizationId,
        paginationOpts: { numItems: 10, cursor: null },
      })
    ).page,
  ).toEqual([]);
});

test("My work lists open accession, deaccession and loan assignments in this organization", async () => {
  const {
    registrar,
    foreignStaff,
    organizationId,
    registrarId,
    foreignStaffId,
    cases,
    foreignCases,
  } = await setup();
  await registrar.mutation(api.accessions.assign, {
    accessionId: cases.accessionId,
    userId: registrarId,
  });
  await registrar.mutation(api.workflows.assignDeaccession, {
    deaccessionId: cases.deaccessionId,
    userId: registrarId,
  });
  await registrar.mutation(api.workflows.assignLoan, {
    loanId: cases.loanId,
    userId: registrarId,
  });
  await foreignStaff.mutation(api.workflows.assignLoan, {
    loanId: foreignCases.loanId,
    userId: foreignStaffId,
  });

  const assigned = await registrar.query(api.caseTasks.listMyAssignedCases, {
    organizationId,
  });
  expect(assigned.truncated).toBe(false);
  expect(
    assigned.cases.map((row) => [row.caseType, row.caseId, row.caseLabel]),
  ).toEqual(
    expect.arrayContaining([
      ["accession", cases.accessionId, "HOME-A-001"],
      ["deaccession", cases.deaccessionId, "HOME-D-001"],
      ["loan", cases.loanId, "HOME-L-001"],
    ]),
  );
  expect(assigned.cases).toHaveLength(3);
});

test("tasks from another organization cannot be read, moved or reassigned", async () => {
  const {
    registrar,
    foreignStaff,
    organizationId,
    registrarId,
    foreignStaffId,
    cases,
  } = await setup();
  const taskId = await registrar.mutation(api.caseTasks.create, {
    organizationId,
    caseType: "loan",
    caseId: cases.loanId,
    title: "Home only",
    ownerId: registrarId,
  });

  for (const call of [
    foreignStaff.mutation(api.caseTasks.start, { taskId }),
    foreignStaff.mutation(api.caseTasks.complete, { taskId }),
    foreignStaff.mutation(api.caseTasks.cancel, { taskId, reason: "Mine" }),
    foreignStaff.mutation(api.caseTasks.assign, {
      taskId,
      ownerId: foreignStaffId,
      reviewerId: null,
      dueDate: null,
    }),
    foreignStaff.mutation(api.caseTasks.linkEvidence, {
      taskId,
      reference: { kind: "movement", id: cases.movementId },
    }),
  ])
    expect(await workErrorCodeOf(call)).toBe("TASK_NOT_FOUND");

  expect(
    (await loanTasks(registrar, organizationId, cases.loanId)).get("Home only"),
  ).toMatchObject({ status: "todo", ownerId: registrarId, evidence: [] });
});

test("reassignment keeps owners and reviewers inside the case's eligible members", async () => {
  const {
    t,
    registrar,
    organizationId,
    registrarId,
    reviewerId,
    viewerId,
    outsiderId,
    cases,
  } = await setup();
  const taskId = await registrar.mutation(api.caseTasks.create, {
    organizationId,
    caseType: "accession",
    caseId: cases.accessionId,
    title: "Photograph object",
    ownerId: registrarId,
  });

  const members = await registrar.query(api.caseTasks.listAssignableMembers, {
    organizationId,
    caseType: "accession",
    caseId: cases.accessionId,
  });
  expect(members.map((member) => member.name)).toEqual([
    "Rita Registrar",
    "Victor Reviewer",
  ]);

  for (const ownerId of [outsiderId, viewerId])
    expect(
      await workErrorCodeOf(
        registrar.mutation(api.caseTasks.assign, {
          taskId,
          ownerId,
          reviewerId: null,
          dueDate: null,
        }),
      ),
    ).toBe("ASSIGNEE_NOT_ELIGIBLE");
  expect(
    await workErrorCodeOf(
      registrar.mutation(api.caseTasks.assign, {
        taskId,
        ownerId: registrarId,
        reviewerId: registrarId,
        dueDate: null,
      }),
    ),
  ).toBe("REVIEWER_NOT_ELIGIBLE");
  expect(
    await workErrorCodeOf(
      registrar.mutation(api.caseTasks.assign, {
        taskId,
        ownerId: registrarId,
        reviewerId: outsiderId,
        dueDate: null,
      }),
    ),
  ).toBe("REVIEWER_NOT_ELIGIBLE");

  await registrar.mutation(api.caseTasks.assign, {
    taskId,
    ownerId: reviewerId,
    reviewerId: registrarId,
    dueDate: 42,
  });
  const reassigned = await authedForUser(t, reviewerId).query(
    api.caseTasks.listMyWork,
    { organizationId, paginationOpts: { numItems: 10, cursor: null } },
  );
  expect(reassigned.page).toMatchObject([
    {
      _id: taskId,
      ownerName: "Victor Reviewer",
      reviewerName: "Rita Registrar",
      dueDate: 42,
    },
  ]);
  const inbox = await authedForUser(t, reviewerId).query(
    api.notifications.getNotificationCenter,
    { organizationId },
  );
  expect(inbox.notifications).toMatchObject([
    { type: "task_assigned", relatedEntityType: "accession" },
  ]);
});

test("evidence links cite only accessible records of the same organization", async () => {
  const {
    t,
    registrar,
    viewer,
    organizationId,
    registrarId,
    cases,
    foreignCases,
  } = await setup();
  const taskId = await registrar.mutation(api.caseTasks.create, {
    organizationId,
    caseType: "loan",
    caseId: cases.loanId,
    title: "Condition check before dispatch",
    ownerId: registrarId,
  });

  for (const reference of [
    { kind: "movement" as const, id: foreignCases.movementId },
    { kind: "conditionAssessment" as const, id: foreignCases.assessmentId },
    { kind: "conditionAssessment" as const, id: cases.draftAssessmentId },
  ])
    expect(
      await workErrorCodeOf(
        registrar.mutation(api.caseTasks.linkEvidence, { taskId, reference }),
      ),
    ).toBe("EVIDENCE_NOT_FOUND");

  const candidates = await registrar.query(
    api.caseTasks.listEvidenceCandidates,
    { organizationId, caseType: "loan", caseId: cases.loanId },
  );
  expect(candidates.map((candidate) => candidate.reference)).toEqual(
    expect.arrayContaining([
      { kind: "conditionAssessment", id: cases.assessmentId },
      { kind: "movement", id: cases.movementId },
    ]),
  );
  expect(
    candidates.some(
      (candidate) => candidate.reference.id === cases.draftAssessmentId,
    ),
  ).toBe(false);
  const auditCandidate = candidates.find(
    (candidate) => candidate.reference.kind === "auditEntry",
  );
  expect(auditCandidate?.label).toBe(
    "task_created: Condition check before dispatch",
  );
  if (auditCandidate?.reference.kind !== "auditEntry")
    throw new Error("Expected an audit entry candidate");

  const first = await registrar.mutation(api.caseTasks.linkEvidence, {
    taskId,
    reference: auditCandidate.reference,
  });
  expect(
    await registrar.mutation(api.caseTasks.linkEvidence, {
      taskId,
      reference: auditCandidate.reference,
    }),
  ).toBe(first);

  await t.run(async (ctx) => {
    const viewerRole = await ctx.db
      .query("roles")
      .withIndex("by_organization_and_name", (q) =>
        q.eq("organizationId", organizationId).eq("name", "Vera Viewer role"),
      )
      .unique();
    if (!viewerRole) throw new Error("Viewer role missing");
    const accession = await ctx.db.insert("permissions", {
      name: "loans.read",
      category: "loans",
    });
    await ctx.db.insert("rolePermissions", {
      roleId: viewerRole._id,
      permissionId: accession,
    });
  });
  const viewerTask = (
    await loanTasks(viewer, organizationId, cases.loanId)
  ).get("Condition check before dispatch");
  expect(viewerTask?.evidence).toMatchObject([
    { kind: "auditEntry", visible: false },
  ]);
  expect(viewerTask?.evidence[0]?.label).toBeUndefined();
});
