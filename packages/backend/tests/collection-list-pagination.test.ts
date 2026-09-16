import type { FunctionArgs } from "convex/server";
import { describe, expect, test } from "vitest";
import { api } from "../convex/_generated/api";
import type { Doc } from "../convex/_generated/dataModel";
import {
  authedForUser,
  createConvexTest,
  createOrgUserWithPermissions,
} from "./testHarness";

async function setup() {
  const t = createConvexTest();
  const owner = await createOrgUserWithPermissions(t, ["collections.read"]);
  const other = await createOrgUserWithPermissions(t, ["collections.read"]);
  const asUser = authedForUser(t, owner.userId);
  let creationTime = 100;
  async function insert(overrides: Partial<Doc<"collections">> = {}) {
    return await t.run((ctx) =>
      ctx.db.insert("collections", {
        organizationId: owner.organizationId,
        accessionNumber: `OBJ-${creationTime++}`,
        title: "Ordinary object",
        status: "active",
        catalogedBy: owner.userId,
        catalogedAt: 100,
        ...overrides,
      }),
    );
  }
  async function allPages(
    filters: Omit<
      FunctionArgs<typeof api.collections.list>,
      "organizationId" | "paginationOpts"
    > = {},
  ) {
    const ids: string[] = [];
    let cursor: string | null = null;
    for (let pageNumber = 0; pageNumber < 100; pageNumber++) {
      const result = await asUser.query(api.collections.list, {
        organizationId: owner.organizationId,
        paginationOpts: { cursor, numItems: 2 },
        ...filters,
      });
      ids.push(...result.page.map((row) => row._id));
      if (result.isDone) return ids;
      expect(result.continueCursor).not.toBe(cursor);
      cursor = result.continueCursor;
    }
    throw new Error("Pagination did not finish");
  }
  return { t, owner, other, asUser, insert, allPages };
}

describe("bounded collection pagination", () => {
  test("rare filters advance through empty pages and return all matches newest first", async () => {
    const f = await setup();
    const older = await f.insert({ culture: "Ancient Roman" });
    const newer = await f.insert({ culture: "Roman" });
    for (let i = 0; i < 8; i++) await f.insert({ culture: "Greek" });
    const first = await f.asUser.query(api.collections.list, {
      organizationId: f.owner.organizationId,
      culture: "ROMAN",
      paginationOpts: { cursor: null, numItems: 2 },
    });
    expect(first.page).toEqual([]);
    expect(first.isDone).toBe(false);
    expect(await f.allPages({ culture: "ROMAN" })).toEqual([newer, older]);
  });

  test("combines text, status, location, type, display and inclusive date filters", async () => {
    const f = await setup();
    const locationId = await f.t.run((ctx) =>
      ctx.db.insert("locations", {
        organizationId: f.owner.organizationId,
        name: "Store",
        type: "room",
        sortOrder: 0,
        isActive: true,
      }),
    );
    const fields = {
      currentLocationId: locationId,
      objectType: "Vase",
      displayStatus: "on_display",
      culture: "Roman",
      period: "Early Imperial",
      materials: "Clay and bronze",
      catalogedAt: 0,
    };
    const match = await f.insert(fields);
    await f.insert({ ...fields, catalogedAt: 1 });
    await f.insert({ ...fields, status: "archived" });
    await f.insert({ ...fields, materials: "Gold" });
    await f.insert({ ...fields, organizationId: f.other.organizationId });
    expect(
      await f.allPages({
        status: "active",
        locationId,
        objectType: "Vase",
        displayStatus: "on_display",
        culture: "rom",
        period: "imperial",
        materials: "BRONZE",
        catalogedFrom: 0,
        catalogedTo: 0,
      }),
    ).toEqual([match]);
  });

  test("search preserves title token/prefix matching and substring matches in other fields", async () => {
    const f = await setup();
    const title = await f.insert({ title: "Roman bronze sculpture" });
    const description = await f.insert({ description: "A ROMAN artifact" });
    const accession = await f.insert({ accessionNumber: "X-ROMAN-22" });
    const duplicate = await f.insert({
      title: "Roman bronze sculpture",
      description: "Roman",
    });
    await f.insert({ title: "Unrelated object" });
    await f.insert({ title: "Roman", organizationId: f.other.organizationId });
    expect(await f.allPages({ search: "rom" })).toEqual([
      duplicate,
      accession,
      description,
      title,
    ]);
  });

  test("group membership supports direct and many-to-many links without duplicates", async () => {
    const f = await setup();
    const groupId = await f.t.run((ctx) =>
      ctx.db.insert("collectionGroups", {
        organizationId: f.owner.organizationId,
        name: "Group",
        createdAt: 0,
        createdBy: f.owner.userId,
      }),
    );
    const direct = await f.insert({ collectionGroupId: groupId });
    const linked = await f.insert();
    const foreign = await f.insert({ organizationId: f.other.organizationId });
    await f.insert();
    await f.t.run(async (ctx) => {
      for (const collectionId of [direct, linked, foreign])
        await ctx.db.insert("collectionGroupItems", {
          collectionGroupId: groupId,
          collectionId,
          addedAt: 0,
          addedBy: f.owner.userId,
        });
    });
    expect(await f.allPages({ collectionGroupId: groupId })).toEqual([
      linked,
      direct,
    ]);
  });

  test("open deaccessions are excluded but rejected and foreign records do not hide objects", async () => {
    const f = await setup();
    const pending = await f.insert();
    const approved = await f.insert();
    const rejected = await f.insert();
    const foreign = await f.insert();
    await f.t.run(async (ctx) => {
      for (const [collectionId, status, organizationId] of [
        [pending, "pending", f.owner.organizationId],
        [approved, "approved", f.owner.organizationId],
        [rejected, "rejected", f.owner.organizationId],
        [foreign, "pending", f.other.organizationId],
      ] as const)
        await ctx.db.insert("deaccessions", {
          collectionId,
          organizationId,
          status,
          deaccessionNumber: collectionId,
          dateDeaccessioned: 0,
          reason: "Test",
          method: "sale",
        });
    });
    expect(await f.allPages()).toEqual([foreign, rejected]);
  });

  test("new records between requests do not shift the continuation and duplicate rows", async () => {
    const f = await setup();
    const older = await f.insert({ culture: "Roman" });
    const middle = await f.insert({ culture: "Roman" });
    const newest = await f.insert({ culture: "Roman" });
    const first = await f.asUser.query(api.collections.list, {
      organizationId: f.owner.organizationId,
      culture: "Roman",
      paginationOpts: { numItems: 2, cursor: null },
    });
    expect(first.page.map((row) => row._id)).toEqual([newest, middle]);
    await f.insert({ culture: "Roman" });
    const second = await f.asUser.query(api.collections.list, {
      organizationId: f.owner.organizationId,
      culture: "Roman",
      paginationOpts: { numItems: 2, cursor: first.continueCursor },
    });
    expect(second.page.map((row) => row._id)).toEqual([older]);
  });

  test("every page requires collection access", async () => {
    const f = await setup();
    await f.insert();
    await expect(
      f.t.query(api.collections.list, {
        organizationId: f.owner.organizationId,
        culture: "Roman",
        paginationOpts: { numItems: 2, cursor: null },
      }),
    ).rejects.toThrow();
    await expect(
      authedForUser(f.t, f.other.userId).query(api.collections.list, {
        organizationId: f.owner.organizationId,
        paginationOpts: { numItems: 2, cursor: null },
      }),
    ).rejects.toThrow();
  });
});

test("resolveId uses typed IDs and preserves null for invalid, unrelated and deleted documents", async () => {
  const f = await setup();
  const collectionId = await f.insert();
  const groupId = await f.t.run((ctx) =>
    ctx.db.insert("collectionGroups", {
      organizationId: f.owner.organizationId,
      name: "Group",
      createdAt: 0,
      createdBy: f.owner.userId,
    }),
  );
  expect(
    await f.t.query(api.collections.resolveId, { id: collectionId }),
  ).toEqual({ type: "collection", id: collectionId });
  expect(await f.t.query(api.collections.resolveId, { id: groupId })).toEqual({
    type: "collectionGroup",
    id: groupId,
  });
  for (const id of ["invalid", "", f.owner.organizationId])
    expect(await f.t.query(api.collections.resolveId, { id })).toBeNull();
  await f.t.run((ctx) => ctx.db.delete(collectionId));
  expect(
    await f.t.query(api.collections.resolveId, { id: collectionId }),
  ).toBeNull();
});
