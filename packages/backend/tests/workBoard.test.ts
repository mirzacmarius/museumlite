import { describe, expect, test } from "vitest";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import type { ApprovalCaseType as ApprovalType } from "../convex/utils/caseTypes";
import { PENDING_IMAGE_DELETION_LIMIT } from "../convex/utils/imageDeletion";
import { MAX_SCANNED_ROWS } from "../convex/utils/workBoardColumns";
import { workErrorFromError } from "../convex/utils/workErrors";
import { workflowApprovalErrorFromError } from "../convex/utils/workflowApprovalErrors";
import {
  authedForUser,
  type ConvexTest,
  capabilityFailureOf,
  createConvexTest,
  createOrgUserCollectionWithPermissions,
  type SubscriptionTier,
} from "./testHarness";
import { workColumn } from "./workBoardHarness";

const NOW = Date.UTC(2026, 9, 18, 12);
const DAY = 24 * 60 * 60 * 1000;

const REGISTRAR = [
  "collections.read",
  "collections.update",
  "loans.read",
  "loans.update",
];

type Member = ReturnType<typeof authedForUser>;

function permissionCategory(permission: string) {
  const [category] = permission.split(".");
  return category === "loans" ||
    category === "locations" ||
    category === "media" ||
    category === "organization"
    ? category
    : "collections";
}

async function createMuseum(subscriptionTier: SubscriptionTier = "enterprise") {
  const t = createConvexTest();
  const organizationId = await t.run((ctx) =>
    ctx.db.insert("organizations", {
      name: "Home Museum",
      slug: "home-museum",
      type: "museum",
      subscriptionTier,
    }),
  );

  /** A member whose role holds exactly these permissions. */
  async function member(name: string, permissions: readonly string[]) {
    const userId = await t.run(async (ctx) => {
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
        const existing = (await ctx.db.query("permissions").collect()).find(
          (row) => row.name === permission,
        );
        const permissionId =
          existing?._id ??
          (await ctx.db.insert("permissions", {
            name: permission,
            category: permissionCategory(permission),
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
    return { userId, client: authedForUser(t, userId) };
  }

  /** Each column the member sees, in order, with the count the board shows. */
  async function board(
    client: Member,
    limits?: Parameters<typeof workColumn>[3],
  ) {
    const columns = await client.query(api.workBoard.get, {
      organizationId,
      now: NOW,
      limits,
    });
    return columns.map(
      (column) =>
        `${column.key} ${column.cards.length}${column.hasMore ? "+" : ""}`,
    );
  }

  const cases = await t.run(async (ctx) => {
    const accessionId = await ctx.db.insert("accessions", {
      organizationId,
      accessionNumber: "A-001",
      dateReceived: NOW - DAY,
      source: "Donor",
      method: "gift",
      status: "approved",
    });
    const loanId = await ctx.db.insert("loans", {
      organizationId,
      loanNumber: "L-001",
      type: "outgoing",
      lenderBorrowerName: "Partner Museum",
      startDate: NOW - DAY,
      status: "active",
    });
    return { accessionId, loanId };
  });

  return { t, organizationId, cases, member, board };
}

type Museum = Awaited<ReturnType<typeof createMuseum>>;

/** Creates tasks the owner holds on one case, due one day apart. */
async function giveTasks(
  museum: Museum,
  creator: Member,
  ownerId: Id<"users">,
  count: number,
  on: { caseType: "accession" | "loan"; firstDue: number },
) {
  const taskIds: Id<"caseTasks">[] = [];
  for (let index = 0; index < count; index++) {
    taskIds.push(
      await creator.mutation(api.caseTasks.create, {
        organizationId: museum.organizationId,
        caseType: on.caseType,
        caseId:
          on.caseType === "loan"
            ? museum.cases.loanId
            : museum.cases.accessionId,
        title: `${on.caseType} task ${index + 1}`,
        ownerId,
        dueDate: on.firstDue + index * DAY,
      }),
    );
  }
  return taskIds;
}

async function workErrorCodeOf(call: Promise<unknown>) {
  try {
    await call;
  } catch (error) {
    return workErrorFromError(error)?.code;
  }
  throw new Error("Expected the call to be rejected");
}

test("a member who reads the collection sees their tasks, approvals, reviews and assigned cases, all empty", async () => {
  const museum = await createMuseum();
  const viewer = await museum.member("Vera Viewer", ["collections.read"]);

  expect(await museum.board(viewer.client)).toEqual([
    "tasks 0",
    "approvals 0",
    "reviews 0",
    "assigned 0",
  ]);
});

test("a registrar sees their first 20 open tasks soonest due first, and that more are waiting", async () => {
  const museum = await createMuseum();
  const registrar = await museum.member("Rita Registrar", REGISTRAR);
  await giveTasks(museum, registrar.client, registrar.userId, 21, {
    caseType: "accession",
    firstDue: NOW,
  });

  expect(await museum.board(registrar.client)).toEqual([
    "tasks 20+",
    "approvals 0",
    "reviews 0",
    "assigned 0",
  ]);
  const tasks = await workColumn(
    registrar.client,
    museum.organizationId,
    "tasks",
  );
  expect(tasks?.cards.slice(0, 2)).toMatchObject([
    { title: "accession task 1", caseLabel: "A-001", viewerCanWork: true },
    { title: "accession task 2" },
  ]);
});

test("loading more shows the rest of a column and no more after it", async () => {
  const museum = await createMuseum();
  const registrar = await museum.member("Rita Registrar", REGISTRAR);
  await giveTasks(museum, registrar.client, registrar.userId, 21, {
    caseType: "accession",
    firstDue: NOW,
  });

  expect(await museum.board(registrar.client, { tasks: 40 })).toEqual([
    "tasks 21",
    "approvals 0",
    "reviews 0",
    "assigned 0",
  ]);
  for (const tasks of [0, 101, 1.5])
    expect(
      await workErrorCodeOf(museum.board(registrar.client, { tasks })),
    ).toBe("INVALID_INPUT");
});

test("tasks on cases the plan no longer opens are skipped without leaving the column short", async () => {
  const museum = await createMuseum();
  const registrar = await museum.member("Rita Registrar", REGISTRAR);
  await giveTasks(museum, registrar.client, registrar.userId, 3, {
    caseType: "loan",
    firstDue: NOW,
  });
  await giveTasks(museum, registrar.client, registrar.userId, 20, {
    caseType: "accession",
    firstDue: NOW + DAY,
  });
  await museum.t.run((ctx) =>
    ctx.db.patch(museum.organizationId, { subscriptionTier: "free" }),
  );

  const tasks = await workColumn(
    registrar.client,
    museum.organizationId,
    "tasks",
  );
  expect(tasks?.hasMore).toBe(false);
  expect(tasks?.cards.map((task) => task.caseType)).toEqual(
    Array(20).fill("accession"),
  );
});

test("a column stops looking after rows it cannot show and says more may be waiting", async () => {
  const museum = await createMuseum("free");
  const registrar = await museum.member("Rita Registrar", REGISTRAR);
  await museum.t.run(async (ctx) => {
    // Loans are not on the free plan, so none of these tasks can show.
    for (let index = 0; index < MAX_SCANNED_ROWS; index++) {
      await ctx.db.insert("caseTasks", {
        organizationId: museum.organizationId,
        caseType: "loan",
        caseId: museum.cases.loanId,
        title: `Loan task ${index}`,
        ownerId: registrar.userId,
        queueDueAt: NOW + index,
        status: "todo",
        open: true,
        dependsOnTaskIds: [],
        createdBy: registrar.userId,
        createdAt: NOW,
        updatedAt: NOW,
      });
    }
  });
  await giveTasks(museum, registrar.client, registrar.userId, 1, {
    caseType: "accession",
    firstDue: NOW + MAX_SCANNED_ROWS,
  });

  const tasks = await workColumn(
    registrar.client,
    museum.organizationId,
    "tasks",
  );
  expect(tasks?.cards).toEqual([]);
  expect(tasks?.hasMore).toBe(true);
});

test("a reviewer sees tasks waiting for their review, and the owner does not", async () => {
  const museum = await createMuseum();
  const registrar = await museum.member("Rita Registrar", REGISTRAR);
  const reviewer = await museum.member("Victor Reviewer", REGISTRAR);
  const taskId = await registrar.client.mutation(api.caseTasks.create, {
    organizationId: museum.organizationId,
    caseType: "loan",
    caseId: museum.cases.loanId,
    title: "Check insurance certificate",
    ownerId: registrar.userId,
    reviewerId: reviewer.userId,
  });
  await registrar.client.mutation(api.caseTasks.submitForReview, { taskId });

  expect(await museum.board(reviewer.client)).toEqual([
    "tasks 0",
    "approvals 0",
    "reviews 1",
    "assigned 0",
  ]);
  expect(
    (await workColumn(reviewer.client, museum.organizationId, "reviews"))
      ?.cards,
  ).toMatchObject([
    {
      _id: taskId,
      caseLabel: "L-001",
      ownerName: "Rita Registrar",
      viewerIsReviewer: true,
    },
  ]);
  expect(await museum.board(registrar.client)).toEqual([
    "tasks 1",
    "approvals 0",
    "reviews 0",
    "assigned 0",
  ]);
});

test("only members who accept condition assessments see the ones waiting, newest first", async () => {
  const museum = await createMuseum();
  const conservator = await museum.member("Cora Conservator", [
    "collections.read",
    "collections.accept_condition",
  ]);
  const cataloger = await museum.member("Cato Cataloger", [
    "collections.read",
    "collections.update",
  ]);
  await museum.t.run(async (ctx) => {
    for (const [index, title] of ["Vase", "Bowl"].entries()) {
      const collectionId = await ctx.db.insert("collections", {
        organizationId: museum.organizationId,
        accessionNumber: `C-${index}`,
        title,
        status: "active",
        catalogedBy: cataloger.userId,
        catalogedAt: 1,
      });
      await ctx.db.insert("conditionAssessments", {
        organizationId: museum.organizationId,
        collectionId,
        assessedBy: cataloger.userId,
        assessedAt: NOW,
        recordedAt: NOW,
        condition: "fair",
        summary: "Hairline crack",
        observations: [],
        photos: [],
        status: "submitted",
        statusChangedAt: NOW + index,
      });
    }
  });

  expect(await museum.board(conservator.client)).toEqual([
    "tasks 0",
    "approvals 0",
    "conditionApprovals 2",
    "reviews 0",
    "assigned 0",
  ]);
  expect(
    (
      await workColumn(
        conservator.client,
        museum.organizationId,
        "conditionApprovals",
      )
    )?.cards.map((card) => [card.objectTitle, card.assessorName]),
  ).toEqual([
    ["Bowl", "Cato Cataloger"],
    ["Vase", "Cato Cataloger"],
  ]);
  expect(await museum.board(cataloger.client)).toEqual([
    "tasks 0",
    "approvals 0",
    "reviews 0",
    "assigned 0",
  ]);
});

test("only members who decide transfers see the transfers waiting on the organization", async () => {
  const museum = await createMuseum();
  const director = await museum.member("Dana Director", [
    "collections.read",
    "organization.manage_settings",
  ]);
  const registrar = await museum.member("Rita Registrar", REGISTRAR);
  await museum.t.run(async (ctx) => {
    const otherId = await ctx.db.insert("organizations", {
      name: "Other Museum",
      slug: "other-museum",
      type: "museum",
    });
    const collectionId = await ctx.db.insert("collections", {
      organizationId: museum.organizationId,
      accessionNumber: "T-1",
      title: "Clock",
      status: "active",
      catalogedBy: registrar.userId,
      catalogedAt: 1,
    });
    await ctx.db.insert("organizationMoveRequests", {
      collectionId,
      sourceOrganizationId: museum.organizationId,
      targetOrganizationId: otherId,
      requestedBy: registrar.userId,
      requestedAt: NOW,
      reason: "Transfer",
      accessionMode: "keep",
      sourceAccessionNumber: "T-1",
      status: "pending_source_approval",
    });
  });

  expect(await museum.board(director.client)).toEqual([
    "tasks 0",
    "approvals 0",
    "transfers 1",
    "reviews 0",
    "assigned 0",
  ]);
  expect(
    (await workColumn(director.client, museum.organizationId, "transfers"))
      ?.cards,
  ).toMatchObject([
    {
      collectionTitle: "Clock",
      sourceAccessionNumber: "T-1",
      direction: "outgoing",
    },
  ]);
  expect(await museum.board(registrar.client)).toEqual([
    "tasks 0",
    "approvals 0",
    "reviews 0",
    "assigned 0",
  ]);
});

test("provenance reviewers see unreviewed and disputed claims together, newest first, and other staff see no column", async () => {
  const museum = await createMuseum();
  const reviewer = await museum.member("Pia Provenance", [
    "collections.read",
    "collections.update",
    "collections.review_provenance",
  ]);
  const researcher = await museum.member("Rex Researcher", [
    "collections.read",
    "collections.update",
  ]);
  const objectId = await museum.t.run((ctx) =>
    ctx.db.insert("collections", {
      organizationId: museum.organizationId,
      accessionNumber: "P-1",
      title: "Portrait of a lady",
      status: "active",
      catalogedBy: reviewer.userId,
      catalogedAt: 1,
    }),
  );
  const claim = {
    objectId,
    role: "owner" as const,
    partyKind: "named" as const,
    partyText: "Paul Rosenberg",
    confidence: "probable" as const,
    evidence: [],
  };
  const oldestId = await reviewer.client.mutation(api.provenance.recordClaim, {
    ...claim,
    statement: "Private collection, Vienna, 1920.",
  });
  const disputedId = await reviewer.client.mutation(
    api.provenance.recordClaim,
    { ...claim, statement: "Paul Rosenberg, Paris, by 1935." },
  );
  await reviewer.client.mutation(api.provenance.reviewClaim, {
    claimId: disputedId,
    decision: "disputed",
    note: "Conflicts with the dealer's records",
  });
  const newestId = await reviewer.client.mutation(api.provenance.recordClaim, {
    ...claim,
    statement: "Galerie Wildenstein, 1936.",
  });

  expect(await museum.board(reviewer.client)).toEqual([
    "tasks 0",
    "approvals 0",
    "reviews 0",
    "assigned 0",
    "provenance 3",
  ]);
  const firstTwo = await workColumn(
    reviewer.client,
    museum.organizationId,
    "provenance",
    { provenance: 2 },
  );
  expect(firstTwo?.cards.map((card) => [card.claimId, card.disputed])).toEqual([
    [newestId, false],
    [disputedId, true],
  ]);
  expect(firstTwo?.hasMore).toBe(true);
  expect(
    (
      await workColumn(reviewer.client, museum.organizationId, "provenance")
    )?.cards.map((card) => card.claimId),
  ).toEqual([newestId, disputedId, oldestId]);
  expect(await museum.board(researcher.client)).toEqual([
    "tasks 0",
    "approvals 0",
    "reviews 0",
    "assigned 0",
  ]);
});

test("cases assigned to the viewer count in their own column, oldest first", async () => {
  const museum = await createMuseum();
  const registrar = await museum.member("Rita Registrar", REGISTRAR);
  await museum.t.run(async (ctx) => {
    await ctx.db.patch(museum.cases.loanId, { assignedTo: registrar.userId });
    await ctx.db.insert("accessions", {
      organizationId: museum.organizationId,
      accessionNumber: "A-002",
      dateReceived: NOW - 2 * DAY,
      source: "Donor",
      method: "gift",
      status: "pending",
      assignedTo: registrar.userId,
    });
  });

  expect(
    (
      await workColumn(registrar.client, museum.organizationId, "assigned")
    )?.cards.map((card) => [card.caseType, card.caseLabel]),
  ).toEqual([
    ["accession", "A-002"],
    ["loan", "L-001"],
  ]);
});

test("only members of the organization may read its board", async () => {
  const museum = await createMuseum();
  const outsiderId = await museum.t.run((ctx) =>
    ctx.db.insert("users", { name: "Olly Outsider" }),
  );

  await expect(
    museum.board(authedForUser(museum.t, outsiderId)),
  ).rejects.toThrow("not a member");
  await expect(
    museum.t.query(api.workBoard.get, {
      organizationId: museum.organizationId,
      now: NOW,
    }),
  ).rejects.toThrow("Not authenticated");
});

const NO_APPROVALS = {
  accession: 0,
  deaccession: 0,
  loan: 0,
  exhibition: 0,
  conservation: 0,
  imageDeletion: 0,
};

interface PendingRecordSetup {
  organizationId: Id<"organizations">;
  userId: Id<"users">;
  roleId: Id<"roles">;
  collectionId: Id<"collections">;
}

async function insertPendingRecord(
  t: ConvexTest,
  type: ApprovalType,
  { organizationId, userId, roleId, collectionId }: PendingRecordSetup,
) {
  return t.run(async (ctx) => {
    const addStepForCaller = (workflowType: ApprovalType) =>
      ctx.db.insert("workflowConfigs", {
        organizationId,
        workflowType,
        canInitiateRoles: [roleId],
        steps: [{ stepNumber: 1, roleId, name: "Review" }],
      });
    switch (type) {
      case "accession": {
        await addStepForCaller("accession");
        const accessionId = await ctx.db.insert("accessions", {
          organizationId,
          accessionNumber: "ACC-1",
          dateReceived: 100,
          source: "Donor",
          method: "gift",
          status: "pending",
          workflowStep: 1,
        });
        return { type, accessionId };
      }
      case "deaccession": {
        await addStepForCaller("deaccession");
        const deaccessionId = await ctx.db.insert("deaccessions", {
          organizationId,
          collectionId,
          deaccessionNumber: "DEA-1",
          dateDeaccessioned: 200,
          reason: "Duplicate",
          method: "transfer",
          status: "pending",
          workflowStep: 1,
        });
        return { type, deaccessionId };
      }
      case "loan": {
        await addStepForCaller("loan");
        const loanId = await ctx.db.insert("loans", {
          organizationId,
          loanNumber: "LOAN-1",
          type: "outgoing",
          lenderBorrowerName: "Other museum",
          startDate: 300,
          status: "pending",
          workflowStep: 1,
        });
        return { type, loanId };
      }
      case "exhibition": {
        const exhibitionId = await ctx.db.insert("exhibitions", {
          organizationId,
          title: "Proposed exhibition",
          startDate: 400,
          isCurrent: false,
          status: "proposed",
        });
        return { type, exhibitionId };
      }
      case "conservation": {
        const baselineAssessmentId = await ctx.db.insert(
          "conditionAssessments",
          {
            organizationId,
            collectionId,
            assessedBy: userId,
            assessedAt: 500,
            recordedAt: 500,
            condition: "fair",
            summary: "Loose frame",
            observations: [],
            photos: [],
            status: "accepted",
          },
        );
        const treatmentId = await ctx.db.insert("conservationTreatments", {
          organizationId,
          collectionId,
          title: "Repair",
          description: "Repair frame",
          treatmentType: "repair",
          performedBy: userId,
          performedAt: 500,
          status: "proposed",
          baselineAssessmentId,
        });
        return { type, treatmentId };
      }
    }
  });
}

type PendingRecord = Awaited<ReturnType<typeof insertPendingRecord>>;

function approve(authed: Member, record: PendingRecord) {
  switch (record.type) {
    case "accession":
      return authed.mutation(api.accessions.approve, {
        accessionId: record.accessionId,
      });
    case "deaccession":
      return authed.mutation(api.deaccessions.approve, {
        deaccessionId: record.deaccessionId,
        exceptionReason: "Disposal evidence follows from the board minutes",
      });
    case "loan":
      return authed.mutation(api.loans.approve, { loanId: record.loanId });
    case "exhibition":
      return authed.mutation(api.exhibitions.approve, {
        exhibitionId: record.exhibitionId,
      });
    case "conservation":
      return authed.mutation(api.conservationTreatments.approve, {
        treatmentId: record.treatmentId,
      });
  }
}

const APPROVAL_ACCESS = {
  accession: {
    read: ["collections.read"],
    approve: ["collections.approve_accession"],
  },
  deaccession: {
    read: ["collections.read"],
    approve: ["collections.approve_deaccession"],
  },
  loan: { read: ["loans.read"], approve: ["loans.approve"] },
  exhibition: { read: ["collections.read"], approve: ["collections.update"] },
  conservation: {
    read: ["collections.read"],
    approve: ["collections.update"],
  },
} satisfies Record<
  ApprovalType,
  { read: readonly string[]; approve: readonly string[] }
>;

const APPROVAL_TYPES = Object.keys(APPROVAL_ACCESS) as ApprovalType[];

async function pendingApprovalFor(
  t: ConvexTest,
  type: ApprovalType,
  permissions: readonly string[],
  subscriptionTier: SubscriptionTier = "pro",
) {
  const setup = await createOrgUserCollectionWithPermissions(
    t,
    [...permissions],
    { subscriptionTier },
  );
  const record = await insertPendingRecord(t, type, setup);
  const authed = authedForUser(t, setup.userId);
  const approvals = async () =>
    (await workColumn(authed, setup.organizationId, "approvals"))?.byType;
  return { ...setup, authed, record, approvals };
}

describe.each(APPROVAL_TYPES)("pending %s approvals", (type) => {
  const { read, approve: approvePermissions } = APPROVAL_ACCESS[type];

  test("count once for a role that may approve and open them, and clear after approval", async () => {
    const t = createConvexTest();
    const { authed, record, approvals } = await pendingApprovalFor(t, type, [
      ...read,
      ...approvePermissions,
    ]);

    expect(await approvals()).toEqual({ ...NO_APPROVALS, [type]: 1 });

    await approve(authed, record);

    expect(await approvals()).toEqual(NO_APPROVALS);
  });

  test("do not count for a role the approve command refuses", async () => {
    const t = createConvexTest();
    const { authed, record, approvals } = await pendingApprovalFor(
      t,
      type,
      read,
    );

    expect(await approvals()).toEqual(NO_APPROVALS);
    expect(await capabilityFailureOf(approve(authed, record))).toMatchObject({
      reason: "permission_missing",
    });
  });

  test("do not count for a role that cannot open the page the card links to", async () => {
    const t = createConvexTest();
    const { approvals } = await pendingApprovalFor(t, type, approvePermissions);

    expect(await approvals()).toEqual(NO_APPROVALS);
  });
});

test("a role off the workflow step does not count the approval the step refuses", async () => {
  const t = createConvexTest();
  const { authed, record, approvals, organizationId } =
    await pendingApprovalFor(t, "loan", ["loans.read", "loans.approve"]);
  await t.run(async (ctx) => {
    const otherRoleId = await ctx.db.insert("roles", {
      organizationId,
      name: "Director",
      isSystemRole: false,
    });
    const workflow = await ctx.db
      .query("workflowConfigs")
      .withIndex("by_organization_and_workflowType", (q) =>
        q.eq("organizationId", organizationId).eq("workflowType", "loan"),
      )
      .unique();
    if (!workflow) throw new Error("Loan workflow missing");
    await ctx.db.patch(workflow._id, {
      steps: [{ stepNumber: 1, roleId: otherRoleId, name: "Review" }],
    });
  });

  expect(await approvals()).toEqual(NO_APPROVALS);
  await expect(
    approve(authed, record).catch(
      (error: unknown) => workflowApprovalErrorFromError(error)?.code,
    ),
  ).resolves.toBe("APPROVAL_NOT_PERMITTED");
});

test.each([
  "exhibition",
  "conservation",
] as const)("with a workflow, the step's role alone counts and approves a pending %s", async (type) => {
  const t = createConvexTest();
  const { authed, record, approvals, organizationId, roleId } =
    await pendingApprovalFor(t, type, APPROVAL_ACCESS[type].read);
  await t.run((ctx) =>
    ctx.db.insert("workflowConfigs", {
      organizationId,
      workflowType: type,
      canInitiateRoles: [roleId],
      steps: [{ stepNumber: 1, roleId, name: "Review" }],
    }),
  );

  expect(await approvals()).toEqual({ ...NO_APPROVALS, [type]: 1 });
  await approve(authed, record);
  expect(await approvals()).toEqual(NO_APPROVALS);
});

test("plans without loans, exhibitions or conservation count none of them", async () => {
  const t = createConvexTest();
  const everyPermission = APPROVAL_TYPES.flatMap((type) => [
    ...APPROVAL_ACCESS[type].read,
    ...APPROVAL_ACCESS[type].approve,
  ]);
  const setup = await createOrgUserCollectionWithPermissions(
    t,
    [...new Set(everyPermission)],
    { subscriptionTier: "free" },
  );
  for (const type of APPROVAL_TYPES) {
    await insertPendingRecord(t, type, setup);
  }

  const approvals = await workColumn(
    authedForUser(t, setup.userId),
    setup.organizationId,
    "approvals",
  );

  expect(approvals?.byType).toEqual({
    ...NO_APPROVALS,
    accession: 1,
    deaccession: 1,
  });
});

test("an accession draft is not waiting for approval", async () => {
  const t = createConvexTest();
  const { organizationId, userId } =
    await createOrgUserCollectionWithPermissions(t, [
      "collections.read",
      "collections.approve_accession",
    ]);
  await t.run((ctx) =>
    ctx.db.insert("accessions", {
      organizationId,
      accessionNumber: "ACC-DRAFT",
      dateReceived: 100,
      source: "Donor",
      method: "gift",
      status: "pending",
      workflowStep: 0,
    }),
  );

  const approvals = await workColumn(
    authedForUser(t, userId),
    organizationId,
    "approvals",
  );

  expect(approvals).toMatchObject({ cards: [], byType: NO_APPROVALS });
});

test("approval counts include every approvable record beyond the cards shown, oldest first", async () => {
  const t = createConvexTest();
  const setup = await createOrgUserCollectionWithPermissions(t, [
    "collections.read",
    "collections.approve_accession",
    "collections.approve_deaccession",
  ]);
  await insertPendingRecord(t, "accession", setup);
  await insertPendingRecord(t, "deaccession", setup);
  await t.run(async (ctx) => {
    for (const accessionNumber of ["ACC-2", "ACC-3"]) {
      await ctx.db.insert("accessions", {
        organizationId: setup.organizationId,
        accessionNumber,
        dateReceived: 100,
        source: "Donor",
        method: "gift",
        status: "pending",
        workflowStep: 1,
      });
    }
  });

  const approvals = await workColumn(
    authedForUser(t, setup.userId),
    setup.organizationId,
    "approvals",
    { approvals: 1 },
  );

  expect(approvals?.cards).toMatchObject([
    {
      type: "accession",
      label: "ACC-1",
      detail: "Donor",
      workflowStep: 1,
      urgent: true,
    },
  ]);
  expect(approvals?.hasMore).toBe(true);
  expect(approvals?.byType).toEqual({
    ...NO_APPROVALS,
    accession: 3,
    deaccession: 1,
  });
});

test("image deletions beyond the ones counted read as more", async () => {
  const museum = await createMuseum();
  const admin = await museum.member("Ada Admin", [
    "media.read",
    "organization.manage_settings",
  ]);
  await museum.t.run(async (ctx) => {
    const collectionId = await ctx.db.insert("collections", {
      organizationId: museum.organizationId,
      accessionNumber: "M-1",
      title: "Vase",
      status: "active",
      catalogedBy: admin.userId,
      catalogedAt: NOW,
    });
    const mediaId = await ctx.db.insert("mediaFiles", {
      organizationId: museum.organizationId,
      collectionId,
      storageId: await ctx.storage.store(new Blob(["photo"])),
      fileName: "front.jpg",
      fileType: "image/jpeg",
      fileSize: 5,
      mimeType: "image/jpeg",
      isPrimary: true,
      uploadedBy: admin.userId,
      uploadedAt: NOW,
      uploadStatus: "completed",
    });
    for (let index = 0; index <= PENDING_IMAGE_DELETION_LIMIT; index++) {
      await ctx.db.insert("mediaDeletionRequests", {
        organizationId: museum.organizationId,
        mediaId,
        collectionId,
        fileName: `front-${index}.jpg`,
        status: "pending",
        requestedBy: admin.userId,
        requestedAt: NOW - index,
      });
    }
  });

  const approvals = await workColumn(
    admin.client,
    museum.organizationId,
    "approvals",
    { approvals: PENDING_IMAGE_DELETION_LIMIT },
  );
  expect(approvals?.byType.imageDeletion).toBe(PENDING_IMAGE_DELETION_LIMIT);
  expect(approvals?.moreImageDeletions).toBe(true);
  expect(approvals?.cards).toHaveLength(PENDING_IMAGE_DELETION_LIMIT);
  expect(approvals?.hasMore).toBe(true);
});

test("an approval past its SLA comes before older ones within theirs, and only breached or week-old waits are urgent", async () => {
  const t = createConvexTest();
  const setup = await createOrgUserCollectionWithPermissions(
    t,
    ["loans.read", "loans.approve", "collections.read", "collections.update"],
    { subscriptionTier: "pro" },
  );
  const authed = authedForUser(t, setup.userId);
  await t.run(async (ctx) => {
    await ctx.db.insert("workflowSlaConfigs", {
      organizationId: setup.organizationId,
      workflowType: "loan",
      slaDays: 2,
      createdBy: setup.userId,
      createdAt: NOW,
    });
    for (const [loanNumber, daysWaiting] of [
      ["LOAN-NEW", 1],
      ["LOAN-LATE", 3],
    ] as const) {
      await ctx.db.insert("loans", {
        organizationId: setup.organizationId,
        loanNumber,
        type: "incoming",
        lenderBorrowerName: "Lender",
        startDate: NOW - daysWaiting * DAY,
        status: "pending",
      });
    }
    for (const [title, daysWaiting] of [
      ["Six days", 6],
      ["Eight days", 8],
    ] as const) {
      await ctx.db.insert("exhibitions", {
        organizationId: setup.organizationId,
        title,
        startDate: NOW - daysWaiting * DAY,
        isCurrent: false,
        status: "proposed",
      });
    }
  });

  const columns = await authed.query(api.workBoard.get, {
    organizationId: setup.organizationId,
    now: NOW,
  });
  const approvals = columns.find((column) => column.key === "approvals");

  expect(approvals?.cards.map((card) => [card.label, card.urgent])).toEqual([
    ["LOAN-LATE", true],
    ["Eight days", true],
    ["Six days", false],
    ["LOAN-NEW", false],
  ]);
});
