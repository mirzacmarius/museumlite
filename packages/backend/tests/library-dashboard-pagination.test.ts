import type { FunctionReturnType } from "convex/server";
import { describe, expect, test } from "vitest";
import { api } from "../convex/_generated/api";
import type { Doc } from "../convex/_generated/dataModel";
import {
  authedForUser,
  createConvexTest,
  createOrgUserWithPermissions,
} from "./testHarness";

const NOW = Date.UTC(2026, 8, 17, 12);
const DAY = Date.UTC(2026, 8, 17);
const MONTH = Date.UTC(2026, 8, 1);
type StatsPage = FunctionReturnType<
  typeof api.library.reports.getDashboardStats
>;

async function setup(populate = true) {
  const t = createConvexTest();
  const owner = await createOrgUserWithPermissions(t, ["collections.read"], {
    enabledModules: ["library", "accounts"],
    subscriptionTier: "pro",
  });
  const other = await createOrgUserWithPermissions(t, ["collections.read"], {
    enabledModules: ["library", "accounts"],
    subscriptionTier: "pro",
  });
  const client = authedForUser(t, owner.userId);
  if (populate) {
    await t.run(async (ctx) => {
      const itemData = {
        organizationId: owner.organizationId,
        itemType: "book",
        title: "Book",
        authors: ["Author"],
        language: "en",
        totalCopies: 2,
        availableCopies: 1,
        catalogStatus: "published",
        isCirculating: true,
        createdBy: owner.userId,
        createdAt: MONTH - 1,
      } satisfies Omit<Doc<"libraryItems">, "_id" | "_creationTime">;
      const itemId = await ctx.db.insert("libraryItems", itemData);
      for (let i = 1; i < 7; i++) {
        await ctx.db.insert("libraryItems", {
          ...itemData,
          catalogStatus: i % 2 === 0 ? "published" : "archived",
        });
      }
      await ctx.db.insert("libraryItems", {
        ...itemData,
        organizationId: other.organizationId,
        totalCopies: 999,
      });
      const accountData = {
        organizationId: owner.organizationId,
        accountNumber: "PATRON",
        accountType: "patron",
        status: "active",
        registrationDate: NOW,
        createdBy: owner.userId,
        createdAt: NOW,
      } satisfies Omit<Doc<"accounts">, "_id" | "_creationTime">;
      const accountId = await ctx.db.insert("accounts", accountData);
      await ctx.db.insert("accounts", {
        ...accountData,
        registrationDate: MONTH,
      });
      await ctx.db.insert("accounts", {
        ...accountData,
        status: "expired",
        registrationDate: MONTH - 1,
      });
      await ctx.db.insert("accounts", {
        ...accountData,
        status: "inactive",
        registrationDate: undefined,
      });
      await ctx.db.insert("accounts", {
        ...accountData,
        accountType: "institution",
      });
      await ctx.db.insert("accounts", {
        ...accountData,
        organizationId: other.organizationId,
      });
      const copyId = await ctx.db.insert("itemCopies", {
        organizationId: owner.organizationId,
        itemId,
        copyNumber: 1,
        barcode: "COPY",
        status: "checked_out",
        condition: "good",
        createdAt: NOW,
      });
      const circulationData = {
        organizationId: owner.organizationId,
        accountId,
        copyId,
        itemId,
        checkoutDate: MONTH - 1,
        dueDate: NOW - 1,
        renewalCount: 0,
        status: "returned",
        returnDate: DAY - 1,
        checkedOutBy: owner.userId,
      } satisfies Omit<Doc<"circulations">, "_id" | "_creationTime">;
      // Old history fills several pages before the records that affect today's counts.
      for (let i = 0; i < 13; i++)
        await ctx.db.insert("circulations", circulationData);
      await ctx.db.insert("circulations", {
        ...circulationData,
        status: "active",
        checkoutDate: DAY,
        returnDate: undefined,
      });
      await ctx.db.insert("circulations", {
        ...circulationData,
        status: "active",
        checkoutDate: MONTH,
        dueDate: NOW,
        returnDate: undefined,
      });
      await ctx.db.insert("circulations", {
        ...circulationData,
        checkoutDate: DAY - 1,
        returnDate: DAY,
      });
      // Preserve the existing convention: status 'overdue' is not counted as 'active'.
      await ctx.db.insert("circulations", {
        ...circulationData,
        status: "overdue",
        checkoutDate: NOW,
        returnDate: undefined,
      });
      await ctx.db.insert("circulations", {
        ...circulationData,
        organizationId: other.organizationId,
        status: "active",
        checkoutDate: NOW,
      });
      for (const status of [
        "pending",
        "available",
        "fulfilled",
        "cancelled",
        "expired",
        "pending",
      ] as const) {
        await ctx.db.insert("libraryHolds", {
          organizationId: owner.organizationId,
          accountId,
          itemId,
          holdDate: NOW,
          queuePosition: 1,
          status,
          createdAt: NOW,
        });
      }
      await ctx.db.insert("libraryHolds", {
        organizationId: other.organizationId,
        accountId,
        itemId,
        holdDate: NOW,
        queuePosition: 1,
        status: "pending",
        createdAt: NOW,
      });
      const fineData = {
        organizationId: owner.organizationId,
        accountId,
        fineType: "overdue",
        description: "Fine",
        amount: 10,
        amountPaid: 3,
        balance: 7,
        status: "outstanding",
        createdAt: NOW,
      } satisfies Omit<Doc<"libraryFines">, "_id" | "_creationTime">;
      await ctx.db.insert("libraryFines", fineData);
      await ctx.db.insert("libraryFines", { ...fineData, balance: 2 });
      await ctx.db.insert("libraryFines", {
        ...fineData,
        status: "paid",
        amount: 12,
        amountPaid: 2,
        paidAt: MONTH,
      });
      await ctx.db.insert("libraryFines", {
        ...fineData,
        status: "paid",
        amount: 5,
        paidAt: NOW,
      });
      await ctx.db.insert("libraryFines", {
        ...fineData,
        status: "paid",
        paidAt: MONTH - 1,
      });
      await ctx.db.insert("libraryFines", {
        ...fineData,
        status: "waived",
        paidAt: NOW,
      });
      await ctx.db.insert("libraryFines", {
        ...fineData,
        organizationId: other.organizationId,
        balance: 999,
      });
    });
  }
  return { t, owner, other, client };
}

function sumPages(pages: StatsPage[]) {
  const totals: Record<string, Record<string, number>> = {};
  for (const page of pages) {
    for (const [section, values] of Object.entries(page.partialStats)) {
      totals[section] ??= {};
      const sectionTotals = totals[section];
      for (const [field, value] of Object.entries(values)) {
        sectionTotals[field] = (sectionTotals[field] ?? 0) + value;
      }
    }
  }
  return totals;
}

async function readAll(
  fixture: Awaited<ReturnType<typeof setup>>,
  pageSize: number,
) {
  const pages: StatsPage[] = [];
  let continuation: StatsPage["next"] = null;
  do {
    const page: StatsPage = await fixture.client.query(
      api.library.reports.getDashboardStats,
      {
        organizationId: fixture.owner.organizationId,
        asOf: NOW,
        pageSize,
        continuation: continuation ?? undefined,
      },
    );
    pages.push(page);
    continuation = page.next;
    if (pages.length > 100) throw new Error("Pagination did not terminate");
  } while (continuation !== null);
  return pages;
}

describe("bounded library dashboard statistics", () => {
  test.each([
    1, 2, 100,
  ])("all pages preserve exact totals with page size %i", async (pageSize) => {
    const fixture = await setup();
    const pages = await readAll(fixture, pageSize);
    expect(pages.length).toBeGreaterThanOrEqual(5);
    expect(
      pages.every(
        (page) => page.partialStats.collection.totalItems <= pageSize,
      ),
    ).toBe(true);
    expect(pages.every((page) => page.asOf === NOW)).toBe(true);
    expect(sumPages(pages)).toEqual({
      collection: {
        totalItems: 7,
        publishedItems: 4,
        totalCopies: 14,
        availableCopies: 7,
        checkedOutCopies: 7,
      },
      patrons: { total: 4, active: 2, newThisMonth: 2 },
      circulation: {
        activeCheckouts: 2,
        overdueItems: 1,
        checkoutsToday: 2,
        returnsToday: 1,
        checkoutsThisMonth: 4,
      },
      holds: { pending: 2, available: 1, total: 3 },
      fines: { outstandingTotal: 9, collectedThisMonth: 17 },
    });
  });

  test("catalogs larger than the page ceiling are counted without truncation", async () => {
    const fixture = await setup(false);
    await fixture.t.run(async (ctx) => {
      for (let index = 0; index < 501; index++) {
        await ctx.db.insert("libraryItems", {
          organizationId: fixture.owner.organizationId,
          itemType: "book",
          title: `Book ${index}`,
          authors: [],
          language: "en",
          totalCopies: 1,
          availableCopies: 1,
          catalogStatus: index === 500 ? "draft" : "published",
          isCirculating: true,
          createdBy: fixture.owner.userId,
          createdAt: NOW,
        });
      }
    });
    const pages = await readAll(fixture, 250);
    expect(pages.length).toBeGreaterThanOrEqual(7);
    expect(pages.every((page) => page.asOf === NOW)).toBe(true);
    expect(
      pages.every((page) => page.partialStats.collection.totalItems <= 250),
    ).toBe(true);
    expect(sumPages(pages).collection).toEqual({
      totalItems: 501,
      publishedItems: 500,
      totalCopies: 501,
      availableCopies: 501,
      checkedOutCopies: 0,
    });
  });

  test("the first page is explicitly partial and never claims to be a complete total", async () => {
    const fixture = await setup();
    const page: StatsPage = await fixture.client.query(
      api.library.reports.getDashboardStats,
      {
        organizationId: fixture.owner.organizationId,
        asOf: NOW,
        pageSize: 2,
      },
    );
    expect(page.partialStats.collection.totalItems).toBe(2);
    expect(page.asOf).toBe(NOW);
    expect(page.next).toMatchObject({
      section: "collection",
      organizationId: fixture.owner.organizationId,
      asOf: NOW,
    });
    expect(page.next?.cursor).toEqual(expect.any(String));
    expect(page).not.toHaveProperty("collection");
  });

  test("clock boundaries stay fixed when subsequent pages cross midnight and month end", async () => {
    const fixture = await setup();
    const first = await fixture.client.query(
      api.library.reports.getDashboardStats,
      {
        organizationId: fixture.owner.organizationId,
        asOf: NOW,
        pageSize: 2,
      },
    );
    expect(first.asOf).toBe(NOW);
    if (!first.next) throw new Error("Expected a continuation");
    await expect(
      fixture.client.query(api.library.reports.getDashboardStats, {
        organizationId: fixture.owner.organizationId,
        asOf: Date.UTC(2026, 9, 2),
        pageSize: 2,
        continuation: first.next,
      }),
    ).rejects.toThrow("continuation asOf does not match query asOf");
    const pages = [first];
    let continuation = first.next;
    while (continuation !== null) {
      const page: StatsPage = await fixture.client.query(
        api.library.reports.getDashboardStats,
        {
          organizationId: fixture.owner.organizationId,
          asOf: NOW,
          pageSize: 2,
          continuation,
        },
      );
      expect(page.asOf).toBe(NOW);
      pages.push(page);
      continuation = page.next;
    }
    expect(sumPages(pages).circulation).toEqual({
      activeCheckouts: 2,
      overdueItems: 1,
      checkoutsToday: 2,
      returnsToday: 1,
      checkoutsThisMonth: 4,
    });
    expect(sumPages(pages).fines).toEqual({
      outstandingTotal: 9,
      collectedThisMonth: 17,
    });
  });

  test("empty sections still advance to completion with zero totals", async () => {
    const fixture = await setup(false);
    const pages = await readAll(fixture, 1);
    expect(pages).toHaveLength(5);
    expect(pages.every((page) => page.asOf === NOW)).toBe(true);
    expect(
      Object.values(sumPages(pages))
        .flatMap((section) => Object.values(section))
        .every((value) => value === 0),
    ).toBe(true);
  });

  test.each([
    0, -1, 251, 1.5,
  ])("rejects an invalid page size %i", async (pageSize) => {
    const fixture = await setup(false);
    await expect(
      fixture.client.query(api.library.reports.getDashboardStats, {
        organizationId: fixture.owner.organizationId,
        asOf: NOW,
        pageSize,
      }),
    ).rejects.toThrow("page size");
  });

  test("every continuation rechecks permissions and rejects cross-organization reuse", async () => {
    const fixture = await setup();
    const first = await fixture.client.query(
      api.library.reports.getDashboardStats,
      {
        organizationId: fixture.owner.organizationId,
        asOf: NOW,
        pageSize: 1,
      },
    );
    if (!first.next) throw new Error("Expected a continuation");
    for (const client of [
      fixture.t,
      authedForUser(fixture.t, fixture.other.userId),
    ]) {
      await expect(
        client.query(api.library.reports.getDashboardStats, {
          organizationId: fixture.owner.organizationId,
          asOf: NOW,
          continuation: first.next,
        }),
      ).rejects.toThrow("Permission denied");
    }
    await expect(
      authedForUser(fixture.t, fixture.other.userId).query(
        api.library.reports.getDashboardStats,
        {
          organizationId: fixture.other.organizationId,
          asOf: NOW,
          continuation: first.next,
        },
      ),
    ).rejects.toThrow("continuation belongs to another organization");
    await expect(
      fixture.client.query(api.library.reports.getDashboardStats, {
        organizationId: fixture.owner.organizationId,
        asOf: NOW + 1,
        continuation: first.next,
      }),
    ).rejects.toThrow("continuation asOf does not match query asOf");
    await fixture.t.run(async (ctx) => {
      const permissions = await ctx.db
        .query("rolePermissions")
        .withIndex("by_role", (q) => q.eq("roleId", fixture.owner.roleId))
        .collect();
      for (const permission of permissions) await ctx.db.delete(permission._id);
    });
    await expect(
      fixture.client.query(api.library.reports.getDashboardStats, {
        organizationId: fixture.owner.organizationId,
        asOf: NOW,
        continuation: first.next,
      }),
    ).rejects.toThrow("Permission denied");
  });
});
