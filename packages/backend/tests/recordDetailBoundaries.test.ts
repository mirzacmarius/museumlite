import { expect, test } from "vitest";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import * as collections from "../convex/collections";
import { capabilityUnavailableFromError } from "../convex/utils/capabilities";
import { expectMatchesReturns } from "./returnsValidation";
import {
  authedForUser,
  type ConvexTest,
  createConvexTest,
  createOrgUserCollectionWithPermissions,
  createOrgUserWithPermissions,
} from "./testHarness";

/** A member of `organizationId` whose role has none of the given permissions. */
async function addMemberWithoutRead(
  t: ConvexTest,
  organizationId: Id<"organizations">,
) {
  const member = await createOrgUserWithPermissions(t, []);
  await t.run((ctx) =>
    ctx.db.insert("userOrganizations", {
      userId: member.userId,
      organizationId,
      roleId: member.roleId,
      joinedAt: Date.now(),
    }),
  );
  return authedForUser(t, member.userId);
}

/** Why a member's read was refused, from its coded capability error. */
async function refusalOf(call: Promise<unknown>) {
  try {
    await call;
  } catch (error) {
    return capabilityUnavailableFromError(error)?.reason ?? null;
  }
  throw new Error("Expected the call to be rejected");
}

test("another organization's object reads as missing instead of failing", async () => {
  const t = createConvexTest();
  const owner = await createOrgUserCollectionWithPermissions(t, [
    "collections.read",
  ]);
  const outsider = await createOrgUserWithPermissions(t, ["collections.read"]);

  const detail = await authedForUser(t, outsider.userId).query(
    api.collections.getObjectDetail,
    { collectionId: owner.collectionId },
  );

  expect(detail).toBeNull();
});

test("a malformed object link or another record type's identifier reads as missing", async () => {
  const t = createConvexTest();
  const owner = await createOrgUserCollectionWithPermissions(t, [
    "collections.read",
  ]);
  const user = authedForUser(t, owner.userId);

  for (const collectionId of ["not-an-object", owner.organizationId]) {
    expect(
      await user.query(api.collections.getObjectDetail, { collectionId }),
    ).toBeNull();
  }
});

test("an object whose condition comes from an accepted assessment opens, also for editing", async () => {
  const t = createConvexTest();
  const owner = await createOrgUserCollectionWithPermissions(t, [
    "collections.read",
    "collections.update",
    "collections.accept_condition",
  ]);
  const user = authedForUser(t, owner.userId);
  const assessmentId = await user.mutation(api.conditionAssessments.create, {
    collectionId: owner.collectionId,
    assessedAt: Date.now() - 60_000,
    condition: "Fair",
    summary: "Checked on receipt from the borrower",
    observations: [],
    photos: [],
  });
  await user.mutation(api.conditionAssessments.accept, { assessmentId });

  const detail = await user.query(api.collections.getObjectDetail, {
    collectionId: owner.collectionId,
  });

  expect(detail?.collection.condition).toBe("Fair");
  expectMatchesReturns(collections.getObjectDetail, detail);

  const editable = await user.query(api.collections.get, {
    collectionId: owner.collectionId,
  });
  expect(editable?.condition).toBe("Fair");
  expectMatchesReturns(collections.get, editable);
});

test("a member whose role cannot read objects gets a coded permission refusal", async () => {
  const t = createConvexTest();
  const owner = await createOrgUserCollectionWithPermissions(t, [
    "collections.read",
  ]);
  const member = await addMemberWithoutRead(t, owner.organizationId);

  expect(
    await refusalOf(
      member.query(api.collections.getObjectDetail, {
        collectionId: owner.collectionId,
      }),
    ),
  ).toBe("permission_missing");
});

type Caller = ReturnType<typeof authedForUser>;

interface DetailRecordCase {
  name: string;
  readPermission: string;
  tier: "free" | "pro";
  insert: (
    t: ConvexTest,
    owner: {
      organizationId: Id<"organizations">;
      userId: Id<"users">;
      collectionId: Id<"collections">;
    },
  ) => Promise<string>;
  read: (caller: Caller, id: string) => Promise<unknown>;
}

const detailRecordCases: DetailRecordCase[] = [
  {
    name: "a loan",
    readPermission: "loans.read",
    tier: "pro",
    insert: (t, owner) =>
      t.run((ctx) =>
        ctx.db.insert("loans", {
          organizationId: owner.organizationId,
          loanNumber: "LN-650",
          lenderBorrowerName: "Partner museum",
          type: "outgoing",
          status: "pending",
          startDate: Date.UTC(2026, 0, 1),
        }),
      ),
    read: (caller, loanId) => caller.query(api.loans.get, { loanId }),
  },
  {
    name: "an accession",
    readPermission: "collections.read",
    tier: "free",
    insert: (t, owner) =>
      t.run((ctx) =>
        ctx.db.insert("accessions", {
          organizationId: owner.organizationId,
          accessionNumber: "ACC-650",
          dateReceived: Date.UTC(2026, 0, 1),
          source: "Donor",
          method: "gift",
          status: "pending",
          workflowStep: 1,
        }),
      ),
    read: (caller, accessionId) =>
      caller.query(api.accessions.get, { accessionId }),
  },
  {
    name: "a deaccession",
    readPermission: "collections.read",
    tier: "free",
    insert: (t, owner) =>
      t.run((ctx) =>
        ctx.db.insert("deaccessions", {
          organizationId: owner.organizationId,
          collectionId: owner.collectionId,
          deaccessionNumber: "DEA-650",
          dateDeaccessioned: Date.UTC(2026, 0, 1),
          reason: "Duplicate",
          method: "transfer",
          status: "pending",
          workflowStep: 1,
        }),
      ),
    read: (caller, deaccessionId) =>
      caller.query(api.deaccessions.get, { deaccessionId }),
  },
  {
    name: "a location",
    readPermission: "locations.read",
    tier: "free",
    insert: (t, owner) =>
      t.run((ctx) =>
        ctx.db.insert("locations", {
          organizationId: owner.organizationId,
          name: "Store 650",
          locationCode: "S-650",
          type: "storage",
          sortOrder: 0,
          isActive: true,
        }),
      ),
    read: (caller, locationId) =>
      caller.query(api.locations.get, { locationId }),
  },
  {
    name: "a conservation treatment",
    readPermission: "collections.read",
    tier: "pro",
    insert: (t, owner) =>
      t.run((ctx) =>
        ctx.db.insert("conservationTreatments", {
          organizationId: owner.organizationId,
          collectionId: owner.collectionId,
          treatmentType: "cleaning",
          title: "Surface clean",
          description: "Dry clean",
          performedBy: owner.userId,
          performedAt: Date.UTC(2026, 0, 1),
        }),
      ),
    read: (caller, id) => caller.query(api.conservationTreatments.get, { id }),
  },
  {
    name: "an entry",
    readPermission: "collections.read",
    tier: "free",
    insert: (t, owner) =>
      t.run(async (ctx) => {
        const receivedLocationId = await ctx.db.insert("locations", {
          organizationId: owner.organizationId,
          name: "Receiving room",
          locationCode: "R-650",
          type: "storage",
          sortOrder: 0,
          isActive: true,
        });
        return await ctx.db.insert("objectEntries", {
          organizationId: owner.organizationId,
          entryNumber: "TE-650",
          normalizedEntryNumber: "te-650",
          collectionId: owner.collectionId,
          purpose: "identification",
          depositorName: "Depositor",
          receivedAt: Date.UTC(2026, 0, 1),
          receivedBy: owner.userId,
          receivedLocationId,
          conditionAtEntry: "Stable",
          responsibleUserId: owner.userId,
          status: "in_custody",
        });
      }),
    read: (caller, entryId) => caller.query(api.objectEntries.get, { entryId }),
  },
];

for (const recordCase of detailRecordCases) {
  test(`${recordCase.name} reads as missing to other organizations and for malformed links, and as forbidden to members without ${recordCase.readPermission}`, async () => {
    const t = createConvexTest();
    const owner = await createOrgUserCollectionWithPermissions(
      t,
      [recordCase.readPermission],
      { subscriptionTier: recordCase.tier },
    );
    const outsider = await createOrgUserWithPermissions(
      t,
      [recordCase.readPermission],
      { subscriptionTier: recordCase.tier },
    );
    const recordId = await recordCase.insert(t, owner);
    const member = await addMemberWithoutRead(t, owner.organizationId);

    expect(
      await recordCase.read(authedForUser(t, owner.userId), recordId),
    ).not.toBeNull();
    expect(
      await recordCase.read(authedForUser(t, outsider.userId), recordId),
    ).toBeNull();
    for (const malformed of ["not-a-record", owner.organizationId]) {
      expect(
        await recordCase.read(authedForUser(t, owner.userId), malformed),
      ).toBeNull();
    }
    expect(await refusalOf(recordCase.read(member, recordId))).toBe(
      "permission_missing",
    );
  });
}

for (const recordCase of detailRecordCases.filter(
  (candidate) => candidate.tier === "pro",
)) {
  test(`${recordCase.name} reads as an unavailable feature, not a crash, when the organization's plan lacks it`, async () => {
    const t = createConvexTest();
    const owner = await createOrgUserCollectionWithPermissions(
      t,
      [recordCase.readPermission],
      { subscriptionTier: "free" },
    );
    const outsider = await createOrgUserWithPermissions(
      t,
      [recordCase.readPermission],
      { subscriptionTier: "pro" },
    );
    const recordId = await recordCase.insert(t, owner);

    expect(
      await refusalOf(
        recordCase.read(authedForUser(t, owner.userId), recordId),
      ),
    ).toBe("tier_required");
    expect(
      await recordCase.read(authedForUser(t, outsider.userId), recordId),
    ).toBeNull();
  });
}
