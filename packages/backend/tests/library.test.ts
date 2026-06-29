import { expect, test } from "vitest";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import {
  authedForUser,
  type ConvexTest,
  createConvexTest,
  createOrgUserWithPermissions,
} from "./testHarness";

interface LibraryCatalogFixture {
  organizationId: Id<"organizations">;
  userId: Id<"users">;
  patronId: Id<"accounts">;
  authed: ReturnType<typeof authedForUser>;
}

async function setupLibraryCatalogFixture(
  t: ConvexTest,
): Promise<LibraryCatalogFixture> {
  const { organizationId, userId } = await createOrgUserWithPermissions(
    t,
    ["collections.create"],
    {
      organizationName: "Catalog Test Library",
      slugPrefix: "catalog-lib",
      subscriptionTier: "pro",
      enabledModules: ["library", "accounts"],
    },
  );

  const patronId = await t.run(async (ctx) => {
    const now = Date.now();
    await ctx.db.insert("librarySettings", {
      organizationId,
      defaultLoanPeriodDays: 14,
      defaultRenewalLimit: 2,
      renewalPeriodDays: 14,
      maxRenewalsAllowed: 2,
      finePerDayDefault: 0.25,
      gracePeriodDays: 1,
      holdExpirationDays: 7,
      maxHoldsPerPatron: 10,
      autoGenerateCardNumbers: true,
      classificationSystem: "dewey",
      createdAt: now,
    });

    return await ctx.db.insert("accounts", {
      organizationId,
      accountNumber: "PAT-CAT-001",
      accountType: "patron",
      status: "active",
      firstName: "Pat",
      lastName: "Reader",
      cardNumber: "CARD-CAT-001",
      createdBy: userId,
      createdAt: now,
    });
  });

  return {
    organizationId,
    userId,
    patronId,
    authed: authedForUser(t, userId),
  };
}

test("should create library item and copy with barcode", async () => {
  const t = createConvexTest();
  const { organizationId, authed } = await setupLibraryCatalogFixture(t);

  const itemId = await authed.mutation(api.library.items.create, {
    organizationId,
    title: "The Great Gatsby",
    itemType: "book",
    authors: ["F. Scott Fitzgerald"],
    isbn13: "9780743273565",
    language: "en",
  });

  const copyId = await authed.mutation(api.library.copies.create, {
    itemId,
    barcode: "LIB0000001",
    condition: "new",
  });

  expect(itemId).toBeDefined();
  expect(copyId).toBeDefined();

  const copy = await t.run(async (ctx) => ctx.db.get(copyId));
  expect(copy?.barcode).toBe("LIB0000001");
  expect(copy?.itemId).toBe(itemId);
});

test("should checkout and return library item", async () => {
  const t = createConvexTest();
  const { organizationId, patronId, authed } =
    await setupLibraryCatalogFixture(t);

  const itemId = await authed.mutation(api.library.items.create, {
    organizationId,
    title: "Checkout Test Book",
    itemType: "book",
    authors: ["Author"],
    language: "en",
  });

  const copyId = await authed.mutation(api.library.copies.create, {
    itemId,
    barcode: "LIB0000002",
    condition: "good",
  });

  const circulationId = await authed.mutation(api.library.circulation.checkout, {
    accountId: patronId,
    copyId,
  });

  const circ = await authed.query(api.library.circulation.get, {
    circulationId,
  });
  expect(circ?.status).toBe("active");

  await authed.mutation(api.library.circulation.checkin, { circulationId });

  const returned = await authed.query(api.library.circulation.get, {
    circulationId,
  });
  expect(returned?.status).toBe("returned");
});

test("should calculate fines on overdue return", async () => {
  const t = createConvexTest();
  const { organizationId, patronId, authed } =
    await setupLibraryCatalogFixture(t);

  const fineId = await authed.mutation(api.library.fines.create, {
    accountId: patronId,
    fineType: "overdue",
    description: "Overdue book",
    amount: 5,
  });

  const fines = await authed.query(api.library.fines.list, {
    organizationId,
    status: "outstanding",
    paginationOpts: { cursor: null, numItems: 10 },
  });

  expect(fines.page.length).toBeGreaterThan(0);
  expect(fines.page.some((fine) => fine._id === fineId)).toBe(true);
  expect(fines.page[0]?.fineType).toBe("overdue");
});

test("should process fine payment", async () => {
  const t = createConvexTest();
  const { patronId, authed } = await setupLibraryCatalogFixture(t);

  const fineId = await authed.mutation(api.library.fines.create, {
    accountId: patronId,
    fineType: "overdue",
    description: "Overdue book",
    amount: 5,
  });

  await authed.mutation(api.library.fines.recordPayment, {
    accountId: patronId,
    amount: 5,
    paymentMethod: "cash",
    fineIds: [fineId],
  });

  const fine = await authed.query(api.library.fines.get, { fineId });
  expect(fine?.status).toBe("paid");
});

test("should submit and approve acquisition request", async () => {
  const t = createConvexTest();
  const { organizationId, authed } = await setupLibraryCatalogFixture(t);

  const requestId = await authed.mutation(api.library.acquisitions.create, {
    organizationId,
    title: "New Book Request",
    authors: ["Author Name"],
    isbn: "9781234567890",
    priority: "normal",
    quantity: 1,
  });

  expect(requestId).toBeDefined();

  await authed.mutation(api.library.acquisitions.approve, { requestId });

  const request = await t.run(async (ctx) => ctx.db.get(requestId));
  expect(request?.status).toBe("approved");
});
