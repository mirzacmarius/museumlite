import { expect, test } from "vitest";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import { partyErrorFromError } from "../convex/utils/partyErrors";
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
  "accounts.read",
  "accounts.write",
];

async function createMuseum(
  t: ConvexTest,
  permissions: string[] = REGISTRAR_PERMISSIONS,
) {
  const setup = await createOrgUserWithPermissions(t, permissions, {
    enabledModules: ["accounts"],
    roleName: "Collection Manager",
  });
  return { ...setup, staff: authedForUser(t, setup.userId) };
}

async function insertAccount(
  t: ConvexTest,
  organizationId: Id<"organizations">,
  createdBy: Id<"users">,
  fields: {
    businessName?: string;
    firstName?: string;
    lastName?: string;
    holderType?: "organization" | "privatePerson";
    accountType?: "institution" | "patron";
    email?: string;
    status?: "active" | "archived";
  },
) {
  return await t.run(async (ctx) =>
    ctx.db.insert("accounts", {
      organizationId,
      accountNumber: `ACC-${Math.random().toString(36).slice(2, 7)}`,
      accountType: fields.accountType ?? "institution",
      createdBy,
      createdAt: Date.now(),
      ...fields,
    }),
  );
}

test("staff with accounts.write create people and institutions from a procedure picker without administration rights", async () => {
  const t = createConvexTest();
  const { organizationId, staff } = await createMuseum(t);

  const person = await staff.mutation(api.parties.create, {
    organizationId,
    holderType: "privatePerson",
    name: "  Grace Hopper ",
    email: "grace@example.org",
  });
  const institution = await staff.mutation(api.parties.create, {
    organizationId,
    holderType: "organization",
    name: "Harbour Maritime Museum",
    contactPerson: "Registrar",
  });

  expect(
    await staff.query(api.parties.get, { accountId: person.accountId }),
  ).toMatchObject({
    _id: person.accountId,
    displayName: "Grace Hopper",
    holderType: "privatePerson",
    email: "grace@example.org",
    archived: false,
  });
  expect(
    await staff.query(api.parties.get, { accountId: institution.accountId }),
  ).toMatchObject({
    displayName: "Harbour Maritime Museum",
    holderType: "organization",
    contactPerson: "Registrar",
  });
});

test("creating a party needs accounts.write and a name", async () => {
  const t = createConvexTest();
  const { organizationId, staff } = await createMuseum(t);
  const viewer = await createOrgUserWithPermissions(t, ["accounts.read"], {
    enabledModules: ["accounts"],
  });

  await expect(
    authedForUser(t, viewer.userId).mutation(api.parties.create, {
      organizationId: viewer.organizationId,
      holderType: "privatePerson",
      name: "Not Allowed",
    }),
  ).rejects.toThrow("Permission denied: accounts.write");
  await expect(
    staff.mutation(api.parties.create, {
      organizationId: viewer.organizationId,
      holderType: "privatePerson",
      name: "Wrong Organization",
    }),
  ).rejects.toThrow("Permission denied");
  await expect(
    t.mutation(api.parties.create, {
      organizationId,
      holderType: "privatePerson",
      name: "Anonymous",
    }),
  ).rejects.toThrow("Not authenticated");
  let blankName: unknown;
  try {
    await staff.mutation(api.parties.create, {
      organizationId,
      holderType: "organization",
      name: "   ",
    });
  } catch (error) {
    blankName = error;
  }
  expect(partyErrorFromError(blankName)).toMatchObject({
    code: "PARTY_NAME_REQUIRED",
  });
});

test("search finds people and institutions by name beyond the most recent accounts", async () => {
  const t = createConvexTest();
  const { organizationId, userId, staff } = await createMuseum(t);
  const oldestId = await insertAccount(t, organizationId, userId, {
    businessName: "Ancient Ceramics Society",
  });
  const patronId = await insertAccount(t, organizationId, userId, {
    accountType: "patron",
    firstName: "Mary",
    lastName: "Anning",
  });
  await t.run(async (ctx) => {
    for (let index = 0; index < 520; index++) {
      await ctx.db.insert("accounts", {
        organizationId,
        accountNumber: `ACC-F${index}`,
        accountType: "institution",
        businessName: `Filler Partner ${index}`,
        createdBy: userId,
        createdAt: Date.now(),
      });
    }
  });

  const ceramics = await staff.query(api.parties.search, {
    organizationId,
    search: "ceramics",
  });
  expect(ceramics.map((party) => party._id)).toEqual([oldestId]);

  const anning = await staff.query(api.parties.search, {
    organizationId,
    search: "Anning",
  });
  expect(anning).toMatchObject([
    { _id: patronId, displayName: "Mary Anning", holderType: "privatePerson" },
  ]);
});

test("search and lookup stay inside the organization and leave out archived parties", async () => {
  const t = createConvexTest();
  const home = await createMuseum(t);
  const foreign = await createMuseum(t);
  const activeId = await insertAccount(t, home.organizationId, home.userId, {
    businessName: "Lantern Collective",
  });
  await insertAccount(t, home.organizationId, home.userId, {
    businessName: "Lantern Archive",
    status: "archived",
  });
  const foreignId = await insertAccount(
    t,
    foreign.organizationId,
    foreign.userId,
    { businessName: "Lantern Foreign" },
  );

  const results = await home.staff.query(api.parties.search, {
    organizationId: home.organizationId,
    search: "Lantern",
  });
  expect(results.map((party) => party._id)).toEqual([activeId]);
  await expect(
    home.staff.query(api.parties.get, { accountId: foreignId }),
  ).rejects.toThrow("Permission denied");
  await expect(
    home.staff.query(api.parties.search, {
      organizationId: foreign.organizationId,
      search: "Lantern",
    }),
  ).rejects.toThrow("Permission denied");
});

test("similar existing parties are suggested before a new party is created", async () => {
  const t = createConvexTest();
  const { organizationId, userId, staff } = await createMuseum(t);
  const existingId = await insertAccount(t, organizationId, userId, {
    businessName: "Hopper, Grace",
    holderType: "privatePerson",
    email: "Grace@Example.org",
  });
  await insertAccount(t, organizationId, userId, {
    businessName: "Grace Hopper Foundation",
  });

  expect(
    await staff.query(api.parties.findSimilar, {
      organizationId,
      name: "Grace Hopper",
      email: "grace@example.org",
    }),
  ).toMatchObject([
    {
      party: { _id: existingId, displayName: "Hopper, Grace" },
      reasons: ["name", "email"],
    },
  ]);
});

test("an email written with different capitals or spacing still finds the existing party", async () => {
  const t = createConvexTest();
  const { organizationId, userId, staff } = await createMuseum(t);
  const foreign = await createMuseum(t);
  const existingId = await insertAccount(t, organizationId, userId, {
    businessName: "Harbour Studio",
    email: " Studio@Harbour.Example ",
  });
  await insertAccount(t, foreign.organizationId, foreign.userId, {
    businessName: "Foreign Studio",
    email: "studio@harbour.example",
  });

  expect(
    await staff.query(api.parties.findSimilar, {
      organizationId,
      name: "Completely Different Name",
      email: "STUDIO@harbour.example",
    }),
  ).toMatchObject([{ party: { _id: existingId }, reasons: ["email"] }]);
});
