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

async function createApprovedSale(
  t: ConvexTest,
  fixture: Awaited<ReturnType<typeof createSingleStepWorkflowFixture>>,
) {
  const appraisalId = await insertAppraisal(t, {
    organizationId: fixture.organizationId,
    collectionId: fixture.collectionId,
    userId: fixture.userId,
    ageDays: 10,
  });
  const deaccessionId = await fixture.authed.mutation(
    api.deaccessions.create,
    {
      organizationId: fixture.organizationId,
      collectionId: fixture.collectionId,
      dateDeaccessioned: Date.now(),
      reason: "Outside collecting policy",
      method: "sale",
      disposition: "Public auction",
    },
  );
  await fixture.authed.mutation(api.deaccessions.linkAppraisal, {
    deaccessionId,
    appraisalId,
  });
  await fixture.authed.mutation(api.deaccessions.approve, { deaccessionId });
  return deaccessionId;
}

test("physical exit is recorded after the decision and corrections keep the original", async () => {
  const t = createConvexTest();
  const fixture = await createSingleStepWorkflowFixture(t);
  const { authed } = fixture;
  const deaccessionId = await createApprovedSale(t, fixture);

  await authed.mutation(api.deaccessions.recordExit, {
    deaccessionId,
    exitDate: Date.UTC(2026, 5, 1),
    recipient: "Hammer & Co. Auctioneers",
    reference: "Consignment 77",
  });
  let stages = await authed.query(api.deaccessions.getDisposalStages, {
    deaccessionId,
  });
  expect(stages?.exit.state).toBe("recorded");
  expect(stages?.exit.record?.recipient).toBe("Hammer & Co. Auctioneers");

  await expect(
    authed.mutation(api.deaccessions.recordExit, {
      deaccessionId,
      exitDate: Date.UTC(2026, 5, 2),
      recipient: "Hammer & Co.",
    }),
  ).rejects.toThrow(/correction reason/i);

  await authed.mutation(api.deaccessions.recordExit, {
    deaccessionId,
    exitDate: Date.UTC(2026, 5, 2),
    recipient: "Hammer & Co.",
    correctionReason: "Wrong collection date on consignment note",
  });
  stages = await authed.query(api.deaccessions.getDisposalStages, {
    deaccessionId,
  });
  expect(stages?.exit.record?.exitDate).toBe(Date.UTC(2026, 5, 2));
  expect(stages?.exit.correctionCount).toBe(1);
  const stored = await t.run(async (ctx) => ctx.db.get(deaccessionId));
  expect(stored?.supersededExitRecords?.[0]?.recipient).toBe(
    "Hammer & Co. Auctioneers",
  );
});

test("exit cannot be recorded before the decision or for another organization's users", async () => {
  const t = createConvexTest();
  const fixture = await createSingleStepWorkflowFixture(t);
  const pendingId = await fixture.authed.mutation(api.deaccessions.create, {
    organizationId: fixture.organizationId,
    collectionId: fixture.collectionId,
    dateDeaccessioned: Date.now(),
    reason: "Outside collecting policy",
    method: "sale",
  });
  await expect(
    fixture.authed.mutation(api.deaccessions.recordExit, {
      deaccessionId: pendingId,
      exitDate: Date.now(),
      recipient: "Buyer",
    }),
  ).rejects.toThrow(/approved/i);

  const approvedId = await createApprovedSaleFor(t, fixture);
  const outsider = await createOrgUserCollectionWithPermissions(
    t,
    approverPermissions,
  );
  await expect(
    authedForUser(t, outsider.userId).mutation(api.deaccessions.recordExit, {
      deaccessionId: approvedId,
      exitDate: Date.now(),
      recipient: "Buyer",
    }),
  ).rejects.toThrow();
});

async function createApprovedSaleFor(
  t: ConvexTest,
  fixture: Awaited<ReturnType<typeof createSingleStepWorkflowFixture>>,
) {
  await t.run(async (ctx) => {
    const pending = await ctx.db
      .query("deaccessions")
      .withIndex("by_collection", (q) =>
        q.eq("collectionId", fixture.collectionId),
      )
      .first();
    if (pending) await ctx.db.delete(pending._id);
  });
  return await createApprovedSale(t, fixture);
}

test("sale proceeds are recorded after the decision; verification needs a receipt or an audited exception", async () => {
  const t = createConvexTest();
  const fixture = await createSingleStepWorkflowFixture(t);
  const { authed } = fixture;
  const deaccessionId = await createApprovedSale(t, fixture);

  await authed.mutation(api.deaccessions.recordProceeds, {
    deaccessionId,
    amount: 15_500,
    currency: "EUR",
    recipient: "Acquisitions fund",
    date: Date.UTC(2026, 6, 1),
  });
  let stages = await authed.query(api.deaccessions.getDisposalStages, {
    deaccessionId,
  });
  expect(stages?.proceeds.state).toBe("recorded");

  await expect(
    authed.mutation(api.deaccessions.verifyProceeds, { deaccessionId }),
  ).rejects.toThrow(/receipt/i);

  await authed.mutation(api.deaccessions.verifyProceeds, {
    deaccessionId,
    exceptionReason: "Bank statement filed with finance; receipt not issued",
  });
  stages = await authed.query(api.deaccessions.getDisposalStages, {
    deaccessionId,
  });
  expect(stages?.proceeds.state).toBe("verified");
  const stored = await t.run(async (ctx) => ctx.db.get(deaccessionId));
  expect(stored?.proceedsVerificationException?.reason).toContain(
    "Bank statement",
  );
});

test("proceeds are refused for non-sale methods and before the decision", async () => {
  const t = createConvexTest();
  const fixture = await createSingleStepWorkflowFixture(t);
  const pendingId = await fixture.authed.mutation(api.deaccessions.create, {
    organizationId: fixture.organizationId,
    collectionId: fixture.collectionId,
    dateDeaccessioned: Date.now(),
    reason: "Outside collecting policy",
    method: "sale",
  });
  await expect(
    fixture.authed.mutation(api.deaccessions.recordProceeds, {
      deaccessionId: pendingId,
      amount: 1,
      currency: "EUR",
      recipient: "Fund",
      date: Date.now(),
    }),
  ).rejects.toThrow(/approved/i);

  const donation = await createOrgUserCollectionWithPermissions(
    t,
    approverPermissions,
  );
  const donationAuthed = authedForUser(t, donation.userId);
  const donationId = await donationAuthed.mutation(api.deaccessions.create, {
    organizationId: donation.organizationId,
    collectionId: donation.collectionId,
    dateDeaccessioned: Date.now(),
    reason: "Gift to partner",
    method: "donation",
    disposition: "Donated to Regional Museum",
  });
  await expect(
    donationAuthed.mutation(api.deaccessions.recordProceeds, {
      deaccessionId: donationId,
      amount: 1,
      currency: "EUR",
      recipient: "Fund",
      date: Date.now(),
    }),
  ).rejects.toThrow(/sale/i);
});

test("a proceeds receipt must come from an authorized upload session", async () => {
  const t = createConvexTest();
  const fixture = await createSingleStepWorkflowFixture(t);
  const { authed } = fixture;
  const deaccessionId = await createApprovedSale(t, fixture);

  const uploadUrl = new URL(
    await authed.mutation(api.deaccessions.generateReceiptUploadUrl, {
      deaccessionId,
    }),
  );
  const response = await t.fetch(uploadUrl.pathname + uploadUrl.search, {
    method: "POST",
    headers: { "Content-Type": "application/pdf" },
    body: new Blob([new Uint8Array(512)], { type: "application/pdf" }),
  });
  const { storageId }: { storageId: Id<"_storage"> } = await response.json();

  await authed.mutation(api.deaccessions.recordProceeds, {
    deaccessionId,
    amount: 9000,
    currency: "EUR",
    recipient: "Acquisitions fund",
    date: Date.now(),
    receiptDocument: storageId,
  });
  await authed.mutation(api.deaccessions.verifyProceeds, { deaccessionId });
  const stages = await authed.query(api.deaccessions.getDisposalStages, {
    deaccessionId,
  });
  expect(stages?.proceeds.state).toBe("verified");
  expect(stages?.proceeds.hasReceipt).toBe(true);

  const other = await createApprovedSaleForSecondObject(t, fixture);
  await expect(
    authed.mutation(api.deaccessions.recordProceeds, {
      deaccessionId: other,
      amount: 1,
      currency: "EUR",
      recipient: "Fund",
      date: Date.now(),
      receiptDocument: storageId,
    }),
  ).rejects.toThrow(/another record/i);
});

async function createApprovedSaleForSecondObject(
  t: ConvexTest,
  fixture: Awaited<ReturnType<typeof createSingleStepWorkflowFixture>>,
) {
  const collectionId = await t.run(async (ctx) =>
    ctx.db.insert("collections", {
      organizationId: fixture.organizationId,
      accessionNumber: "OBJ-SECOND",
      title: "Second object",
      status: "active",
      catalogedBy: fixture.userId,
      catalogedAt: Date.now(),
    }),
  );
  return await createApprovedSale(t, { ...fixture, collectionId });
}

test("decision readiness for a sale does not ask for a future sale receipt", async () => {
  const t = createConvexTest();
  const fixture = await createSingleStepWorkflowFixture(t);
  const appraisalId = await insertAppraisal(t, {
    organizationId: fixture.organizationId,
    collectionId: fixture.collectionId,
    userId: fixture.userId,
    ageDays: 5,
  });
  const deaccessionId = await fixture.authed.mutation(api.deaccessions.create, {
    organizationId: fixture.organizationId,
    collectionId: fixture.collectionId,
    dateDeaccessioned: Date.now(),
    reason: "Outside collecting policy",
    method: "sale",
    disposition: "Public auction",
  });
  await fixture.authed.mutation(api.deaccessions.linkAppraisal, {
    deaccessionId,
    appraisalId,
  });

  const readiness = await fixture.authed.query(
    api.deaccessions.checkReadiness,
    { deaccessionId },
  );
  expect(readiness.ready).toBe(true);
  expect(readiness.checks.map((check) => check.name)).not.toContain(
    "Proceeds Documentation",
  );
});

test("deleting a catalog record cannot bypass the disposal decision", async () => {
  const t = createConvexTest();
  const { authed, collectionId } = await createSingleStepWorkflowFixture(t, [
    ...approverPermissions,
    "collections.delete",
  ]);

  await expect(
    authed.mutation(api.collections.deleteCollection, { collectionId }),
  ).rejects.toThrow(/disposal decision/i);
  expect(
    (await authed.query(api.collections.get, { collectionId }))?.status,
  ).toBe("active");
});
