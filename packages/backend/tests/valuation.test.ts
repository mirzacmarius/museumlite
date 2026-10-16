import { expect, test } from "vitest";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import * as appraisals from "../convex/appraisals";
import {
  type ValuationErrorData,
  valuationErrorFromError,
} from "../convex/utils/valuationErrors";
import { expectMatchesReturns } from "./returnsValidation";
import {
  authedForUser,
  type ConvexTest,
  createConvexTest,
  createOrgUserCollectionWithPermissions,
  createOrgUserWithPermissions,
} from "./testHarness";

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 8, 17, 12);

async function valuationErrorOf(
  call: Promise<unknown>,
): Promise<ValuationErrorData | null> {
  try {
    await call;
  } catch (error) {
    return valuationErrorFromError(error);
  }
  throw new Error("Expected the call to be rejected");
}

async function setupCurator(t: ConvexTest) {
  const setup = await createOrgUserCollectionWithPermissions(
    t,
    ["collections.read", "collections.update", "collections.view_valuation"],
    { subscriptionTier: "pro", slugPrefix: "valuation" },
  );
  return { ...setup, staff: authedForUser(t, setup.userId) };
}

interface AppraisalOverrides {
  appraisalType?:
    | "insurance"
    | "market"
    | "fair_market"
    | "replacement"
    | "liquidation";
  value?: number;
  currency?: string;
  appraisalDate?: number;
  appraiserName?: string;
}

function appraisalFacts(overrides: AppraisalOverrides = {}) {
  return {
    appraisalDate: NOW - 30 * DAY,
    appraiserName: "Independent Valuer",
    appraisalType: "insurance" as const,
    value: 10_000,
    currency: "EUR",
    ...overrides,
  };
}

function appraisalInput(
  collectionId: Id<"collections">,
  overrides: AppraisalOverrides = {},
) {
  return { collectionId, ...appraisalFacts(overrides) };
}

test("an object has one current valuation per purpose and currency", async () => {
  const t = createConvexTest();
  const { staff, collectionId } = await setupCurator(t);

  await staff.mutation(
    api.appraisals.create,
    appraisalInput(collectionId, {
      value: 9_000,
      appraisalDate: NOW - 400 * DAY,
    }),
  );
  await staff.mutation(
    api.appraisals.create,
    appraisalInput(collectionId, {
      value: 12_000,
      appraisalDate: NOW - 20 * DAY,
    }),
  );
  await staff.mutation(
    api.appraisals.create,
    appraisalInput(collectionId, {
      currency: "usd",
      value: 13_500,
      appraisalDate: NOW - 60 * DAY,
    }),
  );
  await staff.mutation(
    api.appraisals.create,
    appraisalInput(collectionId, {
      appraisalType: "market",
      value: 8_000,
      appraisalDate: NOW - 10 * DAY,
    }),
  );

  const valuation = await staff.query(api.appraisals.getObjectValuation, {
    collectionId,
    now: NOW,
  });
  expectMatchesReturns(appraisals.getObjectValuation, valuation);
  expect(
    valuation?.current.map((entry) => ({
      purpose: entry.purpose,
      currency: entry.currency,
      value: entry.value,
    })),
  ).toEqual([
    { purpose: "insurance", currency: "EUR", value: 12_000 },
    { purpose: "insurance", currency: "USD", value: 13_500 },
    { purpose: "market", currency: "EUR", value: 8_000 },
  ]);
  expect(valuation?.history).toHaveLength(4);
  expect(
    valuation?.history.find((entry) => entry.value === 9_000)?.isCurrent,
  ).toBe(false);
});

test("an appraisal in an unrecognised currency is rejected with a stable code", async () => {
  const t = createConvexTest();
  const { staff, collectionId } = await setupCurator(t);

  const error = await valuationErrorOf(
    staff.mutation(
      api.appraisals.create,
      appraisalInput(collectionId, { currency: "dollars" }),
    ),
  );
  expect(error?.code).toBe("INVALID_CURRENCY");
});

test("superseding an appraisal keeps the original value in history and makes the correction current", async () => {
  const t = createConvexTest();
  const { staff, collectionId } = await setupCurator(t);
  const originalId = await staff.mutation(
    api.appraisals.create,
    appraisalInput(collectionId, { value: 10_000 }),
  );

  const correctionId = await staff.mutation(api.appraisals.supersede, {
    appraisalId: originalId,
    reason: "Transcription error in the valuer's figure",
    ...appraisalFacts({ value: 11_000 }),
  });

  const valuation = await staff.query(api.appraisals.getObjectValuation, {
    collectionId,
    now: NOW,
  });
  expect(valuation?.current.map((entry) => entry._id)).toEqual([correctionId]);
  expect(
    valuation?.history.find((entry) => entry._id === originalId),
  ).toMatchObject({
    value: 10_000,
    currency: "EUR",
    isCurrent: false,
    supersededBy: correctionId,
  });
  expect(
    valuation?.history.find((entry) => entry._id === correctionId),
  ).toMatchObject({
    value: 11_000,
    isCurrent: true,
    supersedes: originalId,
    supersessionReason: "Transcription error in the valuer's figure",
  });

  const error = await valuationErrorOf(
    staff.mutation(api.appraisals.supersede, {
      appraisalId: originalId,
      reason: "Second attempt",
      ...appraisalFacts({ value: 12_000 }),
    }),
  );
  expect(error?.code).toBe("APPRAISAL_ALREADY_SUPERSEDED");
});

test("a superseded appraisal stops being current even when it is the latest dated", async () => {
  const t = createConvexTest();
  const { staff, collectionId } = await setupCurator(t);
  const earlierId = await staff.mutation(
    api.appraisals.create,
    appraisalInput(collectionId, {
      value: 7_000,
      appraisalDate: NOW - 200 * DAY,
    }),
  );
  const latestId = await staff.mutation(
    api.appraisals.create,
    appraisalInput(collectionId, { value: 70_000, appraisalDate: NOW - DAY }),
  );

  await staff.mutation(api.appraisals.supersede, {
    appraisalId: latestId,
    reason: "Recorded for the wrong purpose",
    ...appraisalFacts({
      appraisalType: "replacement",
      value: 70_000,
      appraisalDate: NOW - DAY,
    }),
  });

  const valuation = await staff.query(api.appraisals.getObjectValuation, {
    collectionId,
    now: NOW,
  });
  expect(
    valuation?.current.map((entry) => [entry.purpose, entry.value]),
  ).toEqual([
    ["insurance", 7_000],
    ["replacement", 70_000],
  ]);
  expect(
    valuation?.history.find((entry) => entry._id === earlierId)?.isCurrent,
  ).toBe(true);
});

async function addReader(
  t: ConvexTest,
  organizationId: Id<"organizations">,
  permissions: string[],
) {
  const userId = await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", {
      email: `reader-${Math.random().toString(36).slice(2, 8)}@example.com`,
      name: "Reader",
    });
    const roleId = await ctx.db.insert("roles", {
      organizationId,
      name: "Reader",
      isSystemRole: false,
    });
    for (const name of permissions) {
      const permissionId = await ctx.db.insert("permissions", {
        name,
        category: name.split(".")[0] ?? "collections",
      });
      await ctx.db.insert("rolePermissions", { roleId, permissionId });
    }
    await ctx.db.insert("userOrganizations", {
      userId,
      organizationId,
      roleId,
      joinedAt: NOW,
    });
    return userId;
  });
  return authedForUser(t, userId);
}

test("staff without collection update permission cannot record or supersede appraisals", async () => {
  const t = createConvexTest();
  const { staff, collectionId, organizationId } = await setupCurator(t);
  const appraisalId = await staff.mutation(
    api.appraisals.create,
    appraisalInput(collectionId),
  );
  const reader = await addReader(t, organizationId, [
    "collections.read",
    "collections.view_valuation",
  ]);

  await expect(
    reader.mutation(api.appraisals.create, appraisalInput(collectionId)),
  ).rejects.toThrow("Permission denied");
  await expect(
    reader.mutation(api.appraisals.supersede, {
      appraisalId,
      reason: "Not allowed",
      ...appraisalFacts({ value: 1 }),
    }),
  ).rejects.toThrow("Permission denied");
  const valuation = await reader.query(api.appraisals.getObjectValuation, {
    collectionId,
    now: NOW,
  });
  expect(valuation?.history).toHaveLength(1);
});

test("a disposal decision records the linked valuation's currency and refuses superseded valuations", async () => {
  const t = createConvexTest();
  const { organizationId, collectionId, userId } =
    await createOrgUserCollectionWithPermissions(
      t,
      [
        "collections.create",
        "collections.read",
        "collections.update",
        "collections.view_valuation",
      ],
      { subscriptionTier: "pro", slugPrefix: "disposal-valuation" },
    );
  const staff = authedForUser(t, userId);
  const originalId = await staff.mutation(api.appraisals.create, {
    ...appraisalInput(collectionId, {
      appraisalType: "fair_market",
      value: 12_000,
      currency: "GBP",
      appraisalDate: Date.now() - 30 * DAY,
    }),
  });
  const correctionId = await staff.mutation(api.appraisals.supersede, {
    appraisalId: originalId,
    reason: "Valuer revised the figure",
    ...appraisalFacts({
      appraisalType: "fair_market",
      value: 12_500,
      currency: "GBP",
      appraisalDate: Date.now() - 30 * DAY,
    }),
  });
  const deaccessionId = await staff.mutation(api.deaccessions.create, {
    organizationId,
    collectionId,
    dateDeaccessioned: Date.now(),
    reason: "Outside collecting policy",
    method: "sale",
    disposition: "Public auction",
  });

  const refused = await valuationErrorOf(
    staff.mutation(api.deaccessions.linkAppraisal, {
      deaccessionId,
      appraisalId: originalId,
    }),
  );
  expect(refused?.code).toBe("APPRAISAL_SUPERSEDED");

  const link = await staff.mutation(api.deaccessions.linkAppraisal, {
    deaccessionId,
    appraisalId: correctionId,
  });
  expect(link.valid).toBe(true);
  const stages = await staff.query(api.deaccessions.getDisposalStages, {
    deaccessionId,
  });
  expect(stages?.valuation).toMatchObject({
    linkedAppraisalId: correctionId,
    value: 12_500,
    currency: "GBP",
    isCurrent: true,
  });
});

test("another organization cannot read an object's valuation", async () => {
  const t = createConvexTest();
  const { staff, collectionId } = await setupCurator(t);
  await staff.mutation(api.appraisals.create, appraisalInput(collectionId));
  const outsider = await createOrgUserWithPermissions(
    t,
    ["collections.read", "collections.update"],
    { subscriptionTier: "pro", slugPrefix: "outsider" },
  );

  await expect(
    authedForUser(t, outsider.userId).query(api.appraisals.getObjectValuation, {
      collectionId,
      now: NOW,
    }),
  ).rejects.toThrow("Permission denied");
});
