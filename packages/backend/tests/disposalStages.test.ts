import { expect, test } from "vitest";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import {
  authedForUser,
  type ConvexTest,
  createConvexTest,
  createOrgUserCollectionWithPermissions,
} from "./testHarness";

const DAY_MS = 24 * 60 * 60 * 1000;

const approverPermissions = [
  "collections.create",
  "collections.read",
  "collections.update",
  "collections.approve_deaccession",
];

async function createSingleStepWorkflowFixture(
  t: ConvexTest,
  permissions: string[] = approverPermissions,
) {
  const fixture = await createOrgUserCollectionWithPermissions(t, permissions, {
    roleName: "Collections Committee",
  });
  await t.run(async (ctx) => {
    await ctx.db.insert("workflowConfigs", {
      organizationId: fixture.organizationId,
      workflowType: "deaccession",
      steps: [
        { stepNumber: 1, roleId: fixture.roleId, name: "Committee decision" },
      ],
      canInitiateRoles: [fixture.roleId],
    });
  });
  return { ...fixture, authed: authedForUser(t, fixture.userId) };
}

async function insertAppraisal(
  t: ConvexTest,
  args: {
    organizationId: Id<"organizations">;
    collectionId: Id<"collections">;
    userId: Id<"users">;
    ageDays: number;
  },
) {
  return await t.run(async (ctx) =>
    ctx.db.insert("appraisals", {
      organizationId: args.organizationId,
      collectionId: args.collectionId,
      appraisalDate: Date.now() - args.ageDays * DAY_MS,
      appraiserName: "Independent Valuer",
      appraisalType: "fair_market",
      value: 12_000,
      currency: "EUR",
      createdBy: args.userId,
      createdAt: Date.now(),
      isCurrentAppraisal: true,
    }),
  );
}

test("a sale decision cannot be approved while its decision checks are outstanding", async () => {
  const t = createConvexTest();
  const { authed, organizationId, collectionId } =
    await createSingleStepWorkflowFixture(t);

  const deaccessionId = await authed.mutation(api.deaccessions.create, {
    organizationId,
    collectionId,
    dateDeaccessioned: Date.now(),
    reason: "Outside collecting policy",
    method: "sale",
  });

  await expect(
    authed.mutation(api.deaccessions.approve, { deaccessionId }),
  ).rejects.toThrow(/intended disposition.*valuation/i);

  const deaccession = await authed.query(api.deaccessions.get, {
    deaccessionId,
  });
  const collection = await authed.query(api.collections.get, {
    collectionId,
  });
  expect(deaccession?.status).toBe("pending");
  expect(collection?.status).toBe("active");
});

test("an approver can authorize an audited exception for outstanding decision checks", async () => {
  const t = createConvexTest();
  const { authed, organizationId, collectionId, userId } =
    await createSingleStepWorkflowFixture(t);

  const deaccessionId = await authed.mutation(api.deaccessions.create, {
    organizationId,
    collectionId,
    dateDeaccessioned: Date.now(),
    reason: "Duplicate study specimen",
    method: "sale",
    disposition: "Public auction",
  });

  await expect(
    authed.mutation(api.deaccessions.approve, {
      deaccessionId,
      exceptionReason: "   ",
    }),
  ).rejects.toThrow(/valuation/i);

  await authed.mutation(api.deaccessions.approve, {
    deaccessionId,
    exceptionReason: "Board minute 2026-14 accepts auction estimate",
  });

  const stages = await authed.query(api.deaccessions.getDisposalStages, {
    deaccessionId,
  });
  expect(stages?.decision.basis).toBe("authorized_exception");
  expect(stages?.decision.exception).toMatchObject({
    reason: "Board minute 2026-14 accepts auction estimate",
    waivedCheckKeys: ["valuation"],
    authorizedBy: userId,
  });
  expect(stages?.exit.state).toBe("outstanding");
  expect(stages?.proceeds.state).toBe("outstanding");

  const auditActions = await t.run(async (ctx) =>
    (
      await ctx.db
        .query("auditLog")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", organizationId),
        )
        .collect()
    ).map((entry) => entry.action),
  );
  expect(auditActions).toContain("disposal_decision_exception_authorized");
});

test("a sale decision with a current valuation is approved without demanding a sale receipt", async () => {
  const t = createConvexTest();
  const { authed, organizationId, collectionId, userId } =
    await createSingleStepWorkflowFixture(t);
  const appraisalId = await insertAppraisal(t, {
    organizationId,
    collectionId,
    userId,
    ageDays: 30,
  });

  const deaccessionId = await authed.mutation(api.deaccessions.create, {
    organizationId,
    collectionId,
    dateDeaccessioned: Date.now(),
    reason: "Outside collecting policy",
    method: "sale",
    disposition: "Public auction",
  });
  const link = await authed.mutation(api.deaccessions.linkAppraisal, {
    deaccessionId,
    appraisalId,
  });
  expect(link.valid).toBe(true);

  const before = await authed.query(api.deaccessions.getDisposalStages, {
    deaccessionId,
  });
  expect(before?.decision.ready).toBe(true);
  expect(before?.proceeds.state).toBe("awaiting_decision");

  await authed.mutation(api.deaccessions.approve, { deaccessionId });

  const stages = await authed.query(api.deaccessions.getDisposalStages, {
    deaccessionId,
  });
  expect(stages?.decision.basis).toBe("policy_checked");
  expect(stages?.decision.exception).toBeUndefined();
  const collection = await authed.query(api.collections.get, {
    collectionId,
  });
  expect(collection?.status).toBe("deaccessioned");
});

test("a stale valuation does not satisfy a sale decision", async () => {
  const t = createConvexTest();
  const { authed, organizationId, collectionId, userId } =
    await createSingleStepWorkflowFixture(t);
  const appraisalId = await insertAppraisal(t, {
    organizationId,
    collectionId,
    userId,
    ageDays: 900,
  });
  const deaccessionId = await authed.mutation(api.deaccessions.create, {
    organizationId,
    collectionId,
    dateDeaccessioned: Date.now(),
    reason: "Outside collecting policy",
    method: "sale",
    disposition: "Public auction",
  });
  await authed.mutation(api.deaccessions.linkAppraisal, {
    deaccessionId,
    appraisalId,
  });

  await expect(
    authed.mutation(api.deaccessions.approve, { deaccessionId }),
  ).rejects.toThrow(/valuation/i);
});

test("without an approval workflow, incomplete decisions wait for an approver instead of auto-approving", async () => {
  const t = createConvexTest();
  const { organizationId, userId, collectionId } =
    await createOrgUserCollectionWithPermissions(t, approverPermissions);
  const authed = authedForUser(t, userId);

  const incompleteId = await authed.mutation(api.deaccessions.create, {
    organizationId,
    collectionId,
    dateDeaccessioned: Date.now(),
    reason: "Infested beyond treatment",
    method: "destruction",
  });
  expect(
    (await authed.query(api.deaccessions.get, { deaccessionId: incompleteId }))
      ?.status,
  ).toBe("pending");
  expect(
    (await authed.query(api.collections.get, { collectionId }))?.status,
  ).toBe("active");

  await authed.mutation(api.deaccessions.update, {
    deaccessionId: incompleteId,
    disposition: "Witnessed incineration by licensed contractor",
  });
  await authed.mutation(api.deaccessions.approve, {
    deaccessionId: incompleteId,
  });
  const stages = await authed.query(api.deaccessions.getDisposalStages, {
    deaccessionId: incompleteId,
  });
  expect(stages?.decision.basis).toBe("policy_checked");
  expect(stages?.proceeds.state).toBe("not_applicable");
  expect(
    (await authed.query(api.collections.get, { collectionId }))?.status,
  ).toBe("deaccessioned");
});

test("without an approval workflow, complete decisions are approved immediately with a policy snapshot", async () => {
  const t = createConvexTest();
  const { organizationId, userId, collectionId } =
    await createOrgUserCollectionWithPermissions(t, approverPermissions);
  const authed = authedForUser(t, userId);

  const deaccessionId = await authed.mutation(api.deaccessions.create, {
    organizationId,
    collectionId,
    dateDeaccessioned: Date.now(),
    reason: "Transferred to partner museum",
    method: "transfer",
    disposition: "Transfer of title to Regional Museum",
  });

  const stages = await authed.query(api.deaccessions.getDisposalStages, {
    deaccessionId,
  });
  expect(stages?.decision.basis).toBe("policy_checked");
  expect(stages?.exit.state).toBe("outstanding");
});

test("approved decisions without a stage review are reported as legacy and stay unchanged", async () => {
  const t = createConvexTest();
  const { organizationId, userId, collectionId } =
    await createOrgUserCollectionWithPermissions(t, approverPermissions);
  const authed = authedForUser(t, userId);
  const legacyId = await t.run(async (ctx) =>
    ctx.db.insert("deaccessions", {
      organizationId,
      collectionId,
      deaccessionNumber: "D-1998-004",
      dateDeaccessioned: Date.UTC(1998, 3, 2),
      reason: "Sold",
      method: "sale",
      status: "approved",
      approvedBy: userId,
      approvedAt: Date.UTC(1998, 3, 2),
    }),
  );

  const stages = await authed.query(api.deaccessions.getDisposalStages, {
    deaccessionId: legacyId,
  });
  expect(stages?.decision.basis).toBe("legacy");
  expect(stages?.decision.checks).toEqual([]);

  const stored = await t.run(async (ctx) => ctx.db.get(legacyId));
  expect(stored?.decisionReview).toBeUndefined();
});
