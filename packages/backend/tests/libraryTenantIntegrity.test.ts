import { describe, expect, test } from "vitest";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import {
  authedForUser,
  type ConvexTest,
  createConvexTest,
} from "./testHarness";

interface CrossTenantFixture {
  userId: Id<"users">;
  orgAId: Id<"organizations">;
  orgBId: Id<"organizations">;
  orgAPatronId: Id<"accounts">;
  orgAItemId: Id<"libraryItems">;
  orgALocationId: Id<"locations">;
  orgBItemId: Id<"libraryItems">;
  orgBCopyId: Id<"itemCopies">;
  orgBLocationId: Id<"locations">;
}

async function setupCrossTenantFixture(
  t: ConvexTest,
): Promise<CrossTenantFixture> {
  return await t.run(async (ctx) => {
    const now = Date.now();
    const suffix = Math.random().toString(36).slice(2, 8);

    const orgAId = await ctx.db.insert("organizations", {
      name: "Library Org A",
      slug: `lib-org-a-${suffix}`,
      type: "library",
      subscriptionTier: "pro",
      settings: { enabledModules: ["library", "accounts"] },
    });

    const orgBId = await ctx.db.insert("organizations", {
      name: "Library Org B",
      slug: `lib-org-b-${suffix}`,
      type: "library",
      subscriptionTier: "pro",
      settings: { enabledModules: ["library", "accounts"] },
    });

    const userId = await ctx.db.insert("users", {
      email: `staff-${suffix}@example.com`,
      name: "Staff User",
    });

    await Promise.all([
      ctx.db.insert("librarySettings", {
        organizationId: orgAId,
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
      }),
      ctx.db.insert("librarySettings", {
        organizationId: orgBId,
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
      }),
    ]);

    const orgAPatronId = await ctx.db.insert("accounts", {
      organizationId: orgAId,
      accountNumber: "PAT-A-001",
      accountType: "patron",
      status: "active",
      firstName: "Alice",
      lastName: "Reader",
      cardNumber: "CARD-A-001",
      createdBy: userId,
      createdAt: now,
    });

    const [orgAItemId, orgBItemId] = await Promise.all([
      ctx.db.insert("libraryItems", {
        organizationId: orgAId,
        itemType: "book",
        title: "Org A Book",
        authors: ["Author A"],
        language: "en",
        totalCopies: 1,
        availableCopies: 1,
        catalogStatus: "published",
        isCirculating: true,
        createdBy: userId,
        createdAt: now,
      }),
      ctx.db.insert("libraryItems", {
        organizationId: orgBId,
        itemType: "book",
        title: "Org B Book",
        authors: ["Author B"],
        language: "en",
        totalCopies: 1,
        availableCopies: 1,
        catalogStatus: "published",
        isCirculating: true,
        createdBy: userId,
        createdAt: now,
      }),
    ]);

    const orgBCopyId = await ctx.db.insert("itemCopies", {
      organizationId: orgBId,
      itemId: orgBItemId,
      copyNumber: 1,
      barcode: `COPY-B-${suffix}`,
      status: "available",
      condition: "good",
      createdAt: now,
    });

    const [orgALocationId, orgBLocationId] = await Promise.all([
      ctx.db.insert("locations", {
        organizationId: orgAId,
        name: "Org A Branch",
        type: "branch",
        sortOrder: 0,
        isActive: true,
      }),
      ctx.db.insert("locations", {
        organizationId: orgBId,
        name: "Org B Branch",
        type: "branch",
        sortOrder: 0,
        isActive: true,
      }),
    ]);

    return {
      userId,
      orgAId,
      orgBId,
      orgAPatronId,
      orgAItemId,
      orgALocationId,
      orgBItemId,
      orgBCopyId,
      orgBLocationId,
    };
  });
}

describe("library tenant integrity", () => {
  test("checkout rejects org A account with org B copy", async () => {
    const t = createConvexTest();
    const { userId, orgAPatronId, orgBCopyId } =
      await setupCrossTenantFixture(t);
    const authed = authedForUser(t, userId);

    await expect(
      authed.mutation(api.library.circulation.checkout, {
        accountId: orgAPatronId,
        copyId: orgBCopyId,
      }),
    ).rejects.toThrow(/belongs to a different organization/);
  });

  test("place hold rejects org A account with org B item", async () => {
    const t = createConvexTest();
    const { userId, orgAPatronId, orgBItemId } =
      await setupCrossTenantFixture(t);
    const authed = authedForUser(t, userId);

    await expect(
      authed.mutation(api.library.holds.place, {
        accountId: orgAPatronId,
        itemId: orgBItemId,
      }),
    ).rejects.toThrow(/belongs to a different organization/);
  });

  test("place hold rejects org A account with org A item and org B pickup location", async () => {
    const t = createConvexTest();
    const { userId, orgAPatronId, orgAItemId, orgBLocationId } =
      await setupCrossTenantFixture(t);
    const authed = authedForUser(t, userId);

    await expect(
      authed.mutation(api.library.holds.place, {
        accountId: orgAPatronId,
        itemId: orgAItemId,
        pickupLocationId: orgBLocationId,
      }),
    ).rejects.toThrow(/belongs to a different organization/);
  });
});
