import { expect, test } from "vitest";
import { api } from "../convex/_generated/api";
import * as collections from "../convex/collections";
import { expectMatchesReturns } from "./returnsValidation";
import {
  authedForUser,
  createConvexTest,
  createOrgUserWithPermissions,
} from "./testHarness";

test("selection search reaches objects beyond the old five-thousand cap", async () => {
  const t = createConvexTest();
  const setup = await createOrgUserWithPermissions(t, ["collections.read"]);
  await t.run(async (ctx) => {
    for (let index = 0; index < 5050; index += 1) {
      await ctx.db.insert("collections", {
        organizationId: setup.organizationId,
        accessionNumber: `BULK-${index}`,
        normalizedIdentifier: `bulk-${index}`,
        title: `Bulk item ${index}`,
        status: "active",
        catalogedBy: setup.userId,
        catalogedAt: Date.now(),
      });
    }
    await ctx.db.insert("collections", {
      organizationId: setup.organizationId,
      accessionNumber: "LATE-1",
      normalizedIdentifier: "late-1",
      title: "Astrolabe",
      status: "active",
      catalogedBy: setup.userId,
      catalogedAt: Date.now(),
    });
  });
  const user = authedForUser(t, setup.userId);

  const byIdentifier = await user.query(api.collections.searchForSelection, {
    organizationId: setup.organizationId,
    query: "LATE-1",
  });
  const byTitle = await user.query(api.collections.searchForSelection, {
    organizationId: setup.organizationId,
    query: "astrolabe",
    status: "active",
  });
  const broad = await user.query(api.collections.searchForSelection, {
    organizationId: setup.organizationId,
    query: "bulk",
  });

  expectMatchesReturns(collections.searchForSelection, byIdentifier);
  expect(byIdentifier.items.map((item) => item.accessionNumber)).toEqual([
    "LATE-1",
  ]);
  expect(byTitle.items.map((item) => item.accessionNumber)).toEqual(["LATE-1"]);
  expect(broad.items).toHaveLength(50);
  expect(broad.hasMore).toBe(true);
}, 60_000);

test("selection search applies the status filter and excludes withdrawn records", async () => {
  const t = createConvexTest();
  const setup = await createOrgUserWithPermissions(t, ["collections.read"]);
  await t.run(async (ctx) => {
    for (const [accessionNumber, status] of [
      ["S-1", "active"],
      ["S-2", "loaned"],
      ["S-3", "archived"],
    ] as const) {
      await ctx.db.insert("collections", {
        organizationId: setup.organizationId,
        accessionNumber,
        normalizedIdentifier: accessionNumber.toLowerCase(),
        title: "Sextant",
        status,
        catalogedBy: setup.userId,
        catalogedAt: Date.now(),
      });
    }
  });
  const user = authedForUser(t, setup.userId);

  const all = await user.query(api.collections.searchForSelection, {
    organizationId: setup.organizationId,
    query: "sextant",
  });
  const active = await user.query(api.collections.searchForSelection, {
    organizationId: setup.organizationId,
    query: "sextant",
    status: "active",
  });

  expect(all.items.map((item) => item.accessionNumber).sort()).toEqual([
    "S-1",
    "S-2",
  ]);
  expect(active.items.map((item) => item.accessionNumber)).toEqual(["S-1"]);
});

test("selection status filter reaches matches past the combined search cap", async () => {
  const t = createConvexTest();
  const setup = await createOrgUserWithPermissions(t, ["collections.read"]);
  await t.run(async (ctx) => {
    for (let index = 0; index < 60; index += 1) {
      await ctx.db.insert("collections", {
        organizationId: setup.organizationId,
        accessionNumber: `S-${String(index).padStart(2, "0")}`,
        normalizedIdentifier: `s-${String(index).padStart(2, "0")}`,
        title: "Sextant",
        status: "archived",
        catalogedBy: setup.userId,
        catalogedAt: Date.now(),
      });
    }
    await ctx.db.insert("collections", {
      organizationId: setup.organizationId,
      accessionNumber: "S-99",
      normalizedIdentifier: "s-99",
      title: "Sextant",
      status: "active",
      catalogedBy: setup.userId,
      catalogedAt: Date.now(),
    });
  });
  const result = await authedForUser(t, setup.userId).query(
    api.collections.searchForSelection,
    { organizationId: setup.organizationId, query: "s-", status: "active" },
  );
  expect(result.items.map((item) => item.accessionNumber)).toEqual(["S-99"]);
  expect(result.hasMore).toBe(false);
  const byTitle = await authedForUser(t, setup.userId).query(
    api.collections.searchForSelection,
    {
      organizationId: setup.organizationId,
      query: "Sextant",
      status: "active",
    },
  );
  expect(byTitle.items.map((item) => item.accessionNumber)).toEqual(["S-99"]);
});

test("selection without a status finds eligible objects beyond archived matches", async () => {
  const t = createConvexTest();
  const setup = await createOrgUserWithPermissions(t, ["collections.read"]);
  await t.run(async (ctx) => {
    for (let index = 0; index < 60; index += 1) {
      await ctx.db.insert("collections", {
        organizationId: setup.organizationId,
        accessionNumber: `ARC-${String(index).padStart(2, "0")}`,
        normalizedIdentifier: `arc-${String(index).padStart(2, "0")}`,
        title: "Compass",
        status: "archived",
        catalogedBy: setup.userId,
        catalogedAt: Date.now(),
      });
    }
    for (const [accessionNumber, status] of [
      ["ARC-90", "active"],
      ["ARC-91", "loaned"],
      ["ARC-92", "deaccessioned"],
    ] as const) {
      await ctx.db.insert("collections", {
        organizationId: setup.organizationId,
        accessionNumber,
        normalizedIdentifier: accessionNumber.toLowerCase(),
        title: "Compass",
        status,
        catalogedBy: setup.userId,
        catalogedAt: Date.now(),
      });
    }
  });
  const user = authedForUser(t, setup.userId);
  for (const query of ["arc-", "compass"]) {
    const result = await user.query(api.collections.searchForSelection, {
      organizationId: setup.organizationId,
      query,
    });
    expect(result.items.map((item) => item.accessionNumber)).toEqual([
      "ARC-90",
      "ARC-91",
      "ARC-92",
    ]);
    expect(result.hasMore).toBe(false);
  }
});

test("selection search requires collections.read in the organization", async () => {
  const t = createConvexTest();
  const setup = await createOrgUserWithPermissions(t, ["collections.read"]);
  const outsider = await createOrgUserWithPermissions(t, ["collections.read"]);

  await expect(
    authedForUser(t, outsider.userId).query(
      api.collections.searchForSelection,
      { organizationId: setup.organizationId, query: "anything" },
    ),
  ).rejects.toThrow();
});
