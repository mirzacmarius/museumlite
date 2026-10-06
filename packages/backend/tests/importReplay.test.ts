import { expect, test } from "vitest";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import {
  authedForUser,
  createConvexTest,
  createOrgUserWithPermissions,
} from "./testHarness";

async function setup() {
  const t = createConvexTest();
  const own = await createOrgUserWithPermissions(t, ["collections.create"], {
    subscriptionTier: "pro",
  });
  return { t, own, user: authedForUser(t, own.userId) };
}

async function accessionNumbers(
  t: ReturnType<typeof createConvexTest>,
  organizationId: Id<"organizations">,
) {
  const rows = await t.run((ctx) =>
    ctx.db
      .query("accessions")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", organizationId),
      )
      .collect(),
  );
  return rows.map((row) => row.accessionNumber).sort();
}

const goodRow = (rowNumber: number, accessionNumber: string) => ({
  rowNumber,
  accessionNumber,
  dateReceived: "2024-01-15",
  source: "Donor",
  method: "gift",
});

test("replaying a batch returns stored row results without duplicating accessions or exceeding progress", async () => {
  const { t, own, user } = await setup();
  const jobId = await user.mutation(api.imports.createImportJob, {
    organizationId: own.organizationId,
    type: "csv",
    entityType: "accessions",
    totalItems: 1,
  });
  const request = {
    organizationId: own.organizationId,
    jobId,
    batchIndex: 0,
    rows: [goodRow(2, "REPLAY-001")],
  };
  const first = await user.mutation(api.imports.importAccessionsBatch, request);
  const replay = await user.mutation(
    api.imports.importAccessionsBatch,
    request,
  );

  expect(first.results).toMatchObject([
    { rowNumber: 2, status: "accepted", replayed: false },
  ]);
  expect(replay.results).toMatchObject([
    {
      rowNumber: 2,
      status: "accepted",
      replayed: true,
      recordId: first.results[0]?.recordId,
    },
  ]);
  expect(await accessionNumbers(t, own.organizationId)).toEqual(["REPLAY-001"]);
  expect(await user.query(api.imports.getImportJob, { jobId })).toMatchObject({
    status: "completed",
    progress: 100,
    attemptedItems: 1,
    acceptedItems: 1,
    failedItems: 0,
    processedItems: 1,
  });
});

test("failed rows count as attempted and can be corrected on the same job", async () => {
  const { t, own, user } = await setup();
  const jobId = await user.mutation(api.imports.createImportJob, {
    organizationId: own.organizationId,
    type: "csv",
    entityType: "accessions",
    totalItems: 2,
  });
  const base = { organizationId: own.organizationId, jobId, batchIndex: 0 };
  const result = await user.mutation(api.imports.importAccessionsBatch, {
    ...base,
    rows: [
      goodRow(2, "FIX-001"),
      { ...goodRow(3, "FIX-002"), dateReceived: "not a date" },
    ],
  });
  expect(result.results).toMatchObject([
    { rowNumber: 2, status: "accepted" },
    {
      rowNumber: 3,
      status: "failed",
      errors: [expect.stringContaining("Row 3: Invalid date format")],
    },
  ]);
  expect(await user.query(api.imports.getImportJob, { jobId })).toMatchObject({
    status: "completed_with_errors",
    progress: 100,
    attemptedItems: 2,
    acceptedItems: 1,
    failedItems: 1,
  });
  const failures = await user.query(api.imports.listImportRowResults, {
    jobId,
    status: "failed",
    paginationOpts: { numItems: 10, cursor: null },
  });
  expect(failures.page).toMatchObject([
    {
      rowNumber: 3,
      status: "failed",
      errors: [expect.stringContaining("Row 3: Invalid date format")],
    },
  ]);

  // Resubmitting the whole corrected file replays row 2 and accepts row 3.
  const corrected = await user.mutation(api.imports.importAccessionsBatch, {
    ...base,
    rows: [goodRow(2, "FIX-001"), goodRow(3, "FIX-002")],
  });
  expect(corrected.results).toMatchObject([
    { rowNumber: 2, status: "accepted", replayed: true },
    { rowNumber: 3, status: "accepted", replayed: false },
  ]);
  expect(await accessionNumbers(t, own.organizationId)).toEqual([
    "FIX-001",
    "FIX-002",
  ]);
  expect(await user.query(api.imports.getImportJob, { jobId })).toMatchObject({
    status: "completed",
    attemptedItems: 2,
    acceptedItems: 2,
    failedItems: 0,
  });
  const after = await user.query(api.imports.listImportRowResults, {
    jobId,
    status: "failed",
    paginationOpts: { numItems: 10, cursor: null },
  });
  expect(after.page).toEqual([]);
});

test("a duplicate register number in the file fails that row instead of creating a second accession", async () => {
  const { t, own, user } = await setup();
  const jobId = await user.mutation(api.imports.createImportJob, {
    organizationId: own.organizationId,
    type: "csv",
    entityType: "accessions",
    totalItems: 2,
  });
  const result = await user.mutation(api.imports.importAccessionsBatch, {
    organizationId: own.organizationId,
    jobId,
    batchIndex: 0,
    rows: [goodRow(2, "DUP-1"), goodRow(3, " dup-1 ")],
  });
  expect(result.results.map((row) => row.status)).toEqual([
    "accepted",
    "failed",
  ]);
  expect(await accessionNumbers(t, own.organizationId)).toEqual(["DUP-1"]);
});

test("cancelled jobs reject further rows and an interrupted job resumes by source fingerprint", async () => {
  const { own, user } = await setup();
  const create = (fingerprint: string) =>
    user.mutation(api.imports.createImportJob, {
      organizationId: own.organizationId,
      type: "csv",
      entityType: "accessions",
      totalItems: 3,
      sourceName: "register.csv",
      sourceFingerprint: fingerprint,
    });
  const cancelled = await create("a".repeat(64));
  await user.mutation(api.imports.cancelImportJob, { jobId: cancelled });
  expect(
    await user.query(api.imports.getImportJob, { jobId: cancelled }),
  ).toMatchObject({ status: "cancelled" });
  await expect(
    user.mutation(api.imports.importAccessionsBatch, {
      organizationId: own.organizationId,
      jobId: cancelled,
      batchIndex: 0,
      rows: [goodRow(2, "CAN-1")],
    }),
  ).rejects.toThrow("cancelled");
  expect(
    await user.query(api.imports.findResumableImportJob, {
      organizationId: own.organizationId,
      entityType: "accessions",
      sourceFingerprint: "a".repeat(64),
    }),
  ).toBeNull();

  const interrupted = await create("b".repeat(64));
  await user.mutation(api.imports.importAccessionsBatch, {
    organizationId: own.organizationId,
    jobId: interrupted,
    batchIndex: 0,
    rows: [goodRow(2, "RES-1")],
  });
  expect(
    await user.query(api.imports.findResumableImportJob, {
      organizationId: own.organizationId,
      entityType: "accessions",
      sourceFingerprint: "b".repeat(64),
    }),
  ).toMatchObject({
    _id: interrupted,
    status: "processing",
    attemptedItems: 1,
    totalItems: 3,
    sourceName: "register.csv",
  });
});

test("batches are bounded, row numbers are validated, and other organizations cannot read row results", async () => {
  const { t, own, user } = await setup();
  const jobId = await user.mutation(api.imports.createImportJob, {
    organizationId: own.organizationId,
    type: "csv",
    entityType: "accessions",
    totalItems: 200,
  });
  const base = { organizationId: own.organizationId, jobId, batchIndex: 0 };
  await expect(
    user.mutation(api.imports.importAccessionsBatch, {
      ...base,
      rows: Array.from({ length: 101 }, (_, i) => goodRow(i + 2, `B-${i}`)),
    }),
  ).rejects.toThrow("at most 100");
  await expect(
    user.mutation(api.imports.importAccessionsBatch, {
      ...base,
      rows: [goodRow(2, "X-1"), goodRow(2, "X-2")],
    }),
  ).rejects.toThrow("Duplicate source row");
  await expect(
    user.mutation(api.imports.importAccessionsBatch, {
      ...base,
      rows: [goodRow(0, "X-3")],
    }),
  ).rejects.toThrow("row number");
  await expect(
    user.mutation(api.imports.createImportJob, {
      organizationId: own.organizationId,
      type: "csv",
      entityType: "accessions",
      totalItems: 0,
    }),
  ).rejects.toThrow();

  const foreign = await createOrgUserWithPermissions(t, ["collections.create"]);
  await expect(
    authedForUser(t, foreign.userId).query(api.imports.listImportRowResults, {
      jobId,
      paginationOpts: { numItems: 10, cursor: null },
    }),
  ).rejects.toThrow();
});
