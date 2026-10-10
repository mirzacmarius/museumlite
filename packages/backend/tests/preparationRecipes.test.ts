import { afterEach, expect, test, vi } from "vitest";
import { api, internal } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import { workErrorFromError } from "../convex/utils/workErrors";
import { addMember, emailChoices } from "./notificationFixtures";
import {
  authedForUser,
  capabilityFailureOf,
  createConvexTest,
} from "./testHarness";

type Member = ReturnType<typeof authedForUser>;

const DAY = 24 * 60 * 60 * 1000;
const LOAN_START = Date.UTC(2026, 11, 1);
const LOAN_END = Date.UTC(2027, 2, 1);
const OPENING = Date.UTC(2027, 0, 15);
const CLOSING = Date.UTC(2027, 5, 30);
/** Approvals in the clock-controlled tests happen at 09:30 UTC on this day. */
const TODAY = Date.UTC(2026, 9, 12);

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

const ADMIN_PERMISSIONS = [
  "organization.manage_settings",
  "collections.read",
  "collections.update",
  "collections.approve_accession",
  "loans.read",
  "loans.update",
  "loans.approve",
];
const STAFF_PERMISSIONS = [
  "collections.read",
  "collections.update",
  "loans.read",
  "loans.update",
  "media.read",
];
const VIEWER_PERMISSIONS = ["collections.read", "loans.read"];

const TRANSPORT_RECIPE = {
  name: "Pack, insure and arrange transport",
  trigger: "loan_approved" as const,
  loanDirection: "outgoing" as const,
  steps: [
    {
      title: "Outgoing condition check",
      evidence: "conditionAssessment" as const,
      owner: { kind: "caseAssignee" as const },
      due: { anchor: "start" as const, offsetDays: -14 },
      dependsOn: [],
    },
    {
      title: "Confirm insurance cover",
      owner: { kind: "approver" as const },
      due: { anchor: "start" as const, offsetDays: -10 },
      dependsOn: [],
    },
    {
      title: "Pack the objects",
      evidence: "media" as const,
      owner: { kind: "caseAssignee" as const },
      due: { anchor: "start" as const, offsetDays: -3 },
      dependsOn: [0],
    },
  ],
};

const INTAKE_RECIPE = {
  name: "Catalog, photograph and assess condition",
  trigger: "intake_accepted" as const,
  steps: [
    {
      title: "Complete the catalog record",
      owner: { kind: "caseAssignee" as const },
      due: { anchor: "event" as const, offsetDays: 7 },
      dependsOn: [],
    },
    {
      title: "Photograph the object",
      evidence: "media" as const,
      owner: { kind: "caseAssignee" as const },
      due: { anchor: "event" as const, offsetDays: 14 },
      dependsOn: [],
    },
    {
      title: "Record a condition assessment",
      evidence: "conditionAssessment" as const,
      owner: { kind: "caseAssignee" as const },
      due: { anchor: "event" as const, offsetDays: 14 },
      dependsOn: [],
    },
  ],
};

const RETURN_RECIPE = {
  name: "Prepare the return",
  trigger: "exhibition_approved" as const,
  steps: [
    {
      title: "Book return transport",
      owner: { kind: "approver" as const },
      due: { anchor: "end" as const, offsetDays: -21 },
      dependsOn: [],
    },
    {
      title: "Condition check after deinstallation",
      evidence: "conditionAssessment" as const,
      owner: { kind: "approver" as const },
      due: { anchor: "end" as const, offsetDays: 2 },
      dependsOn: [0],
    },
  ],
};

const LOAN_RETURN_RECIPE = {
  name: "Prepare the loan return",
  trigger: "loan_approved" as const,
  steps: [
    {
      title: "Confirm return transport",
      owner: { kind: "caseAssignee" as const },
      due: { anchor: "end" as const, offsetDays: -14 },
      dependsOn: [],
    },
    {
      title: "Condition check on return",
      evidence: "conditionAssessment" as const,
      owner: { kind: "caseAssignee" as const },
      due: { anchor: "end" as const, offsetDays: 3 },
      dependsOn: [0],
    },
  ],
};

/** Runs approvals at 09:30 UTC on TODAY. */
function freezeClock() {
  vi.useFakeTimers();
  vi.setSystemTime(TODAY + 9.5 * 60 * 60 * 1000);
}

async function setup() {
  const t = createConvexTest();
  const organizationId = await t.run((ctx) =>
    ctx.db.insert("organizations", {
      name: "Home Museum",
      slug: "home-museum",
      type: "museum",
      subscriptionTier: "enterprise",
    }),
  );
  const adminId = await addMember(t, organizationId, "ada", ADMIN_PERMISSIONS);
  const registrarId = await addMember(
    t,
    organizationId,
    "rita",
    STAFF_PERMISSIONS,
  );
  const viewerId = await addMember(
    t,
    organizationId,
    "vera",
    VIEWER_PERMISSIONS,
  );
  const cases = await t.run(async (ctx) => {
    const storageId = await ctx.db.insert("locations", {
      organizationId,
      name: "Store A",
      type: "storage",
      sortOrder: 0,
      isActive: true,
    });
    const objectId = await ctx.db.insert("collections", {
      organizationId,
      accessionNumber: "OBJ-1",
      title: "Blue vase",
      status: "active",
      catalogedBy: adminId,
      catalogedAt: 1,
      currentLocationId: storageId,
    });
    const loanId = await ctx.db.insert("loans", {
      organizationId,
      loanNumber: "L-001",
      type: "outgoing",
      lenderBorrowerName: "Partner Museum",
      startDate: LOAN_START,
      endDate: LOAN_END,
      status: "pending",
      assignedTo: registrarId,
    });
    await ctx.db.insert("loanItems", {
      loanId,
      collectionId: objectId,
      custodyStatus: "pending",
    });
    const accessionId = await ctx.db.insert("accessions", {
      organizationId,
      accessionNumber: "2026.1",
      dateReceived: 1,
      source: "Gift of A. Donor",
      method: "gift",
      status: "pending",
      workflowStep: 1,
      collectionId: objectId,
      assignedTo: registrarId,
    });
    const exhibitionId = await ctx.db.insert("exhibitions", {
      organizationId,
      title: "Blue and white",
      startDate: OPENING,
      endDate: CLOSING,
      isCurrent: false,
      status: "proposed",
    });
    return { storageId, objectId, loanId, accessionId, exhibitionId };
  });
  return {
    t,
    organizationId,
    adminId,
    registrarId,
    viewerId,
    cases,
    admin: authedForUser(t, adminId),
    registrar: authedForUser(t, registrarId),
    viewer: authedForUser(t, viewerId),
  };
}

const FIRST_PAGE = { numItems: 20, cursor: null };

async function workErrorCodeOf(call: Promise<unknown>) {
  try {
    await call;
  } catch (error) {
    const data = workErrorFromError(error);
    if (!data) throw error;
    return data.code;
  }
  throw new Error("Expected the call to be rejected");
}

async function assignmentMessages(
  member: Member,
  organizationId: Id<"organizations">,
) {
  const center = await member.query(api.notifications.getNotificationCenter, {
    organizationId,
  });
  return center.notifications
    .filter((notification) => notification.type === "task_assigned")
    .map((notification) => notification.message)
    .sort();
}

test("approving a loan suggests the recipe's steps as owned, dated tasks with their dependencies", async () => {
  const { admin, registrar, organizationId, cases } = await setup();
  await admin.mutation(api.preparationRecipes.create, {
    organizationId,
    recipe: TRANSPORT_RECIPE,
  });

  await admin.mutation(api.loans.approve, { loanId: cases.loanId });

  const registrarWork = await registrar.query(api.caseTasks.listMyWork, {
    organizationId,
    paginationOpts: FIRST_PAGE,
  });
  expect(registrarWork.page.map((task) => task.title)).toEqual([
    "Outgoing condition check",
    "Pack the objects",
  ]);
  const [check, pack] = registrarWork.page;
  expect(check).toMatchObject({
    caseType: "loan",
    caseId: cases.loanId,
    caseLabel: "L-001",
    ownerName: "rita",
    status: "todo",
    dueDate: LOAN_START - 14 * DAY,
    suggestion: {
      recipeName: "Pack, insure and arrange transport",
      trigger: "loan_approved",
    },
    requiredEvidence: { kind: "conditionAssessment", linked: false },
  });
  expect(pack?.dependsOn).toEqual([
    { _id: check?._id, title: "Outgoing condition check", status: "todo" },
  ]);

  const adminWork = await admin.query(api.caseTasks.listMyWork, {
    organizationId,
    paginationOpts: FIRST_PAGE,
  });
  expect(adminWork.page).toMatchObject([
    {
      title: "Confirm insurance cover",
      ownerName: "ada",
      dueDate: LOAN_START - 10 * DAY,
    },
  ]);
  expect(adminWork.page[0]?.requiredEvidence).toBeUndefined();
});

test("repeating the event keeps one task and one notification per recipe step", async () => {
  const { admin, registrar, organizationId, cases } = await setup();
  await admin.mutation(api.preparationRecipes.create, {
    organizationId,
    recipe: TRANSPORT_RECIPE,
  });
  await admin.mutation(api.loans.approve, { loanId: cases.loanId });

  const repeat = await registrar.mutation(api.preparationRecipes.applyToCase, {
    organizationId,
    caseType: "loan",
    caseId: cases.loanId,
  });

  expect(repeat).toEqual({ suggested: 0, existing: 3, skipped: [] });
  const view = await registrar.query(api.caseTasks.listForCase, {
    organizationId,
    caseType: "loan",
    caseId: cases.loanId,
  });
  expect(view.tasks).toHaveLength(3);
  expect(await assignmentMessages(registrar, organizationId)).toEqual([
    "You have been assigned to: Outgoing condition check",
    "You have been assigned to: Pack the objects",
  ]);
  expect(await assignmentMessages(admin, organizationId)).toEqual([
    "You have been assigned to: Confirm insurance cover",
  ]);
});

test("steps without an eligible owner are reported and suggested once the case has one", async () => {
  const { t, admin, registrar, organizationId, registrarId, cases } =
    await setup();
  const approverId = await addMember(t, organizationId, "abe", [
    "loans.read",
    "loans.approve",
  ]);
  await t.run((ctx) => ctx.db.patch(cases.loanId, { assignedTo: undefined }));
  await admin.mutation(api.preparationRecipes.create, {
    organizationId,
    recipe: TRANSPORT_RECIPE,
  });

  await authedForUser(t, approverId).mutation(api.loans.approve, {
    loanId: cases.loanId,
  });

  const caseRef = {
    organizationId,
    caseType: "loan" as const,
    caseId: cases.loanId,
  };
  const before = await registrar.query(
    api.preparationRecipes.getForCase,
    caseRef,
  );
  expect(before.recipes).toMatchObject([
    {
      name: "Pack, insure and arrange transport",
      steps: [
        { title: "Outgoing condition check", state: "no_owner" },
        { title: "Confirm insurance cover", state: "no_owner" },
        { title: "Pack the objects", state: "no_owner" },
      ],
    },
  ]);

  await registrar.mutation(api.workflows.assignLoan, {
    loanId: cases.loanId,
    userId: registrarId,
  });
  expect(
    (
      await registrar.query(api.preparationRecipes.getForCase, caseRef)
    ).recipes[0]?.steps.map((step) => step.state),
  ).toEqual(["ready", "ready", "ready"]);
  const applied = await registrar.mutation(
    api.preparationRecipes.applyToCase,
    caseRef,
  );

  expect(applied).toEqual({ suggested: 3, existing: 0, skipped: [] });
  const after = await registrar.query(
    api.preparationRecipes.getForCase,
    caseRef,
  );
  expect(after.recipes[0]?.steps.map((step) => step.state)).toEqual([
    "suggested",
    "suggested",
    "suggested",
  ]);
  const work = await registrar.query(api.caseTasks.listMyWork, {
    organizationId,
    paginationOpts: FIRST_PAGE,
  });
  expect(work.page.map((task) => task.title)).toEqual([
    "Outgoing condition check",
    "Confirm insurance cover",
    "Pack the objects",
  ]);
});

test("accepting an intake suggests catalog, photography and condition work dated from the acceptance", async () => {
  freezeClock();
  const { admin, registrar, organizationId, cases } = await setup();
  await admin.mutation(api.preparationRecipes.create, {
    organizationId,
    recipe: INTAKE_RECIPE,
  });

  await admin.mutation(api.accessions.approve, {
    accessionId: cases.accessionId,
  });

  const work = await registrar.query(api.caseTasks.listMyWork, {
    organizationId,
    paginationOpts: FIRST_PAGE,
  });
  expect(
    work.page.map(
      ({ title, caseType, caseLabel, dueDate, requiredEvidence }) => ({
        title,
        caseType,
        caseLabel,
        dueDate,
        requiredEvidence,
      }),
    ),
  ).toEqual([
    {
      title: "Complete the catalog record",
      caseType: "accession",
      caseLabel: "2026.1",
      dueDate: TODAY + 7 * DAY,
      requiredEvidence: undefined,
    },
    {
      title: "Photograph the object",
      caseType: "accession",
      caseLabel: "2026.1",
      dueDate: TODAY + 14 * DAY,
      requiredEvidence: { kind: "media", linked: false },
    },
    {
      title: "Record a condition assessment",
      caseType: "accession",
      caseLabel: "2026.1",
      dueDate: TODAY + 14 * DAY,
      requiredEvidence: { kind: "conditionAssessment", linked: false },
    },
  ]);
  expect(work.page[0]?.suggestion).toEqual({
    recipeName: "Catalog, photograph and assess condition",
    trigger: "intake_accepted",
    eventAt: TODAY + 9.5 * 60 * 60 * 1000,
  });
});

test("approving an exhibition suggests return preparation dated from its closing", async () => {
  const { admin, organizationId, cases } = await setup();
  await admin.mutation(api.preparationRecipes.create, {
    organizationId,
    recipe: RETURN_RECIPE,
  });

  await admin.mutation(api.exhibitions.approve, {
    exhibitionId: cases.exhibitionId,
  });

  const view = await admin.query(api.caseTasks.listForCase, {
    organizationId,
    caseType: "exhibition",
    caseId: cases.exhibitionId,
  });
  const [transport, check] = view.tasks;
  expect(view.tasks).toMatchObject([
    {
      title: "Book return transport",
      caseLabel: "Blue and white",
      ownerName: "ada",
      dueDate: CLOSING - 21 * DAY,
    },
    {
      title: "Condition check after deinstallation",
      dueDate: CLOSING + 2 * DAY,
      dependsOn: [{ _id: transport?._id, title: "Book return transport" }],
    },
  ]);
  expect(check?.openDependencyCount).toBe(1);
});

test("a corrected loan end date moves the return work staff have not re-dated", async () => {
  const { admin, registrar, organizationId, registrarId, cases } =
    await setup();
  await admin.mutation(api.preparationRecipes.create, {
    organizationId,
    recipe: LOAN_RETURN_RECIPE,
  });
  await admin.mutation(api.loans.approve, { loanId: cases.loanId });
  const caseRef = {
    organizationId,
    caseType: "loan" as const,
    caseId: cases.loanId,
  };
  const [, check] = (await registrar.query(api.caseTasks.listForCase, caseRef))
    .tasks;
  const agreedDate = Date.UTC(2027, 2, 20);
  await registrar.mutation(api.caseTasks.assign, {
    taskId: check?._id as Id<"caseTasks">,
    ownerId: registrarId,
    reviewerId: null,
    dueDate: agreedDate,
  });

  const extendedEnd = Date.UTC(2027, 4, 1);
  const requestId = await registrar.mutation(api.loans.requestExtension, {
    loanId: cases.loanId,
    newEndDate: extendedEnd,
    reason: "The venue extended the show",
  });
  await admin.mutation(api.loans.approveExtension, { requestId });

  const after = (await registrar.query(api.caseTasks.listForCase, caseRef))
    .tasks;
  expect(after.map(({ title, dueDate }) => ({ title, dueDate }))).toEqual([
    { title: "Confirm return transport", dueDate: extendedEnd - 14 * DAY },
    { title: "Condition check on return", dueDate: agreedDate },
  ]);
  expect(await assignmentMessages(registrar, organizationId)).toEqual([
    "You have been assigned to: Condition check on return",
    "You have been assigned to: Confirm return transport",
  ]);
});

test("correcting an approved exhibition's closing date moves its suggestions without adding any", async () => {
  const { admin, organizationId, cases } = await setup();
  await admin.mutation(api.preparationRecipes.create, {
    organizationId,
    recipe: RETURN_RECIPE,
  });
  await admin.mutation(api.exhibitions.approve, {
    exhibitionId: cases.exhibitionId,
  });

  const newClosing = Date.UTC(2027, 7, 31);
  await admin.mutation(api.exhibitions.update, {
    id: cases.exhibitionId,
    endDate: newClosing,
  });

  const view = await admin.query(api.caseTasks.listForCase, {
    organizationId,
    caseType: "exhibition",
    caseId: cases.exhibitionId,
  });
  expect(view.tasks.map(({ title, dueDate }) => ({ title, dueDate }))).toEqual([
    { title: "Book return transport", dueDate: newClosing - 21 * DAY },
    {
      title: "Condition check after deinstallation",
      dueDate: newClosing + 2 * DAY,
    },
  ]);
});

test("a dismissed suggestion stays dismissed when the event repeats and staff can restore it", async () => {
  const { admin, registrar, organizationId, cases } = await setup();
  await admin.mutation(api.preparationRecipes.create, {
    organizationId,
    recipe: TRANSPORT_RECIPE,
  });
  await admin.mutation(api.loans.approve, { loanId: cases.loanId });
  const caseRef = {
    organizationId,
    caseType: "loan" as const,
    caseId: cases.loanId,
  };
  const pack = (
    await registrar.query(api.caseTasks.listForCase, caseRef)
  ).tasks.find((task) => task.title === "Pack the objects");
  const packId = pack?._id as Id<"caseTasks">;

  await registrar.mutation(api.caseTasks.cancel, {
    taskId: packId,
    reason: "The borrower's courier packs on site",
  });
  expect(
    await registrar.mutation(api.preparationRecipes.applyToCase, caseRef),
  ).toEqual({ suggested: 0, existing: 3, skipped: [] });
  const dismissed = (
    await registrar.query(api.caseTasks.listForCase, caseRef)
  ).tasks.find((task) => task._id === packId);
  expect(dismissed).toMatchObject({
    status: "cancelled",
    cancelReason: "The borrower's courier packs on site",
  });

  await registrar.mutation(api.caseTasks.restoreSuggestion, {
    taskId: packId,
  });

  const work = await registrar.query(api.caseTasks.listMyWork, {
    organizationId,
    paginationOpts: FIRST_PAGE,
  });
  const restored = work.page.find((task) => task._id === packId);
  expect(restored?.status).toBe("todo");
  expect(restored?.cancelReason).toBeUndefined();
});

test("only suggested tasks can be restored", async () => {
  const { registrar, organizationId, registrarId, cases } = await setup();
  const taskId = await registrar.mutation(api.caseTasks.create, {
    organizationId,
    caseType: "loan",
    caseId: cases.loanId,
    title: "Hand-made task",
    ownerId: registrarId,
  });
  await registrar.mutation(api.caseTasks.cancel, {
    taskId,
    reason: "Not needed",
  });

  expect(
    await workErrorCodeOf(
      registrar.mutation(api.caseTasks.restoreSuggestion, { taskId }),
    ),
  ).toBe("INVALID_INPUT");
});

test("cancelling an approved loan withdraws untouched suggestions and keeps started work", async () => {
  const { admin, registrar, organizationId, cases } = await setup();
  await admin.mutation(api.preparationRecipes.create, {
    organizationId,
    recipe: TRANSPORT_RECIPE,
  });
  await admin.mutation(api.loans.approve, { loanId: cases.loanId });
  const caseRef = {
    organizationId,
    caseType: "loan" as const,
    caseId: cases.loanId,
  };
  const [check] = (await registrar.query(api.caseTasks.listForCase, caseRef))
    .tasks;
  await registrar.mutation(api.caseTasks.start, {
    taskId: check?._id as Id<"caseTasks">,
  });

  await admin.mutation(api.loans.cancel, { loanId: cases.loanId });

  const tasks = (await registrar.query(api.caseTasks.listForCase, caseRef))
    .tasks;
  expect(
    tasks.map(({ title, status, suggestion }) => ({
      title,
      status,
      withdrawnReason: suggestion?.withdrawnReason,
    })),
  ).toEqual([
    {
      title: "Outgoing condition check",
      status: "in_progress",
      withdrawnReason: undefined,
    },
    {
      title: "Confirm insurance cover",
      status: "cancelled",
      withdrawnReason: "loan_cancelled",
    },
    {
      title: "Pack the objects",
      status: "cancelled",
      withdrawnReason: "loan_cancelled",
    },
  ]);
  const adminWork = await admin.query(api.caseTasks.listMyWork, {
    organizationId,
    paginationOpts: FIRST_PAGE,
  });
  expect(adminWork.page).toEqual([]);
  expect(
    await workErrorCodeOf(
      registrar.mutation(api.preparationRecipes.applyToCase, caseRef),
    ),
  ).toBe("CASE_NOT_ACCEPTED");
});

test("a step that names evidence completes only once it is linked, and finishing the work records nothing on the case", async () => {
  const { t, admin, registrar, organizationId, adminId, cases } = await setup();
  await admin.mutation(api.preparationRecipes.create, {
    organizationId,
    recipe: TRANSPORT_RECIPE,
  });
  await admin.mutation(api.loans.approve, { loanId: cases.loanId });
  const caseRef = {
    organizationId,
    caseType: "loan" as const,
    caseId: cases.loanId,
  };
  const { assessmentId, mediaId } = await t.run(async (ctx) => ({
    assessmentId: await ctx.db.insert("conditionAssessments", {
      organizationId,
      collectionId: cases.objectId,
      assessedBy: adminId,
      assessedAt: 10,
      recordedAt: 10,
      condition: "good",
      summary: "Stable for travel",
      observations: [],
      photos: [],
      status: "accepted",
      acceptedBy: adminId,
      acceptedAt: 10,
    }),
    mediaId: await ctx.db.insert("mediaFiles", {
      collectionId: cases.objectId,
      organizationId,
      storageId: await ctx.storage.store(new Blob(["crate"])),
      fileName: "crate.png",
      fileType: "image",
      fileSize: 5,
      mimeType: "image/png",
      isPrimary: false,
      uploadedBy: adminId,
      uploadedAt: 11,
      uploadStatus: "completed",
    }),
  }));
  const [check, insurance, pack] = (
    await registrar.query(api.caseTasks.listForCase, caseRef)
  ).tasks.map((task) => task._id);
  const checkId = check as Id<"caseTasks">;
  const packId = pack as Id<"caseTasks">;

  expect(
    await workErrorCodeOf(
      registrar.mutation(api.caseTasks.complete, { taskId: checkId }),
    ),
  ).toBe("EVIDENCE_REQUIRED");
  await registrar.mutation(api.caseTasks.linkEvidence, {
    taskId: checkId,
    reference: { kind: "media", id: mediaId },
  });
  expect(
    await workErrorCodeOf(
      registrar.mutation(api.caseTasks.complete, { taskId: checkId }),
    ),
  ).toBe("EVIDENCE_REQUIRED");
  await registrar.mutation(api.caseTasks.linkEvidence, {
    taskId: checkId,
    reference: { kind: "conditionAssessment", id: assessmentId },
  });
  await registrar.mutation(api.caseTasks.complete, { taskId: checkId });
  await admin.mutation(api.caseTasks.complete, {
    taskId: insurance as Id<"caseTasks">,
  });
  await registrar.mutation(api.caseTasks.assign, {
    taskId: packId,
    ownerId: (await registrar.query(api.caseTasks.listForCase, caseRef))
      .tasks[2]?.ownerId as Id<"users">,
    reviewerId: adminId,
    dueDate: null,
  });
  expect(
    await workErrorCodeOf(
      registrar.mutation(api.caseTasks.submitForReview, { taskId: packId }),
    ),
  ).toBe("EVIDENCE_REQUIRED");
  await registrar.mutation(api.caseTasks.linkEvidence, {
    taskId: packId,
    reference: { kind: "media", id: mediaId },
  });
  await registrar.mutation(api.caseTasks.submitForReview, { taskId: packId });
  await admin.mutation(api.caseTasks.approve, { taskId: packId });

  const tasks = (await registrar.query(api.caseTasks.listForCase, caseRef))
    .tasks;
  expect(tasks.map((task) => task.status)).toEqual(["done", "done", "done"]);
  expect(tasks[0]?.requiredEvidence).toEqual({
    kind: "conditionAssessment",
    linked: true,
  });
  const state = await t.run(async (ctx) => ({
    loan: await ctx.db.get(cases.loanId),
    items: await ctx.db
      .query("loanItems")
      .withIndex("by_loan", (q) => q.eq("loanId", cases.loanId))
      .collect(),
    object: await ctx.db.get(cases.objectId),
    assessments: await ctx.db
      .query("conditionAssessments")
      .withIndex("by_collection_and_status_and_acceptedAt", (q) =>
        q.eq("collectionId", cases.objectId),
      )
      .collect(),
  }));
  expect(state.loan?.status).toBe("active");
  expect(state.items.map((item) => item.custodyStatus)).toEqual(["pending"]);
  expect(state.object?.currentLocationId).toBe(cases.storageId);
  expect(state.assessments.map((row) => row._id)).toEqual([assessmentId]);
});

test("administrators edit, pause, resume and archive recipes without reusing step keys", async () => {
  const { admin, registrar, organizationId, cases } = await setup();
  const recipeId = await admin.mutation(api.preparationRecipes.create, {
    organizationId,
    recipe: TRANSPORT_RECIPE,
  });
  const [created] = await admin.query(api.preparationRecipes.list, {
    organizationId,
  });
  expect(created).toMatchObject({
    _id: recipeId,
    status: "active",
    trigger: "loan_approved",
    loanDirection: "outgoing",
    steps: [
      { key: "s1", dependsOn: [] },
      { key: "s2", dependsOn: [] },
      { key: "s3", title: "Pack the objects", dependsOn: ["s1"] },
    ],
  });

  await admin.mutation(api.preparationRecipes.update, {
    recipeId,
    recipe: {
      name: "Outgoing loan preparation",
      steps: [
        { ...TRANSPORT_RECIPE.steps[0], key: "s1", dependsOn: [] },
        { ...TRANSPORT_RECIPE.steps[2], key: "s3", dependsOn: [0] },
        {
          title: "Book transport",
          owner: { kind: "caseAssignee" },
          due: { anchor: "start", offsetDays: -7 },
          dependsOn: [1],
        },
      ],
    },
  });
  await admin.mutation(api.preparationRecipes.setStatus, {
    recipeId,
    status: "paused",
  });
  await admin.mutation(api.loans.approve, { loanId: cases.loanId });
  const caseRef = {
    organizationId,
    caseType: "loan" as const,
    caseId: cases.loanId,
  };
  expect(
    (await registrar.query(api.caseTasks.listForCase, caseRef)).tasks,
  ).toEqual([]);

  await admin.mutation(api.preparationRecipes.setStatus, {
    recipeId,
    status: "active",
  });
  await registrar.mutation(api.preparationRecipes.applyToCase, caseRef);
  const tasks = (await registrar.query(api.caseTasks.listForCase, caseRef))
    .tasks;
  expect(tasks.map((task) => task.title)).toEqual([
    "Outgoing condition check",
    "Pack the objects",
    "Book transport",
  ]);
  expect(tasks[2]?.dependsOn.map((task) => task.title)).toEqual([
    "Pack the objects",
  ]);
  expect(tasks[0]?.suggestion?.recipeName).toBe("Outgoing loan preparation");
  const [edited] = await admin.query(api.preparationRecipes.list, {
    organizationId,
  });
  expect(edited?.steps.map((step) => step.key)).toEqual(["s1", "s3", "s4"]);

  await admin.mutation(api.preparationRecipes.setStatus, {
    recipeId,
    status: "archived",
  });
  expect(
    (await registrar.query(api.preparationRecipes.getForCase, caseRef)).recipes,
  ).toEqual([]);
  expect(
    (await registrar.query(api.caseTasks.listForCase, caseRef)).tasks,
  ).toHaveLength(3);
});

test("an outgoing loan recipe does not follow an incoming loan", async () => {
  const { t, admin, registrar, organizationId, cases } = await setup();
  await admin.mutation(api.preparationRecipes.create, {
    organizationId,
    recipe: TRANSPORT_RECIPE,
  });
  await t.run((ctx) => ctx.db.patch(cases.loanId, { type: "incoming" }));

  await admin.mutation(api.loans.approve, { loanId: cases.loanId });

  const view = await registrar.query(api.preparationRecipes.getForCase, {
    organizationId,
    caseType: "loan",
    caseId: cases.loanId,
  });
  expect(view.recipes).toEqual([]);
});

test("recipe settings need the settings permission and a valid recipe", async () => {
  const { t, admin, registrar, organizationId, viewerId } = await setup();
  expect(
    await capabilityFailureOf(
      registrar.mutation(api.preparationRecipes.create, {
        organizationId,
        recipe: TRANSPORT_RECIPE,
      }),
    ),
  ).toMatchObject({ reason: "permission_missing" });
  expect(
    await capabilityFailureOf(
      registrar.query(api.preparationRecipes.list, { organizationId }),
    ),
  ).toMatchObject({ reason: "permission_missing" });

  const step = TRANSPORT_RECIPE.steps[1];
  const invalid = async (
    recipe: Partial<typeof TRANSPORT_RECIPE> & Record<string, unknown>,
  ) => {
    try {
      await admin.mutation(api.preparationRecipes.create, {
        organizationId,
        recipe: { ...TRANSPORT_RECIPE, ...recipe } as typeof TRANSPORT_RECIPE,
      });
    } catch (error) {
      const data = workErrorFromError(error);
      return (
        data && { code: data.code, field: data.field, step: data.stepIndex }
      );
    }
    throw new Error("Expected the recipe to be refused");
  };
  expect(await invalid({ name: "  " })).toEqual({
    code: "RECIPE_INVALID",
    field: "name",
    step: undefined,
  });
  expect(await invalid({ steps: [] })).toMatchObject({ field: "steps" });
  expect(
    await invalid({ steps: Array.from({ length: 11 }, () => step) } as never),
  ).toMatchObject({ field: "steps" });
  expect(
    await invalid({
      steps: [{ ...step, title: " " }],
    } as never),
  ).toEqual({ code: "RECIPE_INVALID", field: "title", step: 0 });
  expect(
    await invalid({
      steps: [step, { ...step, dependsOn: [1] }],
    } as never),
  ).toEqual({ code: "RECIPE_INVALID", field: "dependsOn", step: 1 });
  expect(
    await invalid({
      steps: [{ ...step, due: { anchor: "start", offsetDays: 400 } }],
    } as never),
  ).toMatchObject({ field: "due", step: 0 });
  expect(
    await invalid({
      steps: [{ ...step, owner: { kind: "member", userId: viewerId } }],
    } as never),
  ).toMatchObject({ field: "owner", step: 0 });
  expect(
    await invalid({
      trigger: "intake_accepted",
      loanDirection: undefined,
      steps: [step],
    } as never),
  ).toMatchObject({ field: "due", step: 0 });
  expect(
    await invalid({ trigger: "exhibition_approved" } as never),
  ).toMatchObject({ field: "loanDirection" });

  await t.run((ctx) =>
    ctx.db.patch(organizationId, { subscriptionTier: "free" }),
  );
  expect(
    await capabilityFailureOf(
      admin.mutation(api.preparationRecipes.create, {
        organizationId,
        recipe: TRANSPORT_RECIPE,
      }),
    ),
  ).toMatchObject({ reason: "tier_required" });
  expect(
    await admin.mutation(api.preparationRecipes.create, {
      organizationId,
      recipe: INTAKE_RECIPE,
    }),
  ).toBeTruthy();
});

test("only the final step of an approval workflow suggests the recipe", async () => {
  const { t, admin, registrar, organizationId, adminId, cases } = await setup();
  await admin.mutation(api.preparationRecipes.create, {
    organizationId,
    recipe: TRANSPORT_RECIPE,
  });
  await t.run(async (ctx) => {
    const membership = await ctx.db
      .query("userOrganizations")
      .withIndex("by_user_and_organization", (q) =>
        q.eq("userId", adminId).eq("organizationId", organizationId),
      )
      .unique();
    const roleId = membership?.roleId as Id<"roles">;
    await ctx.db.insert("workflowConfigs", {
      organizationId,
      workflowType: "loan",
      steps: [
        { stepNumber: 1, roleId, name: "Registrar review" },
        { stepNumber: 2, roleId, name: "Director approval" },
      ],
      canInitiateRoles: [roleId],
    });
    await ctx.db.patch(cases.loanId, { workflowStep: 1 });
  });
  const caseRef = {
    organizationId,
    caseType: "loan" as const,
    caseId: cases.loanId,
  };

  await admin.mutation(api.loans.approve, { loanId: cases.loanId });
  expect(
    (await registrar.query(api.caseTasks.listForCase, caseRef)).tasks,
  ).toEqual([]);

  await admin.mutation(api.loans.approve, { loanId: cases.loanId });
  expect(
    (await registrar.query(api.caseTasks.listForCase, caseRef)).tasks,
  ).toHaveLength(3);
});

test("bulk approval suggests each approved loan's recipe once", async () => {
  const { t, admin, registrar, organizationId, registrarId, cases } =
    await setup();
  await admin.mutation(api.preparationRecipes.create, {
    organizationId,
    recipe: TRANSPORT_RECIPE,
  });
  const secondLoanId = await t.run((ctx) =>
    ctx.db.insert("loans", {
      organizationId,
      loanNumber: "L-002",
      type: "outgoing",
      lenderBorrowerName: "Second Venue",
      startDate: LOAN_START,
      status: "pending",
      assignedTo: registrarId,
    }),
  );

  await admin.mutation(api.loans.bulkApprove, {
    loanIds: [cases.loanId, secondLoanId],
  });
  await admin.mutation(api.loans.bulkApprove, {
    loanIds: [cases.loanId, secondLoanId],
  });

  for (const caseId of [cases.loanId, secondLoanId]) {
    const view = await registrar.query(api.caseTasks.listForCase, {
      organizationId,
      caseType: "loan",
      caseId,
    });
    expect(view.tasks).toHaveLength(3);
  }
});

test("staff who only read a case see its preparation but cannot apply or restore it, and other organizations see nothing", async () => {
  const { t, admin, registrar, viewer, organizationId, cases } = await setup();
  await admin.mutation(api.preparationRecipes.create, {
    organizationId,
    recipe: TRANSPORT_RECIPE,
  });
  await admin.mutation(api.loans.approve, { loanId: cases.loanId });
  const caseRef = {
    organizationId,
    caseType: "loan" as const,
    caseId: cases.loanId,
  };
  const [check] = (await registrar.query(api.caseTasks.listForCase, caseRef))
    .tasks;
  const checkId = check?._id as Id<"caseTasks">;
  await registrar.mutation(api.caseTasks.cancel, {
    taskId: checkId,
    reason: "Checked last week",
  });

  const readOnly = await viewer.query(
    api.preparationRecipes.getForCase,
    caseRef,
  );
  expect(readOnly.canApply).toBe(false);
  expect(readOnly.recipes[0]?.steps.map((step) => step.state)).toEqual([
    "suggested",
    "suggested",
    "suggested",
  ]);
  expect(
    await capabilityFailureOf(
      viewer.mutation(api.preparationRecipes.applyToCase, caseRef),
    ),
  ).toMatchObject({ reason: "permission_missing" });
  expect(
    await capabilityFailureOf(
      viewer.mutation(api.caseTasks.restoreSuggestion, { taskId: checkId }),
    ),
  ).toMatchObject({ reason: "permission_missing" });

  const foreignOrganizationId = await t.run((ctx) =>
    ctx.db.insert("organizations", {
      name: "Other Museum",
      slug: "other-museum",
      type: "museum",
      subscriptionTier: "enterprise",
    }),
  );
  const foreign = authedForUser(
    t,
    await addMember(t, foreignOrganizationId, "fiona", STAFF_PERMISSIONS),
  );
  await expect(
    foreign.query(api.preparationRecipes.getForCase, caseRef),
  ).rejects.toThrow("Permission denied");
  expect(
    await workErrorCodeOf(
      foreign.mutation(api.preparationRecipes.applyToCase, {
        ...caseRef,
        organizationId: foreignOrganizationId,
      }),
    ),
  ).toBe("CASE_NOT_FOUND");
  expect(
    await workErrorCodeOf(
      foreign.mutation(api.caseTasks.restoreSuggestion, { taskId: checkId }),
    ),
  ).toBe("TASK_NOT_FOUND");
  await expect(
    t.query(api.preparationRecipes.getForCase, caseRef),
  ).rejects.toThrow("Not authenticated");
});

test("purging an organization removes its recipes", async () => {
  const t = createConvexTest();
  // Museum evidence is permanent; only a library without it can be purged.
  const organizationId = await t.run((ctx) =>
    ctx.db.insert("organizations", {
      name: "Closing Library",
      slug: "closing-library",
      type: "library",
      subscriptionTier: "enterprise",
    }),
  );
  const adminId = await addMember(t, organizationId, "ada", ADMIN_PERMISSIONS);
  // Inserted directly: the audit entry of a configured recipe would protect
  // the organization from purge.
  await t.run((ctx) =>
    ctx.db.insert("preparationRecipes", {
      organizationId,
      name: "Catalog new items",
      trigger: "intake_accepted",
      status: "active",
      steps: [
        {
          key: "s1",
          title: "Catalog the item",
          owner: { kind: "approver" },
          dependsOn: [],
        },
      ],
      nextStepNumber: 2,
      createdBy: adminId,
      createdAt: 1,
      updatedBy: adminId,
      updatedAt: 1,
    }),
  );

  await t.mutation(internal.organizationCleanup.purgeOrganizationsInternal, {
    organizationIds: [organizationId],
    dryRun: false,
  });

  expect(
    await t.run((ctx) =>
      ctx.db
        .query("preparationRecipes")
        .withIndex("by_organizationId", (q) =>
          q.eq("organizationId", organizationId),
        )
        .take(1),
    ),
  ).toEqual([]);
});

test("owners who chose instant email get one email per suggested step, however often the event repeats", async () => {
  vi.stubEnv("RESEND_API_KEY", "re_fixture_key");
  vi.stubEnv("RESEND_SENDER_EMAIL_AUTH", "notify@museum.example.test");
  const fetchMock = vi.fn(async () =>
    Response.json({ id: "email-fixture" }, { status: 200 }),
  );
  vi.stubGlobal("fetch", fetchMock);
  vi.useFakeTimers();
  const { t, admin, registrar, organizationId, cases } = await setup();
  await registrar.mutation(api.notifications.updatePreferences, {
    organizationId,
    categories: emailChoices(["assignments"]),
  });
  await admin.mutation(api.preparationRecipes.create, {
    organizationId,
    recipe: TRANSPORT_RECIPE,
  });
  const drain = () =>
    t.finishAllScheduledFunctions(() => {
      vi.runAllTimers();
    });

  await admin.mutation(api.loans.approve, { loanId: cases.loanId });
  await drain();
  await registrar.mutation(api.preparationRecipes.applyToCase, {
    organizationId,
    caseType: "loan",
    caseId: cases.loanId,
  });
  await drain();

  const emails = (fetchMock.mock.calls as unknown as [string, RequestInit][])
    .map(
      ([, init]) =>
        JSON.parse(String(init.body)) as { to: string[]; text: string },
    )
    .filter((email) => email.to.includes("rita@example.test"));
  expect(emails).toHaveLength(2);
  expect(emails.map((email) => email.text).join("\n")).toContain(
    "Assigned by: Pack, insure and arrange transport",
  );
  expect(
    emails.filter((email) => email.text.includes("Outgoing condition check")),
  ).toHaveLength(1);
  expect(
    emails.filter((email) => email.text.includes("Pack the objects")),
  ).toHaveLength(1);
});
