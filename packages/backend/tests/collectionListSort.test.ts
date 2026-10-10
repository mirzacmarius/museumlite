import type { FunctionArgs } from "convex/server";
import { expect, test } from "vitest";
import { api } from "../convex/_generated/api";
import type { Doc } from "../convex/_generated/dataModel";
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
