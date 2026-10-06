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
