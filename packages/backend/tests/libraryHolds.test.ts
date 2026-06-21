import { describe, expect, test } from "vitest";
import { api, internal } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import {
  authedForUser,
  type ConvexTest,
  createConvexTest,
} from "./testHarness";

interface LibraryHoldsFixture {
  organizationId: Id<"organizations">;
  userId: Id<"users">;
  patron1Id: Id<"accounts">;
  patron2Id: Id<"accounts">;
  patron3Id: Id<"accounts">;
  itemId: Id<"libraryItems">;
  copyId: Id<"itemCopies">;
  circulationId?: Id<"circulations">;
}

interface LibraryHoldsFixtureOptions {
  checkedOutTo?: "patron1";
}

async function setupLibraryHoldsFixture(
  t: ConvexTest,
  options: LibraryHoldsFixtureOptions = {},
): Promise<LibraryHoldsFixture> {
  return await t.run(async (ctx) => {
    const now = Date.now();
    const organizationId = await ctx.db.insert("organizations", {
      name: "Holds Test Library",
      slug: `holds-lib-${Math.random().toString(36).slice(2, 8)}`,
      type: "library",
      subscriptionTier: "pro",
      settings: { enabledModules: ["library", "accounts"] },
    });

    const userId = await ctx.db.insert("users", {
      email: `staff-${Math.random().toString(36).slice(2, 8)}@example.com`,
      name: "Staff User",
    });
    const roleId = await ctx.db.insert("roles", {
      organizationId,
      name: "Library Staff",
      isSystemRole: false,
    });
    const permissionIds = await Promise.all(
      ["accounts.read", "accounts.write"].map((permissionName) =>
        ctx.db.insert("permissions", {
          name: permissionName,
          category: "accounts",
        }),
      ),
    );
    await Promise.all(
      permissionIds.map((permissionId) =>
        ctx.db.insert("rolePermissions", { roleId, permissionId }),
      ),
    );
    await ctx.db.insert("userOrganizations", {
      userId,
      organizationId,
      roleId,
      joinedAt: now,
    });

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

    const [patron1Id, patron2Id, patron3Id] = await Promise.all([
      ctx.db.insert("accounts", {
        organizationId,
        accountNumber: "PAT-001",
        accountType: "patron",
        status: "active",
        firstName: "Alice",
        lastName: "Reader",
        cardNumber: "CARD001",
        createdBy: userId,
        createdAt: now,
      }),
      ctx.db.insert("accounts", {
        organizationId,
        accountNumber: "PAT-002",
        accountType: "patron",
        status: "active",
        firstName: "Bob",
        lastName: "Reader",
        cardNumber: "CARD002",
        createdBy: userId,
        createdAt: now,
      }),
      ctx.db.insert("accounts", {
        organizationId,
        accountNumber: "PAT-003",
        accountType: "patron",
        status: "active",
        firstName: "Carol",
        lastName: "Reader",
        cardNumber: "CARD003",
        createdBy: userId,
        createdAt: now,
      }),
    ]);

    const isCheckedOut = options.checkedOutTo !== undefined;

    const itemId = await ctx.db.insert("libraryItems", {
      organizationId,
      itemType: "book",
      title: "Test Book",
      authors: ["Author"],
      language: "en",
      totalCopies: 1,
      availableCopies: isCheckedOut ? 0 : 1,
      catalogStatus: "published",
      isCirculating: true,
      createdBy: userId,
      createdAt: now,
    });

    const copyId = await ctx.db.insert("itemCopies", {
      organizationId,
      itemId,
      copyNumber: 1,
      barcode: "COPY001",
      status: isCheckedOut ? "checked_out" : "available",
      condition: "good",
      createdAt: now,
    });

    const circulationId = isCheckedOut
      ? await ctx.db.insert("circulations", {
          organizationId,
          accountId: patron1Id,
          copyId,
          itemId,
          checkoutDate: now,
          dueDate: now + 14 * 24 * 60 * 60 * 1000,
          renewalCount: 0,
          status: "active",
          fineStatus: "none",
          checkedOutBy: userId,
        })
      : undefined;

    return {
      organizationId,
      userId,
      patron1Id,
      patron2Id,
      patron3Id,
      itemId,
      copyId,
      circulationId,
    };
  });
}

describe("library holds lifecycle", () => {
  test("assigns queue positions when placing holds", async () => {
    const t = createConvexTest();
    const { userId, patron1Id, patron2Id, itemId } =
      await setupLibraryHoldsFixture(t);
    const authed = authedForUser(t, userId);

    const hold1Id = await authed.mutation(api.library.holds.place, {
      accountId: patron1Id,
      itemId,
    });
    const hold2Id = await authed.mutation(api.library.holds.place, {
      accountId: patron2Id,
      itemId,
    });

    const [hold1, hold2] = await Promise.all([
      authed.query(api.library.holds.get, { holdId: hold1Id }),
      authed.query(api.library.holds.get, { holdId: hold2Id }),
    ]);

    expect(hold1?.queuePosition).toBe(1);
    expect(hold2?.queuePosition).toBe(2);
    expect(hold1?.status).toBe("pending");
    expect(hold2?.status).toBe("pending");
  });

  test("check-in promotes pending hold to available and reserves copy", async () => {
    const t = createConvexTest();
    const { userId, patron2Id, itemId, copyId, circulationId } =
      await setupLibraryHoldsFixture(t, { checkedOutTo: "patron1" });
    const authed = authedForUser(t, userId);

    const holdId = await authed.mutation(api.library.holds.place, {
      accountId: patron2Id,
      itemId,
    });

    await authed.mutation(api.library.circulation.checkin, {
      circulationId: circulationId!,
    });

    const [hold, copy, item] = await Promise.all([
      authed.query(api.library.holds.get, { holdId }),
      t.run(async (ctx) => ctx.db.get(copyId)),
      t.run(async (ctx) => ctx.db.get(itemId)),
    ]);

    expect(hold?.status).toBe("available");
    expect(hold?.copyId).toBe(copyId);
    expect(copy?.status).toBe("on_hold");
    expect(item?.availableCopies).toBe(0);
  });

  test("check-in without holds leaves copy available", async () => {
    const t = createConvexTest();
    const { userId, copyId, circulationId } = await setupLibraryHoldsFixture(t, {
      checkedOutTo: "patron1",
    });
    const authed = authedForUser(t, userId);

    await authed.mutation(api.library.circulation.checkin, {
      circulationId: circulationId!,
    });

    const copy = await t.run(async (ctx) => ctx.db.get(copyId));
    expect(copy?.status).toBe("available");
  });

  test("fulfill rejects pending holds and accepts available holds", async () => {
    const t = createConvexTest();
    const { userId, patron2Id, itemId, circulationId } =
      await setupLibraryHoldsFixture(t, { checkedOutTo: "patron1" });
    const authed = authedForUser(t, userId);

    const holdId = await authed.mutation(api.library.holds.place, {
      accountId: patron2Id,
      itemId,
    });

    await expect(
      authed.mutation(api.library.holds.fulfill, { holdId }),
    ).rejects.toThrow("Hold is not ready for pickup");

    await authed.mutation(api.library.circulation.checkin, {
      circulationId: circulationId!,
    });
    await authed.mutation(api.library.holds.fulfill, { holdId });

    const hold = await authed.query(api.library.holds.get, { holdId });
    expect(hold?.status).toBe("fulfilled");
  });

  test("cancel available hold re-queues remaining pending holds", async () => {
    const t = createConvexTest();
    const { userId, patron2Id, patron3Id, itemId, circulationId } =
      await setupLibraryHoldsFixture(t, { checkedOutTo: "patron1" });
    const authed = authedForUser(t, userId);

    const hold1Id = await authed.mutation(api.library.holds.place, {
      accountId: patron2Id,
      itemId,
    });
    const hold2Id = await authed.mutation(api.library.holds.place, {
      accountId: patron3Id,
      itemId,
    });

    await authed.mutation(api.library.circulation.checkin, {
      circulationId: circulationId!,
    });
    await authed.mutation(api.library.holds.cancel, { holdId: hold1Id });

    const hold2 = await authed.query(api.library.holds.get, { holdId: hold2Id });
    expect(hold2?.queuePosition).toBe(1);
    expect(hold2?.status).toBe("pending");
  });

  test("expireOldHoldsAllOrgs expires available holds past expiration", async () => {
    const t = createConvexTest();
    const { organizationId, userId, patron1Id, itemId, copyId } =
      await setupLibraryHoldsFixture(t);
    const authed = authedForUser(t, userId);

    const holdId = await t.run(async (ctx) => {
      const now = Date.now();
      await ctx.db.patch(copyId, { status: "on_hold" });
      return await ctx.db.insert("libraryHolds", {
        organizationId,
        accountId: patron1Id,
        itemId,
        copyId,
        holdDate: now - 10 * 24 * 60 * 60 * 1000,
        queuePosition: 1,
        status: "available",
        availableDate: now - 8 * 24 * 60 * 60 * 1000,
        expirationDate: now - 24 * 60 * 60 * 1000,
        createdAt: now - 10 * 24 * 60 * 60 * 1000,
      });
    });

    const expiredCount = await t.mutation(
      internal.library.holds.expireOldHoldsAllOrgs,
      {},
    );

    expect(expiredCount).toBe(1);

    const [hold, copy] = await Promise.all([
      authed.query(api.library.holds.get, { holdId }),
      t.run(async (ctx) => ctx.db.get(copyId)),
    ]);

    expect(hold?.status).toBe("expired");
    expect(copy?.status).toBe("available");
  });
});
