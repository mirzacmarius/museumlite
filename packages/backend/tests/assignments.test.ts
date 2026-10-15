import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import schema from "../convex/schema";
import { workflowApprovalErrorFromError } from "../convex/utils/workflowApprovalErrors";
import {
  authedForUser,
  type ConvexTest,
  capabilityFailureOf,
  createOrgUserCollectionWithPermissions,
  type SubscriptionTier,
} from "./testHarness";

import { modules } from "./testSetup";

type ApprovalType =
  | "accession"
  | "deaccession"
  | "loan"
  | "exhibition"
  | "conservation";

const NO_APPROVALS = {
  accession: 0,
  deaccession: 0,
  loan: 0,
  exhibition: 0,
  conservation: 0,
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

function approve(
  authed: ReturnType<typeof authedForUser>,
  record: PendingRecord,
) {
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
  const stats = async () =>
    (
      await authed.query(api.assignments.listMyAssignments, {
        organizationId: setup.organizationId,
      })
    ).stats;
  return { ...setup, authed, record, stats };
}

describe.each(APPROVAL_TYPES)("pending %s approvals on Overview", (type) => {
  const { read, approve: approvePermissions } = APPROVAL_ACCESS[type];

  test("count once for a role that may approve and open them, and clear after approval", async () => {
    const t = convexTest(schema, modules);
    const { authed, record, stats } = await pendingApprovalFor(t, type, [
      ...read,
      ...approvePermissions,
    ]);

    expect(await stats()).toMatchObject({
      totalPendingApprovals: 1,
      pendingApprovalsByType: { ...NO_APPROVALS, [type]: 1 },
    });

    await approve(authed, record);

    expect(await stats()).toMatchObject({
      totalPendingApprovals: 0,
      pendingApprovalsByType: NO_APPROVALS,
    });
  });

  test("do not count for a role the approve command refuses", async () => {
    const t = convexTest(schema, modules);
    const { authed, record, stats } = await pendingApprovalFor(t, type, read);

    expect(await stats()).toMatchObject({
      totalPendingApprovals: 0,
      pendingApprovalsByType: NO_APPROVALS,
    });
    expect(await capabilityFailureOf(approve(authed, record))).toMatchObject({
      reason: "permission_missing",
    });
  });

  test("do not count for a role that cannot open the page the card links to", async () => {
    const t = convexTest(schema, modules);
    const { stats } = await pendingApprovalFor(t, type, approvePermissions);

    expect(await stats()).toMatchObject({
      totalPendingApprovals: 0,
      pendingApprovalsByType: NO_APPROVALS,
    });
  });
});

test("a role off the workflow step does not count the approval the step refuses", async () => {
  const t = convexTest(schema, modules);
  const { authed, record, stats, organizationId } = await pendingApprovalFor(
    t,
    "loan",
    ["loans.read", "loans.approve"],
  );
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

  expect((await stats()).pendingApprovalsByType).toEqual(NO_APPROVALS);
  await expect(
    approve(authed, record).catch(
      (error: unknown) => workflowApprovalErrorFromError(error)?.code,
    ),
  ).resolves.toBe("APPROVAL_NOT_PERMITTED");
});

test("plans without loans, exhibitions or conservation count none of them", async () => {
  const t = convexTest(schema, modules);
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

  const { stats } = await authedForUser(t, setup.userId).query(
    api.assignments.listMyAssignments,
    { organizationId: setup.organizationId },
  );

  expect(stats.pendingApprovalsByType).toEqual({
    ...NO_APPROVALS,
    accession: 1,
    deaccession: 1,
  });
});

test("an accession draft is not waiting for approval", async () => {
  const t = convexTest(schema, modules);
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

  const { stats } = await authedForUser(t, userId).query(
    api.assignments.listMyAssignments,
    { organizationId },
  );

  expect(stats.totalPendingApprovals).toBe(0);
});

test("approval counts include every approvable record before the card limit", async () => {
  const t = convexTest(schema, modules);
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

  const result = await authedForUser(t, setup.userId).query(
    api.assignments.listMyAssignments,
    { organizationId: setup.organizationId, limit: 1 },
  );

  expect(result.pendingApprovals.map((approval) => approval.type)).toEqual([
    "accession",
  ]);
  expect(result.stats).toMatchObject({
    totalPendingApprovals: 4,
    pendingApprovalsByType: { ...NO_APPROVALS, accession: 3, deaccession: 1 },
  });
});

test("should require authentication for listMyAssignments", async () => {
  const t = convexTest(schema, modules);

  const orgId = await t.run(async (ctx) => {
    return await ctx.db.insert("organizations", {
      name: "Test Org",
      slug: "test-org",
      type: "museum",
      settings: { enabledModules: [] },
    });
  });

  await expect(
    t.query(api.assignments.listMyAssignments, {
      organizationId: orgId,
    }),
  ).rejects.toThrow("Not authenticated");
});

test("should return empty assignments when no data exists", async () => {
  const t = convexTest(schema, modules);

  const [userId, orgId] = await Promise.all([
    t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        name: "Test User",
        email: "test@example.com",
      });
    }),
    t.run(async (ctx) => {
      return await ctx.db.insert("organizations", {
        name: "Test Org",
        slug: "test-org",
        type: "museum",
        settings: { enabledModules: [] },
      });
    }),
  ]);
  const authed = t.withIdentity({
    subject: `${userId}|session-empty-assignments`,
    issuer: "https://example.test",
  });

  const result = await authed.query(api.assignments.listMyAssignments, {
    organizationId: orgId,
  });

  expect(result).toEqual({
    myAssignedAccessions: [],
    myCatalogedItems: [],
    pendingApprovals: [],
    recentlyModified: [],
    stats: {
      itemsModifiedThisWeek: 0,
      totalAssignedAccessions: 0,
      totalCatalogedItems: 0,
      totalPendingApprovals: 0,
      pendingApprovalsByType: {
        accession: 0,
        deaccession: 0,
        loan: 0,
        exhibition: 0,
        conservation: 0,
      },
    },
  });
});

test("should return valid assignment data structure", async () => {
  const t = convexTest(schema, modules);

  const [userId, orgId] = await Promise.all([
    t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        name: "Test User",
        email: "test@example.com",
      });
    }),
    t.run(async (ctx) => {
      return await ctx.db.insert("organizations", {
        name: "Test Org",
        slug: "test-org",
        type: "museum",
        settings: { enabledModules: [] },
      });
    }),
  ]);
  const authed = t.withIdentity({
    subject: `${userId}|session-data-structure`,
    issuer: "https://example.test",
  });

  const result = await authed.query(api.assignments.listMyAssignments, {
    organizationId: orgId,
  });

  expect(result).toHaveProperty("myAssignedAccessions");
  expect(result).toHaveProperty("myCatalogedItems");
  expect(result).toHaveProperty("pendingApprovals");
  expect(result).toHaveProperty("recentlyModified");
  expect(result).toHaveProperty("stats");
});

test("should return zero counts when no assignments exist", async () => {
  const t = convexTest(schema, modules);

  const [userId, orgId] = await Promise.all([
    t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        name: "Test User",
        email: "test@example.com",
      });
    }),
    t.run(async (ctx) => {
      return await ctx.db.insert("organizations", {
        name: "Test Org",
        slug: "test-org",
        type: "museum",
        settings: { enabledModules: [] },
      });
    }),
  ]);
  const authed = t.withIdentity({
    subject: `${userId}|session-counts`,
    issuer: "https://example.test",
  });

  const counts = await authed.query(api.assignments.getAssignmentCounts, {
    organizationId: orgId,
  });

  expect(counts).toEqual({
    pendingApprovals: 0,
    assignedAccessions: 0,
    urgentItems: 0,
  });
});
