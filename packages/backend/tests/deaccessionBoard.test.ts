import { expect, test } from "vitest";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import * as deaccessions from "../convex/deaccessions";
import { expectMatchesReturns } from "./returnsValidation";
import {
  authedForUser,
  type ConvexTest,
  createConvexTest,
  createOrgUserCollectionWithPermissions,
} from "./testHarness";

async function setupBoard(t: ConvexTest, permissions = ["collections.read"]) {
  const setup = await createOrgUserCollectionWithPermissions(t, permissions);
  await t.run((ctx) =>
    ctx.db.insert("workflowConfigs", {
      organizationId: setup.organizationId,
      workflowType: "deaccession",
      steps: [
        { stepNumber: 1, roleId: setup.roleId, name: "Registrar Review" },
        { stepNumber: 2, roleId: setup.roleId, name: "Board Approval" },
      ],
      canInitiateRoles: [setup.roleId],
    }),
  );
  return setup;
}

async function insertDeaccessions(
  t: ConvexTest,
  setup: {
    organizationId: Id<"organizations">;
    collectionId: Id<"collections">;
  },
  rows: Array<{
    status: "pending" | "approved" | "rejected";
    workflowStep?: number;
    count: number;
    prefix: string;
  }>,
) {
  await t.run(async (ctx) => {
    for (const row of rows) {
      for (let index = 0; index < row.count; index += 1) {
        await ctx.db.insert("deaccessions", {
          organizationId: setup.organizationId,
          collectionId: setup.collectionId,
          deaccessionNumber: `${row.prefix}-${index}`,
          dateDeaccessioned: Date.UTC(2026, 0, 1) + index * 1000,
          reason: "Duplicate",
          method: "transfer",
          status: row.status,
          workflowStep: row.workflowStep,
        });
      }
    }
  });
}

test("a column paginates beyond the first hundred and board counts match the whole organization", async () => {
  const t = createConvexTest();
  const setup = await setupBoard(t);
  await insertDeaccessions(t, setup, [
    { status: "pending", workflowStep: 1, count: 130, prefix: "REV" },
    { status: "approved", workflowStep: 2, count: 3, prefix: "OK" },
    { status: "rejected", workflowStep: 1, count: 2, prefix: "NO" },
  ]);
  const user = authedForUser(t, setup.userId);

  const first = await user.query(api.deaccessions.listBoardColumn, {
    organizationId: setup.organizationId,
    column: { kind: "step", step: 1 },
    paginationOpts: { cursor: null, numItems: 100 },
  });
  const second = await user.query(api.deaccessions.listBoardColumn, {
    organizationId: setup.organizationId,
    column: { kind: "step", step: 1 },
    paginationOpts: { cursor: first.continueCursor, numItems: 100 },
  });
  const counts = await user.query(api.deaccessions.getBoardCounts, {
    organizationId: setup.organizationId,
  });

  expectMatchesReturns(deaccessions.listBoardColumn, first);
  expectMatchesReturns(deaccessions.getBoardCounts, counts);
  expect(first.page).toHaveLength(100);
  expect(first.isDone).toBe(false);
  expect(second.page).toHaveLength(30);
  expect(second.isDone).toBe(true);
  expect(
    new Set([...first.page, ...second.page].map((row) => row._id)).size,
  ).toBe(130);
  expect(counts).toEqual({
    pending: 130,
    approved: 3,
    rejected: 2,
    columns: [
      { stepNumber: 1, count: 130 },
      { stepNumber: 2, count: 0 },
      { stepNumber: -1, count: 3 },
    ],
  });
});

test("legacy rows without a step wait in the first step and rows past a shortened workflow wait in its last step", async () => {
  const t = createConvexTest();
  const setup = await setupBoard(t);
  await insertDeaccessions(t, setup, [
    { status: "pending", count: 2, prefix: "LEGACY" },
    { status: "pending", workflowStep: 1, count: 1, prefix: "FIRST" },
    { status: "pending", workflowStep: 4, count: 1, prefix: "BEYOND" },
  ]);
  const user = authedForUser(t, setup.userId);
  const column = async (step: number) =>
    (
      await user.query(api.deaccessions.listBoardColumn, {
        organizationId: setup.organizationId,
        column: { kind: "step", step },
        paginationOpts: { cursor: null, numItems: 50 },
      })
    ).page
      .map((row) => row.deaccessionNumber)
      .sort();

  expect(await column(1)).toEqual(["FIRST-0", "LEGACY-0", "LEGACY-1"]);
  expect(await column(2)).toEqual(["BEYOND-0"]);
  const counts = await user.query(api.deaccessions.getBoardCounts, {
    organizationId: setup.organizationId,
  });
  expect(counts.columns).toEqual([
    { stepNumber: 1, count: 3 },
    { stepNumber: 2, count: 1 },
    { stepNumber: -1, count: 0 },
  ]);
});

test("without a configured workflow every pending deaccession waits in one review column", async () => {
  const t = createConvexTest();
  const setup = await createOrgUserCollectionWithPermissions(t, [
    "collections.read",
  ]);
  await insertDeaccessions(t, setup, [
    { status: "pending", count: 1, prefix: "LEGACY" },
    { status: "pending", workflowStep: 3, count: 1, prefix: "STALE" },
  ]);
  const user = authedForUser(t, setup.userId);

  const reviewColumn = await user.query(api.deaccessions.listBoardColumn, {
    organizationId: setup.organizationId,
    column: { kind: "step", step: 1 },
    paginationOpts: { cursor: null, numItems: 10 },
  });
  const counts = await user.query(api.deaccessions.getBoardCounts, {
    organizationId: setup.organizationId,
  });

  expect(reviewColumn.page.map((row) => row.deaccessionNumber).sort()).toEqual([
    "LEGACY-0",
    "STALE-0",
  ]);
  expect(counts.columns).toEqual([
    { stepNumber: 1, count: 2 },
    { stepNumber: -1, count: 0 },
  ]);
});

test("approved and rejected columns list only their decisions, newest first", async () => {
  const t = createConvexTest();
  const setup = await setupBoard(t);
  await insertDeaccessions(t, setup, [
    { status: "approved", count: 2, prefix: "OK" },
    { status: "rejected", count: 1, prefix: "NO" },
    { status: "pending", workflowStep: 1, count: 1, prefix: "REV" },
  ]);
  const user = authedForUser(t, setup.userId);
  const column = async (kind: "approved" | "rejected") =>
    (
      await user.query(api.deaccessions.listBoardColumn, {
        organizationId: setup.organizationId,
        column: { kind },
        paginationOpts: { cursor: null, numItems: 10 },
      })
    ).page.map((row) => row.deaccessionNumber);

  expect(await column("approved")).toEqual(["OK-1", "OK-0"]);
  expect(await column("rejected")).toEqual(["NO-0"]);
});

test("board search matches the object title within the requested column only", async () => {
  const t = createConvexTest();
  const setup = await setupBoard(t, [
    "collections.read",
    "collections.create",
    "collections.update",
  ]);
  const user = authedForUser(t, setup.userId);
  const otherCollectionId = await t.run((ctx) =>
    ctx.db.insert("collections", {
      organizationId: setup.organizationId,
      accessionNumber: "OBJ-FJORD",
      title: "Fjordheim tapestry",
      status: "active",
      catalogedBy: setup.userId,
      catalogedAt: Date.now(),
    }),
  );
  for (const collectionId of [setup.collectionId, otherCollectionId]) {
    await user.mutation(api.deaccessions.create, {
      organizationId: setup.organizationId,
      collectionId,
      dateDeaccessioned: Date.UTC(2026, 1, 1),
      reason: "Collections review",
      method: "transfer",
    });
  }

  const search = async (column: { kind: "step"; step: number }) =>
    (
      await user.query(api.deaccessions.listBoardColumn, {
        organizationId: setup.organizationId,
        column,
        search: "Fjordheim",
        paginationOpts: { cursor: null, numItems: 10 },
      })
    ).page.map((row) => row.collectionTitle);

  expect(await search({ kind: "step", step: 1 })).toEqual([
    "Fjordheim tapestry",
  ]);
  expect(await search({ kind: "step", step: 2 })).toEqual([]);
});

test("board queries require collections.read in the organization", async () => {
  const t = createConvexTest();
  const setup = await setupBoard(t, []);
  const outsider = await createOrgUserCollectionWithPermissions(t, [
    "collections.read",
  ]);
  for (const caller of [
    authedForUser(t, setup.userId),
    authedForUser(t, outsider.userId),
  ]) {
    await expect(
      caller.query(api.deaccessions.getBoardCounts, {
        organizationId: setup.organizationId,
      }),
    ).rejects.toThrow("Permission denied");
    await expect(
      caller.query(api.deaccessions.listBoardColumn, {
        organizationId: setup.organizationId,
        column: { kind: "approved" },
        paginationOpts: { cursor: null, numItems: 10 },
      }),
    ).rejects.toThrow("Permission denied");
  }
});
