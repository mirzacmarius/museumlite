import { expect, test } from "vitest";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import {
  type PartyErrorData,
  partyErrorFromError,
} from "../convex/utils/partyErrors";
import type { PartyTarget } from "../convex/utils/partyValidators";
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

type Client = ReturnType<typeof authedForUser>;

/** A museum whose accessions go through an approval step, so they start pending. */
async function createMuseum(
  t: ConvexTest,
  permissions: string[] = REGISTRAR_PERMISSIONS,
) {
  const setup = await createOrgUserWithPermissions(t, permissions, {
    subscriptionTier: "pro",
    enabledModules: ["accounts"],
    roleName: "Registrar",
  });
  await t.run(async (ctx) => {
    await ctx.db.insert("workflowConfigs", {
      organizationId: setup.organizationId,
      workflowType: "accession",
      steps: [{ stepNumber: 1, roleId: setup.roleId, name: "Committee" }],
      canInitiateRoles: [setup.roleId],
    });
  });
  return { ...setup, staff: authedForUser(t, setup.userId) };
}

async function insertParty(
  t: ConvexTest,
  organizationId: Id<"organizations">,
  createdBy: Id<"users">,
  fields: {
    businessName?: string;
    firstName?: string;
    lastName?: string;
    holderType?: "organization" | "privatePerson";
    email?: string;
    phone?: string;
    status?: "active" | "archived";
  },
) {
  return await t.run(async (ctx) =>
    ctx.db.insert("accounts", {
      organizationId,
      accountNumber: `ACC-${Math.random().toString(36).slice(2, 7)}`,
      accountType: "institution",
      createdBy,
      createdAt: Date.now(),
      ...fields,
    }),
  );
}

async function partyErrorOf(call: Promise<unknown>): Promise<PartyErrorData> {
  try {
    await call;
  } catch (error) {
    const data = partyErrorFromError(error);
    if (!data) throw error;
    return data;
  }
  throw new Error("Expected the call to be rejected");
}

async function linksFor(client: Client, target: PartyTarget) {
  return (await client.query(api.partyLinks.listForTarget, { target })).links;
}

async function addMember(
  t: ConvexTest,
  organizationId: Id<"organizations">,
  permissions: string[],
  name = "Member",
) {
  const userId = await t.run(async (ctx) => {
    const [userId, roleId] = await Promise.all([
      ctx.db.insert("users", {
        name,
        email: `${name.toLowerCase().replace(/\s+/g, "-")}-${Math.random().toString(36).slice(2, 7)}@example.com`,
      }),
      ctx.db.insert("roles", { organizationId, name, isSystemRole: false }),
    ]);
    for (const permissionName of permissions) {
      const permissionId = await ctx.db.insert("permissions", {
        name: permissionName,
        category: permissionName.split(".")[0] ?? "collections",
      });
      await ctx.db.insert("rolePermissions", { roleId, permissionId });
    }
    await ctx.db.insert("userOrganizations", {
      userId,
      organizationId,
      roleId,
      joinedAt: Date.now(),
    });
    return userId;
  });
  return { userId, client: authedForUser(t, userId) };
}

async function insertObject(
  t: ConvexTest,
  organizationId: Id<"organizations">,
  userId: Id<"users">,
) {
  return await t.run(async (ctx) =>
    ctx.db.insert("collections", {
      organizationId,
      accessionNumber: `OBJ-${Math.random().toString(36).slice(2, 7)}`,
      title: "Disposed vase",
      status: "active",
      catalogedBy: userId,
      catalogedAt: Date.now(),
    }),
  );
}

test("a donor chosen when an accession is created is linked to it and appears in the party's role history", async () => {
  const t = createConvexTest();
  const { organizationId, userId, staff } = await createMuseum(t);
  const donorId = await insertParty(t, organizationId, userId, {
    businessName: "Ada Lovelace",
    holderType: "privatePerson",
    email: "ada@example.org",
  });

  const accessionId = await staff.mutation(api.accessions.create, {
    organizationId,
    accessionNumber: "2026.1",
    dateReceived: Date.UTC(2026, 0, 5),
    source: "Gift of Ada Lovelace",
    donorAccountId: donorId,
    method: "gift",
  });

  expect(
    await staff.query(api.partyLinks.listForTarget, {
      target: { type: "accession", id: accessionId },
    }),
  ).toMatchObject({
    allowedRoles: ["donor", "owner"],
    policy: "open",
    links: [
      {
        role: "donor",
        accountId: donorId,
        partyName: "Ada Lovelace",
        nameSnapshot: "Ada Lovelace",
        assertedName: "Gift of Ada Lovelace",
        contactSnapshot: "ada@example.org",
        effectiveFrom: Date.UTC(2026, 0, 5),
        isCurrent: true,
      },
    ],
  });

  const history = await staff.query(api.partyLinks.listForAccount, {
    accountId: donorId,
    paginationOpts: { numItems: 10, cursor: null },
  });
  expect(history.page).toMatchObject([
    {
      restricted: false,
      role: "donor",
      targetType: "accession",
      targetId: accessionId,
      targetLabel: "2026.1",
      isCurrent: true,
    },
  ]);
});

test("replacing a party supersedes the earlier link and renaming a party keeps the recorded snapshots", async () => {
  const t = createConvexTest();
  const { organizationId, userId, staff } = await createMuseum(t);
  const firstId = await insertParty(t, organizationId, userId, {
    businessName: "Northern Gallery",
    email: "desk@northern.example",
  });
  const secondId = await insertParty(t, organizationId, userId, {
    businessName: "Southern Trust",
  });
  const accessionId = await staff.mutation(api.accessions.create, {
    organizationId,
    accessionNumber: "2026.2",
    dateReceived: Date.UTC(2026, 1, 1),
    source: "Northern Gallery",
    donorAccountId: firstId,
    method: "donation",
  });

  await staff.mutation(api.partyLinks.link, {
    target: { type: "accession", id: accessionId },
    accountId: secondId,
    role: "donor",
    reason: "Deed of gift names the trust",
  });

  const admin = await addMember(
    t,
    organizationId,
    ["accounts.read", "accounts.write", "organization.manage_settings"],
    "Administrator",
  );
  await admin.client.mutation(api.accounts.update, {
    accountId: firstId,
    businessName: "Northern Gallery of Art",
  });

  const links = await linksFor(staff, { type: "accession", id: accessionId });
  expect(links).toMatchObject([
    { accountId: secondId, nameSnapshot: "Southern Trust", isCurrent: true },
    {
      accountId: firstId,
      partyName: "Northern Gallery of Art",
      nameSnapshot: "Northern Gallery",
      contactSnapshot: "desk@northern.example",
      isCurrent: false,
      supersessionReason: "Deed of gift names the trust",
    },
  ]);
  expect(links[1]?.supersededAt).toEqual(expect.any(Number));
  // The replacement does not inherit the earlier donor's name on the record.
  expect(links[0]?.assertedName).toBeUndefined();

  const firstHistory = await staff.query(api.partyLinks.listForAccount, {
    accountId: firstId,
    paginationOpts: { numItems: 10, cursor: null },
  });
  expect(firstHistory.page).toMatchObject([
    { role: "donor", nameSnapshot: "Northern Gallery", isCurrent: false },
  ]);
});

test("linking or ending the lender of a pending loan keeps the loan's account and name in step", async () => {
  const t = createConvexTest();
  const { organizationId, userId, staff } = await createMuseum(t);
  const firstId = await insertParty(t, organizationId, userId, {
    businessName: "First Lender",
  });
  const secondId = await insertParty(t, organizationId, userId, {
    businessName: "Second Lender",
    email: "second@lender.example",
  });
  const loanId = await staff.mutation(api.loans.create, {
    organizationId,
    type: "incoming",
    accountId: firstId,
    lenderBorrowerName: "First Lender",
    startDate: Date.UTC(2026, 2, 1),
  });

  await staff.mutation(api.partyLinks.link, {
    target: { type: "loan", id: loanId },
    accountId: secondId,
    role: "lender",
    reason: "Agreement signed by the second lender",
  });
  expect(await staff.query(api.loans.get, { loanId })).toMatchObject({
    accountId: secondId,
    lenderBorrowerName: "Second Lender",
    lenderBorrowerContact: "second@lender.example",
  });

  const [current] = await linksFor(staff, { type: "loan", id: loanId });
  if (!current) throw new Error("Expected a current lender link");
  await staff.mutation(api.partyLinks.supersede, {
    linkId: current._id,
    reason: "Lender withdrew",
  });
  const loan = await staff.query(api.loans.get, { loanId });
  expect(loan?.accountId).toBeUndefined();
  expect(loan?.lenderBorrowerName).toBe("Second Lender");
});

test("an approved accession only accepts a first link that agrees with it", async () => {
  const t = createConvexTest();
  const { organizationId, userId, staff } = await createMuseum(t);
  const recordedId = await insertParty(t, organizationId, userId, {
    businessName: "Recorded Donor",
  });
  const otherId = await insertParty(t, organizationId, userId, {
    businessName: "Other Donor",
  });
  const accessionId = await t.run(async (ctx) =>
    ctx.db.insert("accessions", {
      organizationId,
      accessionNumber: "1990.1",
      dateReceived: Date.UTC(1990, 0, 1),
      source: "Recorded Donor family",
      donorAccountId: recordedId,
      method: "gift",
      status: "approved",
    }),
  );
  const target = { type: "accession" as const, id: accessionId };

  expect(
    await staff.query(api.partyLinks.listForTarget, { target }),
  ).toMatchObject({ policy: "firstLinkOnly", links: [] });
  expect(
    await partyErrorOf(
      staff.mutation(api.partyLinks.link, {
        target,
        accountId: otherId,
        role: "donor",
      }),
    ),
  ).toMatchObject({ code: "PARTY_RECORD_LOCKED" });

  await staff.mutation(api.partyLinks.link, {
    target,
    accountId: recordedId,
    role: "donor",
  });
  const [link] = await linksFor(staff, target);
  expect(link).toMatchObject({
    accountId: recordedId,
    assertedName: "Recorded Donor family",
    isCurrent: true,
  });
  if (!link) throw new Error("Expected the confirmed link");
  expect(
    await partyErrorOf(
      staff.mutation(api.partyLinks.link, {
        target,
        accountId: otherId,
        role: "donor",
      }),
    ),
  ).toMatchObject({ code: "PARTY_RECORD_LOCKED" });
  expect(
    await partyErrorOf(
      staff.mutation(api.partyLinks.supersede, {
        linkId: link._id,
        reason: "Not allowed on approved records",
      }),
    ),
  ).toMatchObject({ code: "PARTY_RECORD_LOCKED" });
});

test("a deaccession recipient is only linked once its exit is recorded", async () => {
  const t = createConvexTest();
  const { organizationId, userId, staff } = await createMuseum(t);
  const partyId = await insertParty(t, organizationId, userId, {
    businessName: "Early Recipient",
  });
  const collectionId = await insertObject(t, organizationId, userId);
  const deaccessionId = await t.run(async (ctx) =>
    ctx.db.insert("deaccessions", {
      organizationId,
      collectionId,
      deaccessionNumber: "D-2026-009",
      dateDeaccessioned: Date.UTC(2026, 4, 1),
      reason: "Pending review",
      method: "transfer",
      status: "pending",
    }),
  );

  expect(
    await staff.query(api.partyLinks.listForTarget, {
      target: { type: "deaccession", id: deaccessionId },
    }),
  ).toMatchObject({ policy: "closed" });
  expect(
    await partyErrorOf(
      staff.mutation(api.partyLinks.link, {
        target: { type: "deaccession", id: deaccessionId },
        accountId: partyId,
        role: "recipient",
      }),
    ),
  ).toMatchObject({ code: "PARTY_RECORD_LOCKED" });
});

test("linking the same party again is a harmless retry that keeps one current link", async () => {
  const t = createConvexTest();
  const { organizationId, userId, staff } = await createMuseum(t);
  const partyId = await insertParty(t, organizationId, userId, {
    businessName: "Repeat Lender",
  });
  const loanId = await staff.mutation(api.loans.create, {
    organizationId,
    type: "incoming",
    accountId: partyId,
    lenderBorrowerName: "Repeat Lender",
    startDate: Date.UTC(2026, 2, 1),
  });

  const first = await staff.mutation(api.partyLinks.link, {
    target: { type: "loan", id: loanId },
    accountId: partyId,
    role: "lender",
  });
  const second = await staff.mutation(api.partyLinks.link, {
    target: { type: "loan", id: loanId },
    accountId: partyId,
    role: "lender",
  });

  expect(second).toBe(first);
  expect(await linksFor(staff, { type: "loan", id: loanId })).toMatchObject([
    {
      role: "lender",
      accountId: partyId,
      nameSnapshot: "Repeat Lender",
      effectiveFrom: Date.UTC(2026, 2, 1),
      isCurrent: true,
    },
  ]);
});

test("a borrower chosen for an outgoing loan is linked while the loan keeps its own name and contact snapshot", async () => {
  const t = createConvexTest();
  const { organizationId, userId, staff } = await createMuseum(t);
  const borrowerId = await insertParty(t, organizationId, userId, {
    businessName: "City Museum",
    email: "loans@city.example",
  });

  const loanId = await staff.mutation(api.loans.create, {
    organizationId,
    type: "outgoing",
    accountId: borrowerId,
    lenderBorrowerName: "City Museum (Registrar)",
    lenderBorrowerContact: "loans@city.example",
    startDate: Date.UTC(2026, 3, 1),
    endDate: Date.UTC(2026, 9, 1),
  });

  expect(await staff.query(api.loans.get, { loanId })).toMatchObject({
    accountId: borrowerId,
    lenderBorrowerName: "City Museum (Registrar)",
    lenderBorrowerContact: "loans@city.example",
  });
  expect(
    await staff.query(api.partyLinks.listForTarget, {
      target: { type: "loan", id: loanId },
    }),
  ).toMatchObject({
    allowedRoles: ["borrower"],
    links: [
      {
        role: "borrower",
        accountId: borrowerId,
        nameSnapshot: "City Museum",
        assertedName: "City Museum (Registrar)",
        effectiveFrom: Date.UTC(2026, 3, 1),
        effectiveTo: Date.UTC(2026, 9, 1),
        isCurrent: true,
      },
    ],
  });
});

test("a secondary role does not borrow the record's donor name as its named assertion", async () => {
  const t = createConvexTest();
  const { organizationId, userId, staff } = await createMuseum(t);
  const ownerId = await insertParty(t, organizationId, userId, {
    businessName: "Museum Trust",
  });
  const accessionId = await staff.mutation(api.accessions.create, {
    organizationId,
    accessionNumber: "2026.4",
    dateReceived: Date.UTC(2026, 0, 1),
    source: "Jane Doe (donor)",
    method: "gift",
  });

  await staff.mutation(api.partyLinks.link, {
    target: { type: "accession", id: accessionId },
    accountId: ownerId,
    role: "owner",
  });

  const [owner] = await linksFor(staff, { type: "accession", id: accessionId });
  expect(owner).toMatchObject({ role: "owner", nameSnapshot: "Museum Trust" });
  expect(owner?.assertedName).toBeUndefined();
});

test("a role that does not fit the record is rejected with a stable code", async () => {
  const t = createConvexTest();
  const { organizationId, userId, staff } = await createMuseum(t);
  const partyId = await insertParty(t, organizationId, userId, {
    businessName: "Valuation House",
  });
  const accessionId = await staff.mutation(api.accessions.create, {
    organizationId,
    accessionNumber: "2026.3",
    dateReceived: Date.UTC(2026, 0, 1),
    source: "Field collection",
    method: "other",
  });
  const outgoingLoanId = await staff.mutation(api.loans.create, {
    organizationId,
    type: "outgoing",
    lenderBorrowerName: "Somewhere",
    startDate: Date.UTC(2026, 0, 1),
  });

  expect(
    await partyErrorOf(
      staff.mutation(api.partyLinks.link, {
        target: { type: "accession", id: accessionId },
        accountId: partyId,
        role: "appraiser",
      }),
    ),
  ).toMatchObject({ code: "PARTY_ROLE_NOT_ALLOWED" });
  expect(
    await partyErrorOf(
      staff.mutation(api.partyLinks.link, {
        target: { type: "loan", id: outgoingLoanId },
        accountId: partyId,
        role: "lender",
      }),
    ),
  ).toMatchObject({ code: "PARTY_ROLE_NOT_ALLOWED" });
  expect(await linksFor(staff, { type: "accession", id: accessionId })).toEqual(
    [],
  );
});

async function createTwoMuseums(t: ConvexTest) {
  const home = await createMuseum(t);
  const foreign = await createMuseum(t);
  const [homePartyId, foreignPartyId] = await Promise.all([
    insertParty(t, home.organizationId, home.userId, {
      businessName: "Home Donor",
    }),
    insertParty(t, foreign.organizationId, foreign.userId, {
      businessName: "Foreign Donor",
    }),
  ]);
  const [homeAccessionId, foreignAccessionId] = await Promise.all([
    home.staff.mutation(api.accessions.create, {
      organizationId: home.organizationId,
      accessionNumber: "H.1",
      dateReceived: Date.UTC(2026, 0, 1),
      source: "Home source",
      method: "gift",
    }),
    foreign.staff.mutation(api.accessions.create, {
      organizationId: foreign.organizationId,
      accessionNumber: "F.1",
      dateReceived: Date.UTC(2026, 0, 1),
      source: "Foreign source",
      method: "gift",
    }),
  ]);
  return {
    home,
    foreign,
    homePartyId,
    foreignPartyId,
    homeAccessionId,
    foreignAccessionId,
  };
}

test("a party from another organization cannot be linked from any position", async () => {
  const t = createConvexTest();
  const fixture = await createTwoMuseums(t);
  const { home } = fixture;

  // Foreign party on a home record: rejected without revealing it exists.
  expect(
    await partyErrorOf(
      home.staff.mutation(api.partyLinks.link, {
        target: { type: "accession", id: fixture.homeAccessionId },
        accountId: fixture.foreignPartyId,
        role: "donor",
      }),
    ),
  ).toMatchObject({ code: "PARTY_NOT_FOUND" });
  // Home party on a foreign record: the record's own permission fails first.
  await expect(
    home.staff.mutation(api.partyLinks.link, {
      target: { type: "accession", id: fixture.foreignAccessionId },
      accountId: fixture.homePartyId,
      role: "donor",
    }),
  ).rejects.toThrow("Permission denied");
  // Both foreign.
  await expect(
    home.staff.mutation(api.partyLinks.link, {
      target: { type: "accession", id: fixture.foreignAccessionId },
      accountId: fixture.foreignPartyId,
      role: "donor",
    }),
  ).rejects.toThrow("Permission denied");
  // Procedure flows reject foreign parties too.
  expect(
    await partyErrorOf(
      home.staff.mutation(api.accessions.create, {
        organizationId: home.organizationId,
        accessionNumber: "H.2",
        dateReceived: Date.UTC(2026, 0, 2),
        source: "Someone",
        donorAccountId: fixture.foreignPartyId,
        method: "gift",
      }),
    ),
  ).toMatchObject({ code: "PARTY_NOT_FOUND" });
  expect(
    await partyErrorOf(
      home.staff.mutation(api.loans.create, {
        organizationId: home.organizationId,
        type: "incoming",
        accountId: fixture.foreignPartyId,
        lenderBorrowerName: "Foreign Donor",
        startDate: Date.UTC(2026, 0, 2),
      }),
    ),
  ).toMatchObject({ code: "PARTY_NOT_FOUND" });
  await expect(
    home.staff.query(api.partyLinks.listForTarget, {
      target: { type: "accession", id: fixture.foreignAccessionId },
    }),
  ).rejects.toThrow("Permission denied");
  await expect(
    home.staff.query(api.partyLinks.listForAccount, {
      accountId: fixture.foreignPartyId,
      paginationOpts: { numItems: 10, cursor: null },
    }),
  ).rejects.toThrow("Permission denied");
});

test("archived parties cannot be linked", async () => {
  const t = createConvexTest();
  const { organizationId, userId, staff } = await createMuseum(t);
  const archivedId = await insertParty(t, organizationId, userId, {
    businessName: "Closed Foundation",
    status: "archived",
  });

  expect(
    await partyErrorOf(
      staff.mutation(api.accessions.create, {
        organizationId,
        accessionNumber: "2026.9",
        dateReceived: Date.UTC(2026, 0, 1),
        source: "Closed Foundation",
        donorAccountId: archivedId,
        method: "gift",
      }),
    ),
  ).toMatchObject({ code: "PARTY_ARCHIVED" });
});

test("linking requires the record's own write permission and accounts.read", async () => {
  const t = createConvexTest();
  const { organizationId, userId, staff } = await createMuseum(t);
  const partyId = await insertParty(t, organizationId, userId, {
    businessName: "Permission Donor",
  });
  const accessionId = await staff.mutation(api.accessions.create, {
    organizationId,
    accessionNumber: "2026.10",
    dateReceived: Date.UTC(2026, 0, 1),
    source: "Permission Donor",
    method: "gift",
  });
  const loanId = await staff.mutation(api.loans.create, {
    organizationId,
    type: "incoming",
    lenderBorrowerName: "Permission Donor",
    startDate: Date.UTC(2026, 0, 1),
  });
  const viewer = await addMember(
    t,
    organizationId,
    ["collections.read", "loans.read", "accounts.read"],
    "Viewer",
  );
  const cataloger = await addMember(
    t,
    organizationId,
    ["collections.read", "collections.update", "accounts.read"],
    "Cataloger",
  );
  const noAccounts = await addMember(
    t,
    organizationId,
    ["collections.read", "collections.update"],
    "Collections Only",
  );
  const accessionLink = {
    target: { type: "accession" as const, id: accessionId },
    accountId: partyId,
    role: "donor" as const,
  };

  await expect(
    viewer.client.mutation(api.partyLinks.link, accessionLink),
  ).rejects.toThrow("Permission denied: collections.update");
  await expect(
    cataloger.client.mutation(api.partyLinks.link, {
      target: { type: "loan", id: loanId },
      accountId: partyId,
      role: "lender",
    }),
  ).rejects.toThrow("Permission denied: loans.update");
  await expect(
    noAccounts.client.mutation(api.partyLinks.link, accessionLink),
  ).rejects.toThrow("Permission denied: accounts.read");
  await expect(t.mutation(api.partyLinks.link, accessionLink)).rejects.toThrow(
    "Not authenticated",
  );

  const outsider = await createMuseum(t);
  await expect(
    outsider.staff.mutation(api.partyLinks.link, accessionLink),
  ).rejects.toThrow("Permission denied");
  await expect(
    t.query(api.partyLinks.listForTarget, {
      target: { type: "accession", id: accessionId },
    }),
  ).rejects.toThrow("Permission denied");

  // The cataloger may link the accession donor; the viewer may read it.
  await cataloger.client.mutation(api.partyLinks.link, accessionLink);
  expect(
    await linksFor(viewer.client, { type: "accession", id: accessionId }),
  ).toMatchObject([{ accountId: partyId, role: "donor", isCurrent: true }]);
});

test("role history hides details of records the reader may not open", async () => {
  const t = createConvexTest();
  const { organizationId, userId, staff } = await createMuseum(t);
  const partyId = await insertParty(t, organizationId, userId, {
    businessName: "Private Lender",
    email: "private@lender.example",
  });
  await staff.mutation(api.loans.create, {
    organizationId,
    type: "incoming",
    accountId: partyId,
    lenderBorrowerName: "Private Lender (estate)",
    startDate: Date.UTC(2026, 5, 1),
  });
  const accountsOnly = await addMember(
    t,
    organizationId,
    ["accounts.read"],
    "Accounts Reader",
  );

  const history = await accountsOnly.client.query(
    api.partyLinks.listForAccount,
    { accountId: partyId, paginationOpts: { numItems: 10, cursor: null } },
  );
  expect(history.page).toEqual([
    {
      _id: expect.any(String),
      restricted: true,
      role: "lender",
      targetType: "loan",
      isCurrent: true,
    },
  ]);
});

test("party links need the accounts module", async () => {
  const t = createConvexTest();
  const { organizationId, userId } = await createOrgUserWithPermissions(
    t,
    REGISTRAR_PERMISSIONS,
    { subscriptionTier: "pro", enabledModules: [] },
  );
  const staff = authedForUser(t, userId);
  const partyId = await insertParty(t, organizationId, userId, {
    businessName: "Module Donor",
  });

  await expect(
    staff.mutation(api.accessions.create, {
      organizationId,
      accessionNumber: "2026.11",
      dateReceived: Date.UTC(2026, 0, 1),
      source: "Module Donor",
      donorAccountId: partyId,
      method: "gift",
    }),
  ).rejects.toThrow("Module not enabled: accounts");
});

test("ending a link keeps it in the record history, clears the record's donor and cannot be repeated", async () => {
  const t = createConvexTest();
  const { organizationId, userId, staff } = await createMuseum(t);
  const partyId = await insertParty(t, organizationId, userId, {
    businessName: "Ended Donor",
  });
  const accessionId = await staff.mutation(api.accessions.create, {
    organizationId,
    accessionNumber: "2026.12",
    dateReceived: Date.UTC(2026, 0, 1),
    source: "Ended Donor",
    donorAccountId: partyId,
    method: "gift",
  });
  const target = { type: "accession" as const, id: accessionId };
  const [link] = await linksFor(staff, target);
  if (!link) throw new Error("Expected a donor link");

  await staff.mutation(api.partyLinks.supersede, {
    linkId: link._id,
    reason: "Recorded in error",
  });

  expect(await linksFor(staff, target)).toMatchObject([
    {
      _id: link._id,
      isCurrent: false,
      supersessionReason: "Recorded in error",
    },
  ]);
  // The record no longer references the party, so nothing brings it back.
  const legacy = await staff.query(api.partyLinks.listLegacyLinks, {
    organizationId,
    kind: "accession",
    paginationOpts: { numItems: 25, cursor: null },
  });
  expect(legacy.items).toEqual([]);
  expect(
    await partyErrorOf(
      staff.mutation(api.partyLinks.supersede, {
        linkId: link._id,
        reason: "Again",
      }),
    ),
  ).toMatchObject({ code: "PARTY_LINK_ALREADY_SUPERSEDED" });
});

async function insertApprovedDisposal(
  t: ConvexTest,
  organizationId: Id<"organizations">,
  userId: Id<"users">,
) {
  const collectionId = await insertObject(t, organizationId, userId);
  return await t.run(async (ctx) =>
    ctx.db.insert("deaccessions", {
      organizationId,
      collectionId,
      deaccessionNumber: "D-2026-001",
      dateDeaccessioned: Date.UTC(2026, 4, 1),
      reason: "Transfer to a better home",
      method: "transfer",
      status: "approved",
      approvedBy: userId,
      approvedAt: Date.UTC(2026, 4, 1),
    }),
  );
}

test("the recipient chosen when an exit is recorded is linked and the exit keeps the recipient as written", async () => {
  const t = createConvexTest();
  const { organizationId, userId, staff } = await createMuseum(t);
  const recipientId = await insertParty(t, organizationId, userId, {
    businessName: "Regional Heritage Trust",
  });
  const deaccessionId = await insertApprovedDisposal(t, organizationId, userId);

  await staff.mutation(api.deaccessions.recordExit, {
    deaccessionId,
    exitDate: Date.UTC(2026, 4, 10),
    recipient: "Regional Heritage Trust, collections desk",
    recipientAccountId: recipientId,
  });

  const stages = await staff.query(api.deaccessions.getDisposalStages, {
    deaccessionId,
  });
  expect(stages?.exit.record?.recipient).toBe(
    "Regional Heritage Trust, collections desk",
  );
  expect(
    await staff.query(api.partyLinks.listForTarget, {
      target: { type: "deaccession", id: deaccessionId },
    }),
  ).toMatchObject({
    policy: "firstLinkOnly",
    links: [
      {
        role: "recipient",
        accountId: recipientId,
        nameSnapshot: "Regional Heritage Trust",
        assertedName: "Regional Heritage Trust, collections desk",
        effectiveFrom: Date.UTC(2026, 4, 10),
        isCurrent: true,
      },
    ],
  });
});

test("correcting an exit keeps the recipient link in step with the corrected record", async () => {
  const t = createConvexTest();
  const { organizationId, userId, staff } = await createMuseum(t);
  const recipientId = await insertParty(t, organizationId, userId, {
    businessName: "Harbour Museum",
  });
  const deaccessionId = await insertApprovedDisposal(t, organizationId, userId);
  const target = { type: "deaccession" as const, id: deaccessionId };
  await staff.mutation(api.deaccessions.recordExit, {
    deaccessionId,
    exitDate: Date.UTC(2026, 0, 1),
    recipient: "Harbour Museum",
    recipientAccountId: recipientId,
  });

  // A corrected date with the same recipient re-records the link's dates.
  await staff.mutation(api.deaccessions.recordExit, {
    deaccessionId,
    exitDate: Date.UTC(2026, 1, 1),
    recipient: "Harbour Museum",
    correctionReason: "Collection date was in February",
  });
  expect(await linksFor(staff, target)).toMatchObject([
    {
      accountId: recipientId,
      effectiveFrom: Date.UTC(2026, 1, 1),
      isCurrent: true,
    },
    {
      accountId: recipientId,
      effectiveFrom: Date.UTC(2026, 0, 1),
      isCurrent: false,
      supersessionReason: "Collection date was in February",
    },
  ]);

  // A different recipient written without a party ends the typed link.
  await staff.mutation(api.deaccessions.recordExit, {
    deaccessionId,
    exitDate: Date.UTC(2026, 1, 1),
    recipient: "City Archive",
    correctionReason: "Object went to the archive instead",
  });
  const links = await linksFor(staff, target);
  expect(links.filter((link) => link.isCurrent)).toEqual([]);
  expect(links[0]).toMatchObject({
    supersessionReason: "Object went to the archive instead",
  });
});

test("an appraiser party is linked to an appraisal through its target type", async () => {
  const t = createConvexTest();
  const { organizationId, userId, staff } = await createMuseum(t);
  const appraiserId = await insertParty(t, organizationId, userId, {
    businessName: "Independent Valuer Ltd",
  });
  const collectionId = await insertObject(t, organizationId, userId);
  const appraisalId = await t.run(async (ctx) =>
    ctx.db.insert("appraisals", {
      organizationId,
      collectionId,
      appraisalDate: Date.UTC(2025, 10, 1),
      appraiserName: "J. Valuer",
      appraiserCompany: "Independent Valuer Ltd",
      appraisalType: "insurance",
      value: 5000,
      currency: "EUR",
      createdBy: userId,
      createdAt: Date.now(),
    }),
  );

  await staff.mutation(api.partyLinks.link, {
    target: { type: "appraisal", id: appraisalId },
    accountId: appraiserId,
    role: "appraiser",
  });

  expect(
    await linksFor(staff, { type: "appraisal", id: appraisalId }),
  ).toMatchObject([
    {
      role: "appraiser",
      nameSnapshot: "Independent Valuer Ltd",
      assertedName: "J. Valuer",
      effectiveFrom: Date.UTC(2025, 10, 1),
    },
  ]);
  expect(
    await partyErrorOf(
      staff.mutation(api.partyLinks.link, {
        target: { type: "appraisal", id: appraisalId },
        accountId: appraiserId,
        role: "donor",
      }),
    ),
  ).toMatchObject({ code: "PARTY_ROLE_NOT_ALLOWED" });
});
