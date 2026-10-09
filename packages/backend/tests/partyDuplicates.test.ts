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

const REVIEWER_PERMISSIONS = [
  "collections.create",
  "collections.read",
  "collections.update",
  "accounts.read",
  "accounts.write",
];

async function createMuseum(
  t: ConvexTest,
  permissions: string[] = REVIEWER_PERMISSIONS,
) {
  const setup = await createOrgUserWithPermissions(t, permissions, {
    enabledModules: ["accounts"],
  });
  return { ...setup, staff: authedForUser(t, setup.userId) };
}

async function insertAccount(
  t: ConvexTest,
  organizationId: Id<"organizations">,
  createdBy: Id<"users">,
  fields: { businessName: string; email?: string; phone?: string },
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

const page = { numItems: 25, cursor: null };

async function rejectionCode(call: Promise<unknown>) {
  try {
    await call;
  } catch (error) {
    return partyErrorFromError(error)?.code ?? String(error);
  }
  throw new Error("Expected the call to be rejected");
}

test("a scan suggests parties that share a normalized name, email or phone and never merges them", async () => {
  const t = createConvexTest();
  const { organizationId, userId, staff } = await createMuseum(t);
  const smithA = await insertAccount(t, organizationId, userId, {
    businessName: "Smith, Jane",
    email: "jane@example.org",
  });
  const smithB = await insertAccount(t, organizationId, userId, {
    businessName: "JANE SMITH",
    phone: "+47 123 45 678",
  });
  const phoneTwin = await insertAccount(t, organizationId, userId, {
    businessName: "Harbour Studio",
    phone: "(47) 12345678",
  });
  await insertAccount(t, organizationId, userId, {
    businessName: "Unrelated Gallery",
  });
  const accessionId = await staff.mutation(api.accessions.create, {
    organizationId,
    accessionNumber: "DUP.1",
    dateReceived: Date.UTC(2026, 0, 1),
    source: "Jane Smith",
    donorAccountId: smithA,
    method: "gift",
  });

  const scan = await staff.mutation(api.partyDuplicates.scan, {
    organizationId,
  });
  expect(scan).toMatchObject({ created: 2, scanLimitReached: false });

  const pending = await staff.query(api.partyDuplicates.list, {
    organizationId,
    status: "pending",
    paginationOpts: page,
  });
  const pairs = pending.page.map((review) => ({
    ids: [review.first?._id, review.second?._id].sort(),
    reasons: review.reasons,
  }));
  expect(pairs).toEqual(
    expect.arrayContaining([
      { ids: [smithA, smithB].sort(), reasons: ["name"] },
      { ids: [smithB, phoneTwin].sort(), reasons: ["phone"] },
    ]),
  );
  expect(pairs).toHaveLength(2);

  const nameReview = pending.page.find((review) =>
    review.reasons.includes("name"),
  );
  if (!nameReview) throw new Error("Expected a name suggestion");
  await staff.mutation(api.partyDuplicates.resolve, {
    reviewId: nameReview._id,
    decision: "confirmed_distinct",
    note: "Different people with the same name",
  });

  // Both parties and the donor link are untouched.
  expect(
    await staff.query(api.parties.get, { accountId: smithA }),
  ).toMatchObject({ displayName: "Smith, Jane", archived: false });
  expect(
    await staff.query(api.parties.get, { accountId: smithB }),
  ).toMatchObject({ displayName: "JANE SMITH", archived: false });
  expect(
    (
      await staff.query(api.partyLinks.listForTarget, {
        target: { type: "accession", id: accessionId },
      })
    ).links,
  ).toMatchObject([{ accountId: smithA, isCurrent: true }]);

  // A reviewed pair is not suggested again.
  expect(
    await staff.mutation(api.partyDuplicates.scan, { organizationId }),
  ).toMatchObject({ created: 0 });
  const resolved = await staff.query(api.partyDuplicates.list, {
    organizationId,
    status: "confirmed_distinct",
    paginationOpts: page,
  });
  expect(resolved.page).toMatchObject([
    {
      _id: nameReview._id,
      status: "confirmed_distinct",
      note: "Different people with the same name",
      reviewedByName: "Test User",
    },
  ]);
  expect(
    await rejectionCode(
      staff.mutation(api.partyDuplicates.resolve, {
        reviewId: nameReview._id,
        decision: "dismissed",
      }),
    ),
  ).toBe("DUPLICATE_REVIEW_ALREADY_RESOLVED");
});

test("creating a party that matches an existing one records a suggestion for review", async () => {
  const t = createConvexTest();
  const { organizationId, userId, staff } = await createMuseum(t);
  const existingId = await insertAccount(t, organizationId, userId, {
    businessName: "Fjord Art Foundation",
  });

  const created = await staff.mutation(api.parties.create, {
    organizationId,
    holderType: "organization",
    name: "Fjord Art Foundation",
  });

  expect(created.duplicateSuggestions).toBe(1);
  const pending = await staff.query(api.partyDuplicates.list, {
    organizationId,
    status: "pending",
    paginationOpts: page,
  });
  expect(
    pending.page.map((review) =>
      [review.first?._id, review.second?._id].sort(),
    ),
  ).toEqual([[existingId, created.accountId].sort()]);
});

test("reviewing duplicates needs accounts.write and stays inside the organization", async () => {
  const t = createConvexTest();
  const { organizationId, userId, staff } = await createMuseum(t);
  await insertAccount(t, organizationId, userId, { businessName: "Twin Co" });
  await insertAccount(t, organizationId, userId, { businessName: "Twin Co." });
  await staff.mutation(api.partyDuplicates.scan, { organizationId });
  const [review] = (
    await staff.query(api.partyDuplicates.list, {
      organizationId,
      status: "pending",
      paginationOpts: page,
    })
  ).page;
  if (!review) throw new Error("Expected a pending review");

  const viewer = await createOrgUserWithPermissions(t, ["accounts.read"], {
    enabledModules: ["accounts"],
  });
  const sameOrgViewerId = await t.run(async (ctx) => {
    const viewerUserId = await ctx.db.insert("users", {
      name: "Viewer",
      email: `viewer-${Math.random().toString(36).slice(2, 7)}@example.com`,
    });
    const roleId = await ctx.db.insert("roles", {
      organizationId,
      name: "Viewer",
      isSystemRole: false,
    });
    const permissionId = await ctx.db.insert("permissions", {
      name: "accounts.read",
      category: "accounts",
    });
    await ctx.db.insert("rolePermissions", { roleId, permissionId });
    await ctx.db.insert("userOrganizations", {
      userId: viewerUserId,
      organizationId,
      roleId,
      joinedAt: Date.now(),
    });
    return viewerUserId;
  });
  const sameOrgViewer = authedForUser(t, sameOrgViewerId);

  expect(
    (
      await sameOrgViewer.query(api.partyDuplicates.list, {
        organizationId,
        status: "pending",
        paginationOpts: page,
      })
    ).page,
  ).toHaveLength(1);
  await expect(
    sameOrgViewer.mutation(api.partyDuplicates.resolve, {
      reviewId: review._id,
      decision: "dismissed",
    }),
  ).rejects.toThrow("Permission denied: accounts.write");
  await expect(
    sameOrgViewer.mutation(api.partyDuplicates.scan, { organizationId }),
  ).rejects.toThrow("Permission denied: accounts.write");
  await expect(
    authedForUser(t, viewer.userId).mutation(api.partyDuplicates.resolve, {
      reviewId: review._id,
      decision: "dismissed",
    }),
  ).rejects.toThrow("Permission denied");
  await expect(
    authedForUser(t, viewer.userId).query(api.partyDuplicates.list, {
      organizationId,
      status: "pending",
      paginationOpts: page,
    }),
  ).rejects.toThrow("Permission denied");
  await expect(
    t.mutation(api.partyDuplicates.resolve, {
      reviewId: review._id,
      decision: "dismissed",
    }),
  ).rejects.toThrow("Not authenticated");

  await staff.mutation(api.partyDuplicates.resolve, {
    reviewId: review._id,
    decision: "dismissed",
  });
  expect(
    (
      await staff.query(api.partyDuplicates.list, {
        organizationId,
        status: "pending",
        paginationOpts: page,
      })
    ).page,
  ).toEqual([]);
});

test("a blank email does not hide the contact email when suggesting duplicates", async () => {
  const t = createConvexTest();
  const { organizationId, userId, staff } = await createMuseum(t);
  const legacyId = await t.run(async (ctx) =>
    ctx.db.insert("accounts", {
      organizationId,
      accountNumber: "ACC-LEGACY",
      accountType: "lender",
      businessName: "Old Lender Ltd",
      email: "   ",
      contactEmail: "desk@lender.example",
      createdBy: userId,
      createdAt: Date.now(),
    }),
  );
  const currentId = await insertAccount(t, organizationId, userId, {
    businessName: "Lender Desk",
    email: "Desk@Lender.example",
  });

  await staff.mutation(api.partyDuplicates.scan, { organizationId });
  const pending = await staff.query(api.partyDuplicates.list, {
    organizationId,
    status: "pending",
    paginationOpts: page,
  });
  expect(
    pending.page.map((review) => ({
      ids: [review.first?._id, review.second?._id].sort(),
      reasons: review.reasons,
    })),
  ).toEqual([{ ids: [legacyId, currentId].sort(), reasons: ["email"] }]);
});
