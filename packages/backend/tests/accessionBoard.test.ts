import { expect, test } from "vitest";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import {
  authedForUser,
  type ConvexTest,
  createConvexTest,
  createOrgUserWithPermissions,
} from "./testHarness";

async function setupBoard(t: ConvexTest, permissions = ["collections.read"]) {
  const setup = await createOrgUserWithPermissions(t, permissions);
  await t.run((ctx) =>
    ctx.db.insert("workflowConfigs", {
      organizationId: setup.organizationId,
      workflowType: "accession",
      steps: [
        { stepNumber: 1, roleId: setup.roleId, name: "Registrar Review" },
        { stepNumber: 2, roleId: setup.roleId, name: "Curator Approval" },
      ],
      canInitiateRoles: [setup.roleId],
    }),
  );
  return setup;
}

async function insertAccessions(
  t: ConvexTest,
  organizationId: Id<"organizations">,
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
        await ctx.db.insert("accessions", {
          organizationId,
          accessionNumber: `${row.prefix}-${index}`,
          dateReceived: Date.UTC(2026, 0, 1) + index * 1000,
          source: "Donor",
          method: "gift",
          status: row.status,
          workflowStep: row.workflowStep,
        });
      }
    }
  });
}

test("a column paginates beyond the first hundred and counts match the whole organization", async () => {
  const t = createConvexTest();
  const setup = await setupBoard(t);
  await insertAccessions(t, setup.organizationId, [
    { status: "pending", workflowStep: 1, count: 130, prefix: "REV" },
    { status: "approved", workflowStep: 2, count: 3, prefix: "OK" },
    { status: "rejected", workflowStep: 1, count: 2, prefix: "NO" },
  ]);
  const user = authedForUser(t, setup.userId);

  const first = await user.query(api.accessions.listBoardColumn, {
    organizationId: setup.organizationId,
    column: { kind: "step", step: 1 },
    paginationOpts: { cursor: null, numItems: 100 },
  });
  const second = await user.query(api.accessions.listBoardColumn, {
    organizationId: setup.organizationId,
    column: { kind: "step", step: 1 },
    paginationOpts: { cursor: first.continueCursor, numItems: 100 },
  });
  const counts = await user.query(api.accessions.getBoardCounts, {
    organizationId: setup.organizationId,
  });

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
      { stepNumber: 0, count: 0 },
      { stepNumber: 1, count: 130 },
      { stepNumber: 2, count: 0 },
      { stepNumber: -1, count: 3 },
    ],
  });
});

test("legacy rows without a step appear in Draft and rows past a shortened workflow appear in its last step", async () => {
  const t = createConvexTest();
  const setup = await setupBoard(t);
  await insertAccessions(t, setup.organizationId, [
    { status: "pending", count: 2, prefix: "LEGACY" },
    { status: "pending", workflowStep: 0, count: 1, prefix: "DRAFT" },
    { status: "pending", workflowStep: 5, count: 1, prefix: "BEYOND" },
  ]);
  const user = authedForUser(t, setup.userId);
  const column = async (step: number) =>
    (
      await user.query(api.accessions.listBoardColumn, {
        organizationId: setup.organizationId,
        column: { kind: "step", step },
        paginationOpts: { cursor: null, numItems: 50 },
      })
    ).page
      .map((row) => row.accessionNumber)
      .sort();

  expect(await column(0)).toEqual(["DRAFT-0", "LEGACY-0", "LEGACY-1"]);
  expect(await column(1)).toEqual([]);
  expect(await column(2)).toEqual(["BEYOND-0"]);
  const counts = await user.query(api.accessions.getBoardCounts, {
    organizationId: setup.organizationId,
  });
  expect(
    counts.columns
      .filter((entry) => entry.stepNumber >= 0)
      .reduce((total, entry) => total + entry.count, 0),
  ).toBe(counts.pending);
});

test("board search finds accessions created by CSV import", async () => {
  const t = createConvexTest();
  const setup = await setupBoard(t, ["collections.read", "collections.create"]);
  const user = authedForUser(t, setup.userId);
  const jobId = await user.mutation(api.imports.createImportJob, {
    organizationId: setup.organizationId,
    type: "csv",
    entityType: "accessions",
    totalItems: 1,
  });
  await user.mutation(api.imports.importAccessionsBatch, {
    organizationId: setup.organizationId,
    jobId,
    batchIndex: 0,
    rows: [
      {
        rowNumber: 2,
        accessionNumber: "IMP-77",
        dateReceived: "2026-02-01",
        source: "Fjordheim estate",
        method: "bequest",
      },
    ],
  });

  const result = await user.query(api.accessions.listBoardColumn, {
    organizationId: setup.organizationId,
    column: { kind: "step", step: 0 },
    search: "Fjordheim",
    paginationOpts: { cursor: null, numItems: 20 },
  });

  expect(result.page.map((row) => row.accessionNumber)).toEqual(["IMP-77"]);
});

test("board queries require collections.read in the organization", async () => {
  const t = createConvexTest();
  const setup = await setupBoard(t, []);
  const outsider = await createOrgUserWithPermissions(t, ["collections.read"]);
  for (const caller of [
    authedForUser(t, setup.userId),
    authedForUser(t, outsider.userId),
  ]) {
    await expect(
      caller.query(api.accessions.getBoardCounts, {
        organizationId: setup.organizationId,
      }),
    ).rejects.toThrow();
    await expect(
      caller.query(api.accessions.listBoardColumn, {
        organizationId: setup.organizationId,
        column: { kind: "approved" },
        paginationOpts: { cursor: null, numItems: 10 },
      }),
    ).rejects.toThrow();
  }
});
