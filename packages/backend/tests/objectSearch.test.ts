import type { FunctionArgs } from "convex/server";
import { expect, test, vi } from "vitest";
import { api, internal } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
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
  expect(facets.objectTypes.map((facet) => facet.value)).toEqual([
    "coin",
    "lamp",
    "vessel",
  ]);
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
});
