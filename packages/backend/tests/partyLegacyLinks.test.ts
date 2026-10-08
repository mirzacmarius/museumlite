import { expect, test } from "vitest";
import { api, internal } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import {
  authedForUser,
  type ConvexTest,
  createConvexTest,
  createOrgUserWithPermissions,
} from "./testHarness";

const REGISTRAR_PERMISSIONS = [
  "collections.create",
  "collections.read",
  "collections.update",
  "loans.create",
  "loans.read",
  "loans.update",
  "accounts.read",
  "accounts.write",
];

async function createMuseum(
  t: ConvexTest,
  permissions: string[] = REGISTRAR_PERMISSIONS,
) {
  const setup = await createOrgUserWithPermissions(t, permissions, {
    subscriptionTier: "pro",
    enabledModules: ["accounts"],
  });
  return { ...setup, staff: authedForUser(t, setup.userId) };
}

const page = { numItems: 25, cursor: null };

async function seedLegacyRecords(
  t: ConvexTest,
  organizationId: Id<"organizations">,
  userId: Id<"users">,
) {
  return await t.run(async (ctx) => {
    const partyId = await ctx.db.insert("accounts", {
      organizationId,
      accountNumber: "ACC-00001",
      accountType: "lender",
      businessName: "Holm Family Collection",
      email: "holm@example.org",
      createdBy: userId,
      createdAt: Date.UTC(2010, 0, 1),
    });
    const nameOnlyAccessionId = await ctx.db.insert("accessions", {
      organizationId,
      accessionNumber: "1987.4",
      dateReceived: Date.UTC(1987, 4, 1),
      source: "Mrs. Edith Holm",
      method: "gift",
      status: "approved",
    });
    const idOnlyAccessionId = await ctx.db.insert("accessions", {
      organizationId,
      accessionNumber: "1999.2",
      dateReceived: Date.UTC(1999, 1, 1),
      source: "Holm family",
      donorAccountId: partyId,
      method: "gift",
      status: "approved",
    });
    const nameOnlyLoanId = await ctx.db.insert("loans", {
      organizationId,
      loanNumber: "L-2001-1",
      type: "incoming",
      lenderBorrowerName: "Old Lender Ltd",
      lenderBorrowerContact: "old@lender.example",
      startDate: Date.UTC(2001, 0, 1),
      status: "returned",
    });
    const idOnlyLoanId = await ctx.db.insert("loans", {
      organizationId,
      loanNumber: "L-2005-3",
      type: "incoming",
      accountId: partyId,
      lenderBorrowerName: "Holm Family Collection",
      startDate: Date.UTC(2005, 0, 1),
      status: "returned",
    });
    const collectionId = await ctx.db.insert("collections", {
      organizationId,
      accessionNumber: "OBJ-1",
      title: "Sold chair",
      status: "deaccessioned",
      catalogedBy: userId,
      catalogedAt: Date.UTC(2000, 0, 1),
    });
    const deaccessionId = await ctx.db.insert("deaccessions", {
      organizationId,
      collectionId,
      deaccessionNumber: "D-2012-2",
      dateDeaccessioned: Date.UTC(2012, 0, 1),
      reason: "Duplicate",
      method: "sale",
      status: "approved",
      exitRecord: {
        exitDate: Date.UTC(2012, 1, 1),
        recipient: "Antique Dealer AS",
        recordedBy: userId,
        recordedAt: Date.UTC(2012, 1, 1),
      },
    });
    return {
      partyId,
      nameOnlyAccessionId,
      idOnlyAccessionId,
      nameOnlyLoanId,
      idOnlyLoanId,
      deaccessionId,
    };
  });
}

test("the legacy review lists name-only and unlinked records and drops each once staff link a party", async () => {
  const t = createConvexTest();
  const { organizationId, userId, staff } = await createMuseum(t);
  const seeded = await seedLegacyRecords(t, organizationId, userId);
  await staff.mutation(api.accessions.create, {
    organizationId,
    accessionNumber: "2026.1",
    dateReceived: Date.UTC(2026, 0, 1),
    source: "Holm Family Collection",
    donorAccountId: seeded.partyId,
    method: "gift",
  });

  const accessions = await staff.query(api.partyLinks.listLegacyLinks, {
    organizationId,
    kind: "accession",
    paginationOpts: page,
  });
  expect(accessions.items).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        targetType: "accession",
        targetId: seeded.nameOnlyAccessionId,
        label: "1987.4",
        assertedName: "Mrs. Edith Holm",
        suggestedRole: "donor",
        existingParty: null,
      }),
      expect.objectContaining({
        targetId: seeded.idOnlyAccessionId,
        assertedName: "Holm family",
        existingParty: expect.objectContaining({ _id: seeded.partyId }),
      }),
    ]),
  );
  expect(accessions.items).toHaveLength(2);

  const loans = await staff.query(api.partyLinks.listLegacyLinks, {
    organizationId,
    kind: "loan",
    paginationOpts: page,
  });
  expect(loans.items).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        targetId: seeded.nameOnlyLoanId,
        assertedName: "Old Lender Ltd",
        contact: "old@lender.example",
        suggestedRole: "lender",
        existingParty: null,
      }),
      expect.objectContaining({
        targetId: seeded.idOnlyLoanId,
        existingParty: expect.objectContaining({ _id: seeded.partyId }),
      }),
    ]),
  );

  const deaccessions = await staff.query(api.partyLinks.listLegacyLinks, {
    organizationId,
    kind: "deaccession",
    paginationOpts: page,
  });
  expect(deaccessions.items).toMatchObject([
    {
      targetId: seeded.deaccessionId,
      label: "D-2012-2",
      assertedName: "Antique Dealer AS",
      suggestedRole: "recipient",
    },
  ]);

  await staff.mutation(api.partyLinks.link, {
    target: { type: "accession", id: seeded.nameOnlyAccessionId },
    accountId: seeded.partyId,
    role: "donor",
    assertedName: "Mrs. Edith Holm",
  });

  const after = await staff.query(api.partyLinks.listLegacyLinks, {
    organizationId,
    kind: "accession",
    paginationOpts: page,
  });
  expect(after.items.map((item) => item.targetId)).toEqual([
    seeded.idOnlyAccessionId,
  ]);
  expect(
    await staff.query(api.partyLinks.listForTarget, {
      target: { type: "accession", id: seeded.nameOnlyAccessionId },
    }),
  ).toMatchObject([
    {
      nameSnapshot: "Holm Family Collection",
      assertedName: "Mrs. Edith Holm",
      effectiveFrom: Date.UTC(1987, 4, 1),
    },
  ]);
});

test("the legacy review follows each record type's read permission", async () => {
  const t = createConvexTest();
  const { organizationId, userId } = await createMuseum(t);
  await seedLegacyRecords(t, organizationId, userId);
  const collectionsOnly = await t.run(async (ctx) => {
    const memberId = await ctx.db.insert("users", { name: "Curator" });
    const roleId = await ctx.db.insert("roles", {
      organizationId,
      name: "Curator",
      isSystemRole: false,
    });
    for (const name of ["collections.read", "accounts.read"]) {
      const permissionId = await ctx.db.insert("permissions", {
        name,
        category: name.split(".")[0] ?? "collections",
      });
      await ctx.db.insert("rolePermissions", { roleId, permissionId });
    }
    await ctx.db.insert("userOrganizations", {
      userId: memberId,
      organizationId,
      roleId,
      joinedAt: Date.now(),
    });
    return memberId;
  });
  const curator = authedForUser(t, collectionsOnly);
  const outsider = await createMuseum(t);

  expect(
    (
      await curator.query(api.partyLinks.listLegacyLinks, {
        organizationId,
        kind: "accession",
        paginationOpts: page,
      })
    ).items,
  ).toHaveLength(2);
  await expect(
    curator.query(api.partyLinks.listLegacyLinks, {
      organizationId,
      kind: "loan",
      paginationOpts: page,
    }),
  ).rejects.toThrow("Permission denied: loans.read");
  await expect(
    outsider.staff.query(api.partyLinks.listLegacyLinks, {
      organizationId,
      kind: "accession",
      paginationOpts: page,
    }),
  ).rejects.toThrow("Permission denied");
  await expect(
    t.query(api.partyLinks.listLegacyLinks, {
      organizationId,
      kind: "accession",
      paginationOpts: page,
    }),
  ).rejects.toThrow("Permission denied");
});

test("the owner-approved backfill links existing account references once and leaves name-only records for review", async () => {
  const t = createConvexTest();
  const { organizationId, userId, staff } = await createMuseum(t);
  const seeded = await seedLegacyRecords(t, organizationId, userId);

  const accessionRun = await t.mutation(
    internal.partyLinks.backfillFromAccountFields,
    { organizationId, kind: "accession", cursor: null },
  );
  const loanRun = await t.mutation(
    internal.partyLinks.backfillFromAccountFields,
    { organizationId, kind: "loan", cursor: null },
  );
  expect(accessionRun).toMatchObject({ created: 1, isDone: true });
  expect(loanRun).toMatchObject({ created: 1, isDone: true });

  expect(
    await staff.query(api.partyLinks.listForTarget, {
      target: { type: "accession", id: seeded.idOnlyAccessionId },
    }),
  ).toMatchObject([
    {
      role: "donor",
      accountId: seeded.partyId,
      origin: "backfill",
      nameSnapshot: "Holm Family Collection",
      assertedName: "Holm family",
      effectiveFrom: Date.UTC(1999, 1, 1),
    },
  ]);
  expect(
    await staff.query(api.partyLinks.listForTarget, {
      target: { type: "loan", id: seeded.idOnlyLoanId },
    }),
  ).toMatchObject([{ role: "lender", origin: "backfill" }]);

  const rerun = await t.mutation(
    internal.partyLinks.backfillFromAccountFields,
    { organizationId, kind: "accession", cursor: null },
  );
  expect(rerun).toMatchObject({ created: 0 });

  const remaining = await staff.query(api.partyLinks.listLegacyLinks, {
    organizationId,
    kind: "accession",
    paginationOpts: page,
  });
  expect(remaining.items.map((item) => item.targetId)).toEqual([
    seeded.nameOnlyAccessionId,
  ]);
});
