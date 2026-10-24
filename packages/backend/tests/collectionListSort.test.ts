import type { FunctionArgs } from "convex/server";
import { expect, test, vi } from "vitest";
import { api, internal } from "../convex/_generated/api";
import type { Doc } from "../convex/_generated/dataModel";
import { listCatalogPage } from "../convex/utils/catalogListing";
import {
  authedForUser,
  createConvexTest,
  createOrgUserWithPermissions,
} from "./testHarness";

async function setupCatalog() {
  const t = createConvexTest();
  const owner = await createOrgUserWithPermissions(t, ["collections.read"]);
  const user = authedForUser(t, owner.userId);
  async function insert(
    accessionNumber: string,
    overrides: Partial<Doc<"collections">> = {},
  ) {
    await t.run((ctx) =>
      ctx.db.insert("collections", {
        organizationId: owner.organizationId,
        accessionNumber,
        normalizedIdentifier: accessionNumber.toLowerCase(),
        title: `Object ${accessionNumber}`,
        status: "active",
        catalogedBy: owner.userId,
        catalogedAt: 100,
        ...overrides,
      }),
    );
  }
  async function listedNumbers(
    filters: Omit<
      FunctionArgs<typeof api.collections.list>,
      "organizationId" | "paginationOpts"
    > = {},
  ) {
    const numbers: string[] = [];
    let cursor: string | null = null;
    for (let pageNumber = 0; pageNumber < 20; pageNumber++) {
      const result = await user.query(api.collections.list, {
        organizationId: owner.organizationId,
        paginationOpts: { cursor, numItems: 2 },
        ...filters,
      });
      numbers.push(...result.page.map((row) => row.accessionNumber));
      if (result.isDone) return numbers;
      cursor = result.continueCursor;
    }
    throw new Error("Pagination did not finish");
  }
  return { insert, listedNumbers };
}

test("the catalog lists newest first by default and supports oldest-first and identifier order across pages", async () => {
  const catalog = await setupCatalog();
  await catalog.insert("C-1");
  await catalog.insert("A-1");
  await catalog.insert("B-1");

  expect(await catalog.listedNumbers()).toEqual(["B-1", "A-1", "C-1"]);
  expect(await catalog.listedNumbers({ sort: "newest" })).toEqual([
    "B-1",
    "A-1",
    "C-1",
  ]);
  expect(await catalog.listedNumbers({ sort: "oldest" })).toEqual([
    "C-1",
    "A-1",
    "B-1",
  ]);
  expect(await catalog.listedNumbers({ sort: "identifier" })).toEqual([
    "A-1",
    "B-1",
    "C-1",
  ]);
});

test("identifier order keeps the status filter and still hides withdrawn objects by default", async () => {
  const catalog = await setupCatalog();
  await catalog.insert("D-1", { status: "archived" });
  await catalog.insert("B-1");
  await catalog.insert("A-1", { status: "archived" });
  await catalog.insert("C-1");

  expect(
    await catalog.listedNumbers({ sort: "identifier", status: "archived" }),
  ).toEqual(["A-1", "D-1"]);
  expect(await catalog.listedNumbers({ sort: "identifier" })).toEqual([
    "B-1",
    "C-1",
  ]);
});

/** A catalog written through the create mutation, so Objects get search documents. */
async function setupDatedCatalog() {
  const t = createConvexTest();
  const owner = await createOrgUserWithPermissions(t, [
    "collections.read",
    "collections.create",
  ]);
  const user = authedForUser(t, owner.userId);
  const { organizationId } = owner;
  async function create(
    accessionNumber: string,
    fields: Omit<
      FunctionArgs<typeof api.collections.create>,
      "organizationId" | "accessionNumber" | "title"
    > = {},
  ) {
    return await user.mutation(api.collections.create, {
      organizationId,
      accessionNumber,
      title: `Object ${accessionNumber}`,
      ...fields,
    });
  }
  /** The cron's work: the Organization's documents written and marked complete. */
  async function backfill() {
    vi.useFakeTimers();
    await t.mutation(internal.objectSearch.startOutdatedBackfills, {});
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    vi.useRealTimers();
  }
  async function listedNumbers(
    filters: Omit<
      FunctionArgs<typeof api.collections.list>,
      "organizationId" | "paginationOpts"
    > = {},
  ) {
    const numbers: string[] = [];
    let cursor: string | null = null;
    for (let pageNumber = 0; pageNumber < 20; pageNumber++) {
      const result = await user.query(api.collections.list, {
        organizationId,
        paginationOpts: { cursor, numItems: 2 },
        ...filters,
      });
      numbers.push(...result.page.map((row) => row.accessionNumber));
      if (result.isDone) return numbers;
      cursor = result.continueCursor;
    }
    throw new Error("Pagination did not finish");
  }
  return { t, user, organizationId, create, backfill, listedNumbers };
}

test("date made orders list earliest or latest first across pages, mixing BC, circa and open dates, undated last", async () => {
  const catalog = await setupDatedCatalog();
  await catalog.create("A", { dateCreated: "1850" });
  // Circa widens by five years either side: 1843 to 1853.
  await catalog.create("B", { dateCreated: "c. 1848" });
  await catalog.create("C", { dateCreated: "500 BC" });
  await catalog.create("D", { dateCreated: "Ming dynasty" });
  // The structured date wins over the text.
  await catalog.create("E", {
    dateCreated: "early 1700s",
    dateCreatedEdtf: "1900/1910",
  });
  // An open start sorts by its end both ways.
  await catalog.create("F", { dateCreated: "before 1700" });
  await catalog.create("G");
  await catalog.backfill();

  expect(await catalog.listedNumbers({ sort: "madeEarliest" })).toEqual([
    "C",
    "F",
    "B",
    "A",
    "E",
    "D",
    "G",
  ]);
  expect(await catalog.listedNumbers({ sort: "madeLatest" })).toEqual([
    "E",
    "B",
    "A",
    "F",
    "C",
    "G",
    "D",
  ]);
  // Rows carry the date as written and as structured, for the list column.
  const first = await catalog.user.query(api.collections.list, {
    organizationId: catalog.organizationId,
    paginationOpts: { cursor: null, numItems: 1 },
    sort: "madeLatest",
  });
  expect(first.page).toMatchObject([
    {
      accessionNumber: "E",
      dateCreated: "early 1700s",
      dateCreatedEdtf: "1900/1910",
    },
  ]);
});

test("a date made order with a status filter pages that status's own index", async () => {
  const catalog = await setupDatedCatalog();
  const archivedLate = await catalog.create("A-1", { dateCreated: "1920" });
  await catalog.create("B-1", { dateCreated: "1700" });
  const archivedEarly = await catalog.create("A-2", { dateCreated: "1650" });
  const archivedUndated = await catalog.create("A-3");
  await catalog.create("B-2", { dateCreated: "1800s" });
  // Active Objects ahead of every archived one in both orders.
  await catalog.create("B-3", { dateCreated: "500 BC" });
  await catalog.create("B-4", { dateCreated: "100 BC" });
  await catalog.create("B-5", { dateCreated: "1990" });
  await catalog.create("B-6", { dateCreated: "2000" });
  await catalog.t.run(async (ctx) => {
    for (const id of [archivedLate, archivedEarly, archivedUndated])
      await ctx.db.patch(id, { status: "archived" });
  });
  // Raw patches skip the write path; the backfill brings the documents in line.
  await catalog.backfill();

  // A full first page: read from all statuses, the active Objects ahead
  // would fill it and be filtered away.
  for (const [sort, expected] of [
    ["madeEarliest", ["A-2", "A-1"]],
    ["madeLatest", ["A-1", "A-2"]],
  ] as const) {
    const first = await catalog.user.query(api.collections.list, {
      organizationId: catalog.organizationId,
      paginationOpts: { cursor: null, numItems: 2 },
      sort,
      status: "archived",
    });
    expect(first.page.map((row) => row.accessionNumber)).toEqual(expected);
  }
  expect(
    await catalog.listedNumbers({ sort: "madeEarliest", status: "archived" }),
  ).toEqual(["A-2", "A-1", "A-3"]);
  expect(
    await catalog.listedNumbers({ sort: "madeLatest", status: "archived" }),
  ).toEqual(["A-1", "A-2", "A-3"]);
  expect(
    await catalog.listedNumbers({ sort: "madeEarliest", status: "active" }),
  ).toEqual(["B-3", "B-4", "B-1", "B-2", "B-5", "B-6"]);
  expect(await catalog.listedNumbers({ sort: "madeLatest" })).toEqual([
    "B-6",
    "B-5",
    "B-2",
    "B-1",
    "B-4",
    "B-3",
  ]);
});

test("a date made order lists newest first until the search documents are ready, and never under a stable order", async () => {
  const catalog = await setupDatedCatalog();
  await catalog.create("A", { dateCreated: "1900" });
  await catalog.create("B", { dateCreated: "1800" });
  await catalog.create("C", { dateCreated: "1850" });

  expect(await catalog.listedNumbers({ sort: "madeEarliest" })).toEqual([
    "C",
    "B",
    "A",
  ]);
  expect(await catalog.listedNumbers({ sort: "madeLatest" })).toEqual([
    "C",
    "B",
    "A",
  ]);

  await catalog.backfill();
  expect(await catalog.listedNumbers({ sort: "madeEarliest" })).toEqual([
    "B",
    "C",
    "A",
  ]);
  const stable = await catalog.t.run((ctx) =>
    listCatalogPage(
      ctx,
      { organizationId: catalog.organizationId, sort: "madeEarliest" },
      { numItems: 10, cursor: null },
      { stableOrder: true },
    ),
  );
  expect(stable.page.map((row) => row.accessionNumber)).toEqual([
    "C",
    "B",
    "A",
  ]);
});
