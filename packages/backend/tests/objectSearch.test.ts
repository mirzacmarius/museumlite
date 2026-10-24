import type { FunctionArgs } from "convex/server";
import { expect, test, vi } from "vitest";
import { api, internal } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import { OBJECT_SEARCH_DOCUMENT_VERSION } from "../convex/utils/objectSearchDocuments";
import {
  authedForUser,
  createConvexTest,
  createOrgUserWithPermissions,
} from "./testHarness";

type ListFilters = Omit<
  FunctionArgs<typeof api.collections.list>,
  "organizationId" | "paginationOpts"
>;

async function setupCatalog() {
  const t = createConvexTest();
  const owner = await createOrgUserWithPermissions(t, [
    "collections.read",
    "collections.create",
    "collections.update",
    "collections.delete",
  ]);
  const user = authedForUser(t, owner.userId);
  const { organizationId } = owner;

  async function create(
    fields: Omit<FunctionArgs<typeof api.collections.create>, "organizationId">,
  ) {
    return await user.mutation(api.collections.create, {
      organizationId,
      ...fields,
    });
  }

  async function addImage(collectionId: Id<"collections">) {
    await t.run(async (ctx) => {
      await ctx.db.insert("mediaFiles", {
        collectionId,
        organizationId,
        storageId: await ctx.storage.store(new Blob(["photo"])),
        fileName: "front.jpg",
        fileType: "image",
        fileSize: 5,
        mimeType: "image/jpeg",
        isPrimary: true,
        uploadedBy: owner.userId,
        uploadedAt: 2,
        uploadStatus: "completed",
      });
    });
  }

  /** The cron's work: every Organization's documents written and marked complete. */
  async function backfill() {
    vi.useFakeTimers();
    await t.mutation(internal.objectSearch.startOutdatedBackfills, {});
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    vi.useRealTimers();
  }

  async function list(filters: ListFilters = {}) {
    const rows: Array<{ accessionNumber: string; matchedField?: string }> = [];
    let cursor: string | null = null;
    for (let page = 0; page < 20; page++) {
      const result = await user.query(api.collections.list, {
        organizationId,
        paginationOpts: { cursor, numItems: 3 },
        ...filters,
      });
      rows.push(...result.page);
      if (result.isDone) return rows;
      cursor = result.continueCursor;
    }
    throw new Error("Pagination did not finish");
  }

  async function numbers(filters: ListFilters = {}) {
    return (await list(filters)).map((row) => row.accessionNumber).sort();
  }

  return { t, user, organizationId, create, addImage, backfill, list, numbers };
}

test("a word in any indexed field finds the Object, identifier prefixes come first and each row says where it matched", async () => {
  const catalog = await setupCatalog();
  await catalog.create({
    accessionNumber: "2024.1",
    title: "Harbour at dusk",
    description: "A fishing boat lies at anchor below the quay.",
  });
  await catalog.create({
    accessionNumber: "2024.2",
    title: "Boat study",
    creator: "J. Smith",
  });
  await catalog.create({
    accessionNumber: "2023.9",
    title: "Weight",
    tags: ["anchor", "iron"],
    inscriptionMarks: [{ label: "Base", description: "Stamped LOWESTOFT" }],
  });
  await catalog.create({
    accessionNumber: "B-12",
    title: "Storage jar",
    objectType: "Amphora",
    provenance: "Ex Tollemache collection",
  });
  const portrait = await catalog.create({
    accessionNumber: "A-77",
    title: "Portrait",
    materials: '["Oil paint","Canvas"]',
  });
  await catalog.t.run(async (ctx) => {
    await ctx.db.patch(portrait, {
      customFields: { donorFile: "Carnarvon bequest" },
    });
  });
  await catalog.backfill();

  const anchor = await catalog.list({ search: "anchor" });
  expect(anchor.map((row) => row.accessionNumber).sort()).toEqual([
    "2023.9",
    "2024.1",
  ]);
  expect(
    Object.fromEntries(
      anchor.map((row) => [row.accessionNumber, row.matchedField]),
    ),
  ).toEqual({ "2024.1": "description", "2023.9": "tags" });

  const year = await catalog.list({ search: "2024" });
  expect(year.slice(0, 2).map((row) => row.accessionNumber)).toEqual([
    "2024.1",
    "2024.2",
  ]);
  expect(year.every((row) => row.matchedField === "accessionNumber")).toBe(
    true,
  );
  expect(year).toHaveLength(2);

  expect(await catalog.numbers({ search: "lowestoft" })).toEqual(["2023.9"]);
  expect(await catalog.numbers({ search: "canvas" })).toEqual(["A-77"]);
  expect(await catalog.numbers({ search: "carnarvon" })).toEqual(["A-77"]);
  expect(await catalog.numbers({ search: "smith" })).toEqual(["2024.2"]);
  expect(await catalog.list({ search: "amphora" })).toMatchObject([
    { accessionNumber: "B-12", matchedField: "objectType" },
  ]);
  expect(await catalog.list({ search: "tollemache" })).toMatchObject([
    { accessionNumber: "B-12", matchedField: "provenance" },
  ]);
  expect(await catalog.numbers({ search: "nothing-here" })).toEqual([]);
});

test("a record change updates its search document in the same transaction", async () => {
  const catalog = await setupCatalog();
  const id = await catalog.create({
    accessionNumber: "1.1",
    title: "Vase",
    description: "Plain glaze.",
  });
  await catalog.backfill();
  expect(await catalog.numbers({ search: "lustre" })).toEqual([]);

  await catalog.user.mutation(api.collections.update, {
    collectionId: id,
    description: "Lustre glaze with a chipped foot.",
  });
  expect(await catalog.numbers({ search: "lustre" })).toEqual(["1.1"]);
  expect(await catalog.numbers({ search: "plain" })).toEqual([]);

  await catalog.user.mutation(api.collections.archiveCollection, {
    collectionId: id,
    reason: "Duplicate record",
  });
  expect(await catalog.numbers({ search: "lustre" })).toEqual([]);
  expect(
    await catalog.numbers({ search: "lustre", status: "archived" }),
  ).toEqual(["1.1"]);
});

test("until an Organization's documents are complete the catalog searches records directly", async () => {
  const catalog = await setupCatalog();
  await catalog.create({
    accessionNumber: "9.1",
    title: "Lantern clock",
    description: "Brass, with alarm.",
  });
  // No backfill has run: the documents written by the create are not trusted yet.
  const rows = await catalog.list({ search: "lantern" });
  expect(rows.map((row) => row.accessionNumber)).toEqual(["9.1"]);
  expect(rows[0]?.matchedField).toBeUndefined();
  expect(await catalog.numbers({ search: "9.1" })).toEqual(["9.1"]);
});

test("the backfill pages through every Object and every Organization", async () => {
  const catalog = await setupCatalog();
  for (let index = 0; index < 60; index++) {
    await catalog.create({
      accessionNumber: `B-${index}`,
      title: index === 59 ? "Brass lantern" : `Plate ${index}`,
    });
  }
  const others = await catalog.t.run(async (ctx) => {
    // Documents written before search existed: the backfill writes them all.
    for (const document of await ctx.db
      .query("objectSearchDocuments")
      .collect()) {
      await ctx.db.delete(document._id);
    }
    const ids = [];
    for (let index = 0; index < 200; index++) {
      ids.push(
        await ctx.db.insert("organizations", {
          name: `Museum ${index}`,
          slug: `museum-${index}`,
          type: "museum",
        }),
      );
    }
    return ids;
  });
  await catalog.backfill();

  const rows = await catalog.list({ search: "lantern" });
  expect(rows.map((row) => row.accessionNumber)).toEqual(["B-59"]);
  expect(rows[0]?.matchedField).toBe("title");
  const last = others.at(-1);
  if (!last) throw new Error("No Organizations inserted");
  const state = await catalog.t.run((ctx) =>
    ctx.db
      .query("objectSearchBackfills")
      .withIndex("by_organization", (q) => q.eq("organizationId", last))
      .first(),
  );
  expect(state?.completedAt).toBeDefined();
});

test("documents of an older version are rebuilt, and a run begun under one starts again", async () => {
  const catalog = await setupCatalog();
  for (let index = 0; index < 60; index++) {
    await catalog.create({
      accessionNumber: `V-${index}`,
      title: index === 0 ? "Brass lantern" : `Plate ${index}`,
    });
  }
  await catalog.backfill();
  const complete = async () =>
    await catalog.t.run((ctx) =>
      ctx.db
        .query("objectSearchBackfills")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", catalog.organizationId),
        )
        .first(),
    );
  const done = await complete();
  if (!done) throw new Error("No backfill state");

  vi.useFakeTimers();
  try {
    // Completed at an older version a moment ago: rebuilt on the next run.
    await catalog.t.run((ctx) =>
      ctx.db.patch(done._id, { version: OBJECT_SEARCH_DOCUMENT_VERSION - 1 }),
    );
    expect(
      await catalog.t.mutation(
        internal.objectSearch.startOutdatedBackfills,
        {},
      ),
    ).toBe(1);
    await catalog.t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(await complete()).toMatchObject({
      version: OBJECT_SEARCH_DOCUMENT_VERSION,
      completedAt: expect.any(Number),
    });

    // A later page of a run begun under the older version starts it again.
    await catalog.t.run((ctx) =>
      ctx.db.patch(done._id, {
        version: OBJECT_SEARCH_DOCUMENT_VERSION - 1,
        completedAt: undefined,
      }),
    );
    const firstPage = await catalog.t.run((ctx) =>
      ctx.db
        .query("collections")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", catalog.organizationId),
        )
        .paginate({ numItems: 50, cursor: null }),
    );
    await catalog.t.mutation(internal.objectSearch.backfillPage, {
      organizationId: catalog.organizationId,
      cursor: firstPage.continueCursor,
    });
    const restarted = await complete();
    expect(restarted?.version).toBe(OBJECT_SEARCH_DOCUMENT_VERSION);
    expect(restarted?.completedAt).toBeUndefined();
    await catalog.t.finishAllScheduledFunctions(vi.runAllTimers);
  } finally {
    vi.useRealTimers();
  }
  expect((await complete())?.completedAt).toBeDefined();
  expect(await catalog.list({ search: "lantern" })).toMatchObject([
    { accessionNumber: "V-0", matchedField: "title" },
  ]);
});

test("a filtered export holds the rows the catalog list shows for the same search", async () => {
  const catalog = await setupCatalog();
  await catalog.create({ accessionNumber: "F-1", title: "Fishing boat" });
  await catalog.create({ accessionNumber: "F-2", title: "Boat hook" });
  await catalog.create({ accessionNumber: "F-3", title: "Fishing net" });
  await catalog.create({ accessionNumber: "F-4", title: "Lamp" });
  await catalog.backfill();
  // Any word matches, the last as a prefix: not the phrase as a substring.
  const listed = await catalog.numbers({ search: "fishing boat" });
  expect(listed).toEqual(["F-1", "F-2", "F-3"]);

  vi.useFakeTimers();
  try {
    vi.advanceTimersByTime(1000);
    const jobId = await catalog.user.mutation(api.exports.create, {
      organizationId: catalog.organizationId,
      requestKey: "search",
      format: "jsonl",
      source: {
        kind: "objects",
        mode: "filtered",
        filters: { search: "fishing boat" },
      },
    });
    await catalog.t.finishInProgressScheduledFunctions();
    await catalog.t.finishAllScheduledFunctions(() =>
      vi.advanceTimersByTime(1),
    );
    const response = await catalog.user.fetch(
      `/exports/download?jobId=${jobId}`,
    );
    expect(response.status).toBe(200);
    const exported = (await response.text())
      .trim()
      .split("\n")
      .map(
        (line) =>
          (JSON.parse(line) as { accessionNumber: string }).accessionNumber,
      )
      .sort();
    expect(exported).toEqual(listed);
  } finally {
    vi.useRealTimers();
  }
});

test("an identifier too long to index as a word is still found by its beginning in the list and in bulk edits", async () => {
  const catalog = await setupCatalog();
  await catalog.create({
    accessionNumber: "INV2024ETNOGRAFISKSAMLINGOBJEKT0001",
    title: "Drum",
  });
  await catalog.create({ accessionNumber: "B-1", title: "Basket" });
  await catalog.backfill();
  const search = "inv2024etnografisksamling";

  expect(await catalog.list({ search })).toEqual([
    expect.objectContaining({
      accessionNumber: "INV2024ETNOGRAFISKSAMLINGOBJEKT0001",
      matchedField: "accessionNumber",
    }),
  ]);
  const preview = await catalog.user.query(api.bulkFieldEdits.preview, {
    organizationId: catalog.organizationId,
    scope: { kind: "filters", filters: { search } },
    edit: { field: "culture", operation: "set", value: "Sámi" },
  });
  expect(preview).toEqual(
    expect.objectContaining({ kind: "preview", matching: 1, changing: 1 }),
  );
});

test("facet filters and values come from the records, with photographs and the cataloguing date", async () => {
  const catalog = await setupCatalog();
  const roman = await catalog.create({
    accessionNumber: "R-1",
    title: "Lamp",
    culture: "Roman",
    period: "Imperial",
    condition: "Good",
    materials: '["Terracotta"]',
    objectType: "Lamp",
  });
  await catalog.create({
    accessionNumber: "R-2",
    title: "Coin",
    culture: " roman ",
    period: "Republican",
    condition: "Fair",
    materials: "Bronze",
    objectType: "Coin",
  });
  await catalog.create({
    accessionNumber: "G-1",
    title: "Amphora",
    culture: "Greek",
    materials: '["Terracotta","Slip"]',
    objectType: "Vessel",
  });
  await catalog.addImage(roman);
  await catalog.backfill();

  expect(await catalog.numbers({ culture: "Roman" })).toEqual(["R-1", "R-2"]);
  expect(
    await catalog.numbers({ culture: "roman", period: "Imperial" }),
  ).toEqual(["R-1"]);
  expect(await catalog.numbers({ condition: "fair" })).toEqual(["R-2"]);
  expect(await catalog.numbers({ materials: "Terracotta" })).toEqual([
    "G-1",
    "R-1",
  ]);
  expect(await catalog.numbers({ hasImage: true })).toEqual(["R-1"]);
  expect(await catalog.numbers({ hasImage: false })).toEqual(["G-1", "R-2"]);
  expect(
    await catalog.numbers({ search: "terracotta", hasImage: true }),
  ).toEqual(["R-1"]);
  expect(
    await catalog.numbers({ search: "terracotta", culture: "Greek" }),
  ).toEqual(["G-1"]);

  const facets = await catalog.user.query(api.objectSearch.facetValues, {
    organizationId: catalog.organizationId,
  });
  expect(facets.cultures).toEqual([
    { value: "greek", label: "Greek" },
    { value: "roman", label: "Roman" },
  ]);
  expect(facets.periods.map((facet) => facet.value)).toEqual([
    "imperial",
    "republican",
  ]);
  expect(facets.conditions.map((facet) => facet.value)).toEqual([
    "fair",
    "good",
  ]);
  expect(facets.materials.map((facet) => facet.value)).toEqual([
    "bronze",
    "slip",
    "terracotta",
  ]);
  expect(facets.objectTypes).toEqual([
    { value: "coin", label: "coin" },
    { value: "lamp", label: "lamp" },
    { value: "vessel", label: "vessel" },
  ]);
  // A type no option spells is offered as recorded, lower-cased; picking it
  // still finds the Object.
  expect(await catalog.numbers({ objectType: "vessel" })).toEqual(["G-1"]);
  expect(await catalog.numbers({ objectType: "LAMP" })).toEqual(["R-1"]);
});

test("advanced filters combine conditions within a group and groups with each other", async () => {
  const catalog = await setupCatalog();
  await catalog.create({
    accessionNumber: "P-1",
    title: "Still life",
    creator: "Anna Berg",
    dateCreated: "1890",
    objectType: '["Painting","Oil painting"]',
  });
  await catalog.create({
    accessionNumber: "P-2",
    title: "Landscape",
    creator: "Anna Berg",
    dateCreated: "1910",
    objectType: "Painting",
  });
  await catalog.create({
    accessionNumber: "S-1",
    title: "Torso",
    creator: "Karl Dahl",
    dateCreated: "1905",
    objectType: "Sculpture",
  });

  const bergBefore1900: ListFilters = {
    advancedFilters: [
      {
        operator: "AND",
        filters: [
          { field: "creator", operator: "contains", value: "berg" },
          { field: "dateCreated", operator: "lt", value: "1900" },
        ],
      },
    ],
  };
  expect(await catalog.numbers(bergBefore1900)).toEqual(["P-1"]);

  expect(
    await catalog.numbers({
      advancedFilters: [
        {
          operator: "OR",
          filters: [
            { field: "objectType", operator: "eq", value: "Sculpture" },
            { field: "dateCreated", operator: "gte", value: "1910" },
          ],
        },
      ],
    }),
  ).toEqual(["P-2", "S-1"]);

  expect(
    await catalog.numbers({
      filterCombinations: "OR",
      advancedFilters: [
        {
          operator: "AND",
          filters: [
            { field: "objectType", operator: "in", value: "Sculpture, Print" },
          ],
        },
        {
          operator: "AND",
          filters: [{ field: "title", operator: "eq", value: "still life" }],
        },
      ],
    }),
  ).toEqual(["P-1", "S-1"]);

  expect(
    await catalog.numbers({
      advancedFilters: [
        {
          operator: "AND",
          filters: [{ field: "objectType", operator: "ne", value: "Painting" }],
        },
      ],
    }),
  ).toEqual(["S-1"]);

  // A condition left blank tests nothing: "is not" blank does not let every
  // Object through, and "is" blank does not keep every Object out.
  for (const operator of ["ne", "eq"] as const) {
    expect(
      await catalog.numbers({
        advancedFilters: [
          {
            operator: operator === "ne" ? "OR" : "AND",
            filters: [
              { field: "objectType", operator: "eq", value: "Sculpture" },
              { field: "title", operator, value: "  " },
            ],
          },
        ],
      }),
      operator,
    ).toEqual(["S-1"]);
  }
});

test("a date made range keeps overlapping and open-ended dates and drops undated ones alike in the list, a filtered export and a bulk edit", async () => {
  const catalog = await setupCatalog();
  await catalog.create({
    accessionNumber: "Y-1",
    title: "Jug",
    dateCreated: "1850",
  });
  await catalog.create({
    accessionNumber: "Y-2",
    title: "Chest",
    dateCreated: "before 1700",
  });
  await catalog.create({
    accessionNumber: "Y-3",
    title: "Clock",
    dateCreated: "after 1840",
  });
  // Circa widens by five years either side: 1790 to 1800.
  await catalog.create({
    accessionNumber: "Y-4",
    title: "Chair",
    dateCreated: "c. 1795",
  });
  await catalog.create({
    accessionNumber: "Y-5",
    title: "Vase",
    dateCreated: "Ming dynasty",
  });
  await catalog.create({ accessionNumber: "Y-6", title: "Box" });
  await catalog.create({
    accessionNumber: "Y-7",
    title: "Radio",
    dateCreated: "1950",
  });
  await catalog.create({
    accessionNumber: "Y-8",
    title: "Coin",
    dateCreated: "500 BC",
  });
  // The structured date wins: this text alone would not meet the range.
  await catalog.create({
    accessionNumber: "Y-9",
    title: "Print",
    dateCreated: "1950s reprint",
    dateCreatedEdtf: "1801/1810",
  });
  const range = { madeFrom: 1600, madeTo: 1860 };
  const expected = ["Y-1", "Y-2", "Y-3", "Y-4", "Y-9"];

  // The range is read from the records, so it holds before the backfill too.
  expect(await catalog.numbers(range)).toEqual(expected);
  await catalog.backfill();
  expect(await catalog.numbers(range)).toEqual(expected);
  expect(await catalog.numbers({ ...range, sort: "madeEarliest" })).toEqual(
    expected,
  );
  // Astronomical years: 500 BC is -499; an open start meets any range.
  expect(await catalog.numbers({ madeFrom: -600, madeTo: -400 })).toEqual([
    "Y-2",
    "Y-8",
  ]);
  expect(await catalog.numbers({ madeFrom: 1900 })).toEqual(["Y-3", "Y-7"]);

  const preview = await catalog.user.query(api.bulkFieldEdits.preview, {
    organizationId: catalog.organizationId,
    scope: { kind: "filters", filters: range },
    edit: { field: "culture", operation: "set", value: "Norwegian" },
  });
  expect(preview).toEqual(
    expect.objectContaining({ kind: "preview", matching: expected.length }),
  );

  vi.useFakeTimers();
  try {
    vi.advanceTimersByTime(1000);
    const jobId = await catalog.user.mutation(api.exports.create, {
      organizationId: catalog.organizationId,
      requestKey: "made-range",
      format: "jsonl",
      source: { kind: "objects", mode: "filtered", filters: range },
    });
    await catalog.t.finishInProgressScheduledFunctions();
    await catalog.t.finishAllScheduledFunctions(() =>
      vi.advanceTimersByTime(1),
    );
    const response = await catalog.user.fetch(
      `/exports/download?jobId=${jobId}`,
    );
    expect(response.status).toBe(200);
    const exported = (await response.text())
      .trim()
      .split("\n")
      .map(
        (line) =>
          (JSON.parse(line) as { accessionNumber: string }).accessionNumber,
      )
      .sort();
    expect(exported).toEqual(expected);
  } finally {
    vi.useRealTimers();
  }
});

test("a filtered export refuses a date made range that is not whole years in order", async () => {
  const catalog = await setupCatalog();
  for (const filters of [
    { madeFrom: 1850.5 },
    { madeTo: 10_000 },
    { madeFrom: 1900, madeTo: 1800 },
  ]) {
    await expect(
      catalog.user.mutation(api.exports.create, {
        organizationId: catalog.organizationId,
        requestKey: `range-${JSON.stringify(filters)}`,
        format: "csv",
        source: { kind: "objects", mode: "filtered", filters },
      }),
    ).rejects.toThrow("Invalid date range");
  }
});

test("advanced filters compare the date made by the years it reads as, and as text when it reads as none", async () => {
  const catalog = await setupCatalog();
  // 1845 to 1855.
  await catalog.create({
    accessionNumber: "D-1",
    title: "Jug",
    dateCreated: "c. 1850",
  });
  await catalog.create({
    accessionNumber: "D-2",
    title: "Chest",
    dateCreated: "before 1700",
  });
  await catalog.create({
    accessionNumber: "D-3",
    title: "Print",
    dateCreatedEdtf: "1901/1910",
  });
  await catalog.create({
    accessionNumber: "D-4",
    title: "Vase",
    dateCreated: "Ming dynasty",
  });
  const where = (
    operator: "lt" | "lte" | "gt" | "gte",
    value: string,
  ): ListFilters => ({
    advancedFilters: [
      {
        operator: "AND",
        filters: [{ field: "dateCreated", operator, value }],
      },
    ],
  });

  // Text that reads as no date is compared as text, as before: "ming
  // dynasty" sorts after "1855".
  expect(await catalog.numbers(where("lt", "1848"))).toEqual(["D-1", "D-2"]);
  expect(await catalog.numbers(where("lte", "1845"))).toEqual(["D-1", "D-2"]);
  expect(await catalog.numbers(where("gt", "1855"))).toEqual(["D-3", "D-4"]);
  expect(await catalog.numbers(where("gte", "1855"))).toEqual([
    "D-1",
    "D-3",
    "D-4",
  ]);
  expect(await catalog.numbers(where("gt", "Han dynasty"))).toEqual(["D-4"]);
});
