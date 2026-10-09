import type { FunctionArgs } from "convex/server";
import { ConvexError } from "convex/values";
import { convexTest } from "convex-test";
import { afterEach, describe, expect, test, vi } from "vitest";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import schema from "../convex/schema";
import { modules } from "./testSetup";

type Source = FunctionArgs<typeof api.exports.create>["source"];
type Cell = string | number | boolean | null;
interface Column {
  name: string;
  type: string;
}

const T0 = Date.UTC(2026, 0, 1);

async function fixture(
  tier: "free" | "pro" | "enterprise" = "pro",
  permissions = ["collections.read", "locations.read", "loans.read"],
) {
  vi.useFakeTimers();
  vi.setSystemTime(T0);
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const organizationId = await ctx.db.insert("organizations", {
      name: "Museum",
      slug: "registers",
      type: "museum",
      subscriptionTier: tier,
    });
    const otherOrganizationId = await ctx.db.insert("organizations", {
      name: "Other Museum",
      slug: "other-registers",
      type: "museum",
      subscriptionTier: "pro",
    });
    const userId = await ctx.db.insert("users", {
      email: "registrar@example.test",
    });
    const roleId = await ctx.db.insert("roles", {
      organizationId,
      name: "Registrar",
      isSystemRole: false,
    });
    for (const name of permissions) {
      const permissionId = await ctx.db.insert("permissions", {
        name,
        category: "collections",
      });
      await ctx.db.insert("rolePermissions", { roleId, permissionId });
    }
    const membershipId = await ctx.db.insert("userOrganizations", {
      userId,
      organizationId,
      roleId,
      joinedAt: T0,
    });
    return { organizationId, otherOrganizationId, userId, membershipId };
  });
  return {
    t,
    ...ids,
    user: t.withIdentity({ subject: `${ids.userId}|test` }),
  };
}
type Fixture = Awaited<ReturnType<typeof fixture>>;

afterEach(() => {
  vi.useRealTimers();
});

async function insertObject(
  f: Fixture,
  fields: {
    accessionNumber: string;
    title: string;
    organizationId?: Id<"organizations">;
    condition?: string;
    conditionHistory?: Array<{
      condition: string;
      changedAt: number;
      changedBy: Id<"users">;
      note?: string;
    }>;
    accessionNumberHistory?: Array<{
      number: string;
      validFrom: number;
      validTo?: number;
    }>;
  },
) {
  return await f.t.run((ctx) =>
    ctx.db.insert("collections", {
      organizationId: f.organizationId,
      status: "active",
      catalogedBy: f.userId,
      catalogedAt: T0,
      ...fields,
    }),
  );
}

async function runExport(
  f: Fixture,
  source: Source,
  format: "csv" | "jsonl",
  requestKey: string,
) {
  const jobId = await f.user.mutation(api.exports.create, {
    organizationId: f.organizationId,
    requestKey,
    format,
    source,
  });
  await f.t.finishAllScheduledFunctions(() => vi.advanceTimersByTime(1));
  const job = await f.user.query(api.exports.status, { jobId });
  return { jobId, job };
}

async function downloadText(f: Fixture, jobId: Id<"exportJobs">) {
  const response = await f.user.fetch(`/exports/download?jobId=${jobId}`);
  expect(response.status).toBe(200);
  return await response.text();
}

async function downloadManifest(f: Fixture, jobId: Id<"exportJobs">) {
  const response = await f.user.fetch(`/exports/manifest?jobId=${jobId}`);
  expect(response.status).toBe(200);
  return (await response.json()) as {
    columns: Column[];
    generator: Record<string, unknown>;
    criteria: Record<string, unknown>;
    effectiveAsOf: number;
    organizationId: string;
    requestedBy: string;
    compatibility: string;
  };
}

/** RFC 4180 reader that keeps whether each field was quoted. */
function readCsv(text: string) {
  const records: Array<Array<{ raw: string; quoted: boolean }>> = [];
  let record: Array<{ raw: string; quoted: boolean }> = [];
  let raw = "";
  let quoted = false;
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"' && text[i + 1] === '"') {
        raw += '"';
        i++;
      } else if (char === '"') inQuotes = false;
      else raw += char;
    } else if (char === '"') {
      inQuotes = true;
      quoted = true;
    } else if (char === ",") {
      record.push({ raw, quoted });
      raw = "";
      quoted = false;
    } else if (char === "\r" && text[i + 1] === "\n") {
      record.push({ raw, quoted });
      records.push(record);
      record = [];
      raw = "";
      quoted = false;
      i++;
    } else raw += char;
  }
  return records;
}

/** Decodes a register CSV using the manifest column schema. */
function decodeRegisterCsv(text: string, columns: Column[]) {
  const [header, ...records] = readCsv(text);
  expect(header?.map((cell) => cell.raw)).toEqual(columns.map((c) => c.name));
  return records.map((record) => {
    const row: Record<string, Cell> = {};
    columns.forEach((column, index) => {
      const cell = record[index];
      if (!cell) throw new Error("Missing CSV cell");
      if (!cell.quoted && cell.raw === "") row[column.name] = null;
      else if (column.type === "text" || column.type === "id")
        row[column.name] = cell.raw.startsWith("'")
          ? cell.raw.slice(1)
          : cell.raw;
      else if (column.type === "boolean")
        row[column.name] = cell.raw === "true";
      else row[column.name] = Number(cell.raw);
    });
    return row;
  });
}

function decodeJsonl(text: string) {
  return text
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line) as Record<string, Cell>);
}

async function errorCodeOf(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (error) {
    if (!(error instanceof ConvexError)) throw error;
    const data: unknown =
      typeof error.data === "string" ? JSON.parse(error.data) : error.data;
    return typeof data === "object" && data !== null && "code" in data
      ? data.code
      : undefined;
  }
  throw new Error("Expected the request to be refused");
}

function withoutCapture(rows: Array<Record<string, Cell>>) {
  return rows.map(({ capturedAt: _capturedAt, ...rest }) => rest);
}

describe("accession register", () => {
  test("CSV and JSONL round-trip typed accession rows with explicit legacy and missing markers", async () => {
    const f = await fixture();
    const objectId = await insertObject(f, {
      accessionNumber: "2024.1",
      title: "=Bowl",
      accessionNumberHistory: [
        { number: "OLD-1", validFrom: T0 - 5000, validTo: T0 - 1000 },
        { number: "2024.1", validFrom: T0 - 1000 },
      ],
    });
    const recorded = await f.t.run(async (ctx) => {
      const approved = await ctx.db.insert("accessions", {
        organizationId: f.organizationId,
        collectionId: objectId,
        accessionNumber: "2024.1",
        dateReceived: 1700000000000,
        source: "'Quoted donor",
        method: "gift",
        cost: 0,
        status: "approved",
        approvedBy: f.userId,
        approvedAt: T0 + 10,
        sourceVerified: true,
      });
      await ctx.db.insert("caseHistoryEntries", {
        organizationId: f.organizationId,
        caseType: "accession",
        entityId: approved,
        ordinal: 0,
        entry: { step: 1, approvedBy: f.userId, approvedAt: T0 + 10 },
        evidenceStatus: "recorded",
      });
      const pending = await ctx.db.insert("accessions", {
        organizationId: f.organizationId,
        accessionNumber: "2024.2",
        catalogIdentifier: "000123",
        dateReceived: 1700000500000,
        source: "Field survey, 2023",
        method: "transfer",
        status: "pending",
      });
      const legacy = await ctx.db.insert("accessions", {
        organizationId: f.organizationId,
        accessionNumber: "1931.7",
        dateReceived: 1600000000000,
        source: "Bequest",
        method: "bequest",
        status: "approved",
        workflowHistory: [
          { step: 1, approvedBy: f.userId, approvedAt: 1600000001000 },
        ],
      });
      await ctx.db.insert("accessions", {
        organizationId: f.otherOrganizationId,
        accessionNumber: "FOREIGN-1",
        dateReceived: 1700000000000,
        source: "Elsewhere",
        method: "gift",
        status: "approved",
      });
      return { approved, pending, legacy };
    });
    vi.advanceTimersByTime(1000);
    const source: Source = {
      kind: "register",
      profile: "accession",
      criteria: {},
    };
    const csv = await runExport(f, source, "csv", "accession-csv");
    const jsonl = await runExport(f, source, "jsonl", "accession-jsonl");
    expect(csv.job.status).toBe("completed");
    expect(jsonl.job.status).toBe("completed");
    expect(csv.job.rows).toBe(3);

    const manifest = await downloadManifest(f, csv.jobId);
    expect(manifest.generator).toEqual({
      name: "MuseumLite register export",
      profile: "register.accession",
      profileVersion: 1,
      exportSchemaVersion: 1,
    });
    expect(manifest.organizationId).toBe(f.organizationId);
    expect(manifest.requestedBy).toBe(f.userId);
    expect(manifest.effectiveAsOf).toBe(csv.job.asOf);
    expect(manifest.compatibility).toContain("not a SPECTRUM, LIDO");

    const csvRows = decodeRegisterCsv(
      await downloadText(f, csv.jobId),
      manifest.columns,
    );
    const jsonRows = decodeJsonl(await downloadText(f, jsonl.jobId));
    expect(withoutCapture(csvRows)).toEqual(withoutCapture(jsonRows));
    expect(csvRows.map((row) => row.accessionNumber)).toEqual([
      "1931.7",
      "2024.1",
      "2024.2",
    ]);
    const [legacy, approved, pending] = csvRows;
    expect(approved).toMatchObject({
      accessionId: recorded.approved,
      source: "'Quoted donor",
      cost: 0,
      objectId,
      objectAccessionNumber: "2024.1",
      objectTitle: "=Bowl",
      objectPriorAccessionNumbers: "OLD-1",
      sourceVerified: true,
      sourceVerificationException: false,
      identifierConflictReviewed: false,
      approvedAt: T0 + 10,
      approvedBy: f.userId,
      approvedAsOf: true,
      approvalStepsAsOf: 1,
      evidenceStatus: "recorded",
      notRecorded: null,
    });
    expect(typeof approved?.capturedAt).toBe("number");
    expect(pending).toMatchObject({
      catalogIdentifier: "000123",
      status: "pending",
      cost: null,
      objectId: null,
      approvedAt: null,
      approvedAsOf: false,
      approvalStepsAsOf: 0,
      evidenceStatus: "recorded",
      notRecorded: null,
    });
    expect(legacy).toMatchObject({
      accessionId: recorded.legacy,
      status: "approved",
      approvedAt: null,
      approvalStepsAsOf: 1,
      evidenceStatus: "legacy",
      notRecorded: "objectId;approvedAt;approvedBy",
    });
    const csvText = await downloadText(f, csv.jobId);
    expect(csvText).toContain(`"'=Bowl"`);
    expect(csvText).toContain(`"''Quoted donor"`);
  });

  test("a historical as-of keeps the number in force at that time among the object's prior numbers", async () => {
    const f = await fixture();
    const t1 = T0 - 3000;
    const t3 = T0 - 1000;
    const objectId = await insertObject(f, {
      accessionNumber: "N3",
      title: "Renumbered",
      accessionNumberHistory: [
        { number: "N1", validFrom: T0 - 9000, validTo: t1 },
        { number: "N2", validFrom: t1, validTo: t3 },
        { number: "N3", validFrom: t3 },
      ],
    });
    await f.t.run((ctx) =>
      ctx.db.insert("accessions", {
        organizationId: f.organizationId,
        collectionId: objectId,
        accessionNumber: "N1",
        dateReceived: T0 - 9000,
        source: "Donor",
        method: "gift",
        status: "pending",
      }),
    );
    vi.advanceTimersByTime(1000);
    const preview = await f.user.query(api.registers.preview, {
      organizationId: f.organizationId,
      profile: "accession",
      criteria: { asOf: T0 + 500 },
    });
    expect(preview.rows[0]).toMatchObject({
      objectAccessionNumber: "N3",
      objectPriorAccessionNumbers: "N1;N2",
    });
  });
});

describe("disposal register", () => {
  test("classifies transfers and legacy loan returns and marks decisions that were never recorded", async () => {
    const f = await fixture();
    const held = await insertObject(f, {
      accessionNumber: "1990.4",
      title: "Chair",
    });
    const transferred = await insertObject(f, {
      accessionNumber: "TR-NOW-1",
      title: "Their title",
      organizationId: f.otherOrganizationId,
    });
    const returned = await insertObject(f, {
      accessionNumber: "L.2020.1",
      title: "Borrowed vase",
    });
    const ids = await f.t.run(async (ctx) => {
      const policy = await ctx.db.insert("deaccessions", {
        organizationId: f.organizationId,
        collectionId: held,
        deaccessionNumber: "D-1",
        dateDeaccessioned: 1700000000000,
        reason: "Duplicate",
        method: "sale",
        status: "approved",
        approvedBy: f.userId,
        approvedAt: T0 - 500,
        proceedsAmount: 1250.5,
        proceedsCurrency: "EUR",
        decisionReview: {
          policyVersion: 2,
          checkedAt: T0 - 600,
          checks: [
            { key: "board", required: true, passed: true },
            { key: "appraisal", required: false, passed: false },
          ],
        },
        exitRecord: {
          exitDate: T0 - 400,
          recipient: "Auction house",
          recordedBy: f.userId,
          recordedAt: T0 - 400,
        },
      });
      const transfer = await ctx.db.insert("deaccessions", {
        organizationId: f.organizationId,
        collectionId: transferred,
        deaccessionNumber: "TR-REG-1",
        dateDeaccessioned: 1700000100000,
        reason: "Transfer",
        method: "transfer",
        status: "approved",
        approvedBy: f.userId,
        approvedAt: T0 - 300,
        workflowHistory: [
          { step: 1, approvedBy: f.userId, approvedAt: T0 - 300 },
        ],
      });
      const request = await ctx.db.insert("organizationMoveRequests", {
        collectionId: transferred,
        sourceOrganizationId: f.organizationId,
        targetOrganizationId: f.otherOrganizationId,
        sourceAccessionNumber: "1985.2",
        accessionMode: "keep",
        reason: "Transfer",
        status: "executed",
        requestedBy: f.userId,
        requestedAt: T0 - 400,
        deaccessionId: transfer,
      });
      const legacyReturn = await ctx.db.insert("deaccessions", {
        organizationId: f.organizationId,
        collectionId: returned,
        deaccessionNumber: "D-LOAN",
        dateDeaccessioned: 1700000200000,
        reason: "Returned to lender",
        method: "transfer",
        status: "approved",
      });
      const loanId = await ctx.db.insert("loans", {
        organizationId: f.organizationId,
        loanNumber: "IN-1",
        type: "incoming",
        lenderBorrowerName: "Lender",
        startDate: T0 - 10000,
        status: "returned",
      });
      const loanItemId = await ctx.db.insert("loanItems", {
        loanId,
        collectionId: returned,
      });
      await ctx.db.insert("loanCustodyExits", {
        organizationId: f.organizationId,
        loanId,
        loanItemId,
        collectionId: returned,
        exitType: "return_to_lender",
        recipientName: "Lender",
        recordedBy: f.userId,
        recordedAt: T0 - 200,
        legacySyntheticDeaccessionId: legacyReturn,
      });
      await ctx.db.insert("deaccessions", {
        organizationId: f.organizationId,
        collectionId: held,
        deaccessionNumber: "D-PENDING",
        dateDeaccessioned: 1700000300000,
        reason: "Proposed",
        method: "donation",
        status: "pending",
      });
      return { policy, transfer, request, legacyReturn };
    });
    vi.advanceTimersByTime(1000);
    const source: Source = {
      kind: "register",
      profile: "disposal",
      criteria: { status: "approved" },
    };
    const csv = await runExport(f, source, "csv", "disposal-csv");
    const jsonl = await runExport(f, source, "jsonl", "disposal-jsonl");
    expect(csv.job.status).toBe("completed");
    const manifest = await downloadManifest(f, csv.jobId);
    expect(manifest.criteria).toEqual({ status: "approved" });
    const csvRows = decodeRegisterCsv(
      await downloadText(f, csv.jobId),
      manifest.columns,
    );
    const jsonRows = decodeJsonl(await downloadText(f, jsonl.jobId));
    expect(withoutCapture(csvRows)).toEqual(withoutCapture(jsonRows));
    expect(jsonRows).toHaveLength(3);
    const [policy, transfer, legacyReturn] = jsonRows;
    expect(policy).toMatchObject({
      deaccessionId: ids.policy,
      category: "deaccession",
      objectAccessionNumber: "1990.4",
      objectTitle: "Chair",
      decisionPolicyVersion: 2,
      decisionCheckedAt: T0 - 600,
      decisionChecksPassed: true,
      decisionException: false,
      exitDate: T0 - 400,
      exitRecipient: "Auction house",
      exitRecordedAsOf: true,
      proceedsAmount: 1250.5,
      proceedsCurrency: "EUR",
      evidenceStatus: "recorded",
      notRecorded: null,
    });
    expect(transfer).toMatchObject({
      deaccessionId: ids.transfer,
      category: "institution_transfer",
      transferRequestId: ids.request,
      objectAccessionNumber: "1985.2",
      objectTitle: null,
      approvalStepsAsOf: 1,
      decisionPolicyVersion: null,
      evidenceStatus: "legacy",
      notRecorded:
        "objectTitle;decisionPolicyVersion;decisionCheckedAt;decisionChecksPassed;decisionException",
    });
    expect(legacyReturn).toMatchObject({
      deaccessionId: ids.legacyReturn,
      category: "legacy_loan_return",
      exitRecordedAsOf: false,
      evidenceStatus: "legacy",
      notRecorded:
        "approvedAt;approvedBy;decisionPolicyVersion;decisionCheckedAt;decisionChecksPassed;decisionException",
    });
  });
});

describe("custody register", () => {
  test("honours a controlled as-of time, keeps transferred-out history and withholds other organizations' locations", async () => {
    const f = await fixture();
    const t1 = T0 + 1000;
    const t2 = T0 + 2000;
    const asOf = T0 + 2500;
    const t3 = T0 + 3000;
    const location = (organizationId: Id<"organizations">, name: string) =>
      f.t.run((ctx) =>
        ctx.db.insert("locations", {
          organizationId,
          name,
          type: "room",
          sortOrder: 0,
          isActive: true,
        }),
      );
    const store = await location(f.organizationId, "Store A");
    const gallery = await location(f.organizationId, "Gallery");
    const foreign = await location(f.otherOrganizationId, "Their store");
    const held = await insertObject(f, {
      accessionNumber: "2001.1",
      title: "Mask",
    });
    const departed = await insertObject(f, {
      accessionNumber: "TR-THEIRS",
      title: "Their record",
      organizationId: f.otherOrganizationId,
    });
    const borrowed = await insertObject(f, {
      accessionNumber: "L.2026.1",
      title: "Borrowed bowl",
    });
    const move = (
      collectionId: Id<"collections">,
      movedAt: number,
      fromLocationId: Id<"locations"> | undefined,
      toLocationId: Id<"locations">,
      movementKind?: "direct" | "institution_transfer",
    ) => {
      vi.setSystemTime(movedAt);
      return f.t.run((ctx) =>
        ctx.db.insert("locationHistory", {
          collectionId,
          fromLocationId,
          toLocationId,
          movedBy: f.userId,
          movedAt,
          movementKind,
          authorizedBy: movementKind ? f.userId : undefined,
        }),
      );
    };
    const legacyMove = await move(held, t1, undefined, store);
    const departedEarly = await move(departed, t1, store, gallery, "direct");
    const guardedMove = await move(held, t2, store, gallery, "direct");
    const departedHandoff = await move(
      departed,
      t2,
      gallery,
      foreign,
      "institution_transfer",
    );
    await move(departed, t2, foreign, foreign, "direct");
    const loan = await f.t.run(async (ctx) => {
      const loanId = await ctx.db.insert("loans", {
        organizationId: f.organizationId,
        loanNumber: "OUT-1",
        type: "outgoing",
        lenderBorrowerName: "Borrower",
        startDate: t1,
        status: "returned",
      });
      const loanItemId = await ctx.db.insert("loanItems", {
        loanId,
        collectionId: held,
        custodyStatus: "returned",
        dispatchOriginLocationId: gallery,
        dispatchedAt: t2,
        dispatchedBy: f.userId,
        returnDestinationLocationId: store,
        returnedAt: t3,
        returnedBy: f.userId,
      });
      const incomingId = await ctx.db.insert("loans", {
        organizationId: f.organizationId,
        loanNumber: "IN-9",
        type: "incoming",
        lenderBorrowerName: "Lender",
        startDate: t1,
        status: "returned",
      });
      const incomingItemId = await ctx.db.insert("loanItems", {
        loanId: incomingId,
        collectionId: borrowed,
        custodyStatus: "returned",
        returnedAt: t2,
        returnedBy: f.userId,
      });
      const exitId = await ctx.db.insert("loanCustodyExits", {
        organizationId: f.organizationId,
        loanId: incomingId,
        loanItemId: incomingItemId,
        collectionId: borrowed,
        exitType: "return_to_lender",
        recipientName: "Lender",
        recordedBy: f.userId,
        recordedAt: t2,
        fromLocationId: store,
      });
      return { loanId, loanItemId, exitId };
    });
    const transfer = await f.t.run(async (ctx) => {
      const requestId = await ctx.db.insert("organizationMoveRequests", {
        collectionId: departed,
        sourceOrganizationId: f.organizationId,
        targetOrganizationId: f.otherOrganizationId,
        sourceAccessionNumber: "1985.2",
        accessionMode: "keep",
        reason: "Transfer",
        status: "executed",
        requestedBy: f.userId,
        requestedAt: t1,
      });
      const departureId = await ctx.db.insert(
        "organizationTransferCustodyEvents",
        {
          moveRequestId: requestId,
          collectionId: departed,
          organizationId: f.organizationId,
          phase: "source_departure",
          observedLocationId: gallery,
          actorId: f.userId,
          recordedAt: t2,
        },
      );
      await ctx.db.insert("organizationTransferCustodyEvents", {
        moveRequestId: requestId,
        collectionId: departed,
        organizationId: f.otherOrganizationId,
        phase: "target_arrival",
        observedLocationId: foreign,
        actorId: f.userId,
        recordedAt: t2,
      });
      return { requestId, departureId };
    });
    const laterMove = await move(held, t3, gallery, store, "direct");
    vi.setSystemTime(T0 + 4000);

    const { jobId, job } = await runExport(
      f,
      { kind: "register", profile: "custody", criteria: { asOf } },
      "jsonl",
      "custody-as-of",
    );
    expect(job.status).toBe("completed");
    const manifest = await downloadManifest(f, jobId);
    expect(manifest.effectiveAsOf).toBe(asOf);
    const rows = decodeJsonl(await downloadText(f, jobId));
    expect(
      rows.map((row) => [row.eventId, row.eventType, row.notRecorded]),
    ).toEqual([
      [
        legacyMove,
        "movement",
        "movementKind;authorizedBy;fromLocationId;fromLocationName",
      ],
      [guardedMove, "movement", null],
      [loan.loanItemId, "loan_dispatched", null],
      [loan.exitId, "lender_exit", null],
      [departedEarly, "movement", "objectTitle"],
      [departedHandoff, "movement", "objectTitle;toLocationId;toLocationName"],
      [transfer.departureId, "transfer_departure", "objectTitle"],
    ]);
    expect(rows[0]).toMatchObject({
      evidenceSource: "locationHistory",
      evidenceStatus: "legacy",
      movementKind: null,
      toLocationId: store,
      toLocationName: "Store A",
      eventAt: t1,
      recordedAt: t1,
    });
    expect(rows[2]).toMatchObject({
      evidenceSource: "loanItems",
      fromLocationId: gallery,
      fromLocationName: "Gallery",
      loanId: loan.loanId,
      counterparty: "Borrower",
      eventAt: t2,
    });
    expect(rows[3]).toMatchObject({
      evidenceSource: "loanCustodyExits",
      objectId: borrowed,
      fromLocationName: "Store A",
      counterparty: "Lender",
    });
    expect(rows[5]).toMatchObject({
      objectId: departed,
      objectAccessionNumber: "1985.2",
      objectTitle: null,
      fromLocationName: "Gallery",
      toLocationId: null,
    });
    expect(rows[6]).toMatchObject({
      transferRequestId: transfer.requestId,
      fromLocationId: gallery,
    });

    const current = await f.user.query(api.registers.preview, {
      organizationId: f.organizationId,
      profile: "custody",
      criteria: { fromDate: t2 },
    });
    expect(current.rows.map((row) => row.eventId)).toEqual([
      guardedMove,
      laterMove,
      loan.loanItemId,
      loan.loanItemId,
      loan.exitId,
      departedHandoff,
      transfer.departureId,
    ]);
    expect(current.rows.map((row) => row.eventType)).toContain("loan_returned");
    expect(current.hasMore).toBe(false);

    const departedOnly = await f.user.query(api.registers.preview, {
      organizationId: f.organizationId,
      profile: "custody",
      criteria: { objectId: departed },
    });
    expect(departedOnly.rows.map((row) => row.eventId)).toEqual([
      departedEarly,
      departedHandoff,
      transfer.departureId,
    ]);
  });
});

describe("condition register", () => {
  test("exports accepted assessments, loan reports and legacy conditions while excluding drafts", async () => {
    const f = await fixture();
    const assessed = await insertObject(f, {
      accessionNumber: "1950.3",
      title: "Textile",
      condition: "Good",
      conditionHistory: [
        {
          condition: "Fair",
          changedAt: T0 - 9000,
          changedBy: f.userId,
          note: "Catalogue edit",
        },
      ],
    });
    const snapshotOnly = await insertObject(f, {
      accessionNumber: "1910.1",
      title: "Clock",
      condition: "Poor",
    });
    const ids = await f.t.run(async (ctx) => {
      const accepted = await ctx.db.insert("conditionAssessments", {
        organizationId: f.organizationId,
        collectionId: assessed,
        assessedBy: f.userId,
        assessedAt: T0 + 580,
        recordedAt: T0 + 590,
        condition: "Good",
        summary: "Stable",
        observations: [
          { area: "Hem", description: "Fraying", severity: "minor" },
        ],
        photos: [],
        status: "accepted",
        acceptedBy: f.userId,
        acceptedAt: T0 + 600,
      });
      await ctx.db.insert("conditionAssessments", {
        organizationId: f.organizationId,
        collectionId: assessed,
        assessedBy: f.userId,
        assessedAt: T0 - 40,
        recordedAt: T0 - 40,
        condition: "Damaged",
        summary: "Draft only",
        observations: [],
        photos: [],
        status: "draft",
      });
      const loanId = await ctx.db.insert("loans", {
        organizationId: f.organizationId,
        loanNumber: "OUT-2",
        type: "outgoing",
        lenderBorrowerName: "Borrower",
        startDate: T0 - 1000,
        status: "dispatched",
      });
      const loanItemId = await ctx.db.insert("loanItems", {
        loanId,
        collectionId: assessed,
      });
      const report = await ctx.db.insert("conditionReports", {
        loanItemId,
        reportType: "out",
        conditionDescription: "Good, light soiling",
        damages: [{ type: "soiling", location: "hem", severity: "minor" }],
        assessedBy: f.userId,
        assessedAt: T0 - 30,
      });
      return { accepted, loanId, report };
    });
    vi.advanceTimersByTime(1000);
    const csv = await runExport(
      f,
      { kind: "register", profile: "condition", criteria: {} },
      "csv",
      "condition-csv",
    );
    expect(csv.job.status).toBe("completed");
    const manifest = await downloadManifest(f, csv.jobId);
    const rows = decodeRegisterCsv(
      await downloadText(f, csv.jobId),
      manifest.columns,
    );
    expect(
      rows.map((row) => [row.objectId, row.eventType, row.evidenceStatus]),
    ).toEqual([
      [assessed, "assessment_accepted", "recorded"],
      [assessed, "loan_condition_report", "recorded"],
      [assessed, "legacy_condition_change", "legacy"],
      [snapshotOnly, "legacy_condition_snapshot", "legacy"],
    ]);
    expect(rows[0]).toMatchObject({
      eventId: ids.accepted,
      condition: "Good",
      summary: "Stable",
      observationCount: 1,
      photoCount: 0,
      acceptedAt: T0 + 600,
      acceptedBy: f.userId,
      notRecorded: null,
    });
    expect(rows[1]).toMatchObject({
      eventId: ids.report,
      loanId: ids.loanId,
      reportDirection: "out",
      observationCount: 1,
      acceptedAt: null,
    });
    expect(rows[2]).toMatchObject({
      eventId: null,
      condition: "Fair",
      summary: "Catalogue edit",
      assessedAt: T0 - 9000,
    });
    expect(rows[3]).toMatchObject({
      eventId: null,
      condition: "Poor",
      assessedAt: null,
      assessorId: null,
      recordedAt: null,
      notRecorded: "assessedAt;assessorId;recordedAt",
    });

    const beforeAcceptance = await f.user.query(api.registers.preview, {
      organizationId: f.organizationId,
      profile: "condition",
      criteria: { asOf: T0 + 500 },
    });
    expect(beforeAcceptance.rows.map((row) => row.eventType)).toEqual([
      "loan_condition_report",
      "legacy_condition_change",
      "legacy_condition_snapshot",
    ]);
    const dated = await f.user.query(api.registers.preview, {
      organizationId: f.organizationId,
      profile: "condition",
      criteria: { fromDate: T0 - 10000, toDate: T0 },
    });
    expect(dated.rows.map((row) => row.eventType)).toEqual([
      "loan_condition_report",
      "legacy_condition_change",
    ]);
  });
});

describe("register authorization and recovery", () => {
  const custody: Source = {
    kind: "register",
    profile: "custody",
    criteria: {},
  };

  test("non-members, readers without catalog access and plans without reporting cannot preview or create registers", async () => {
    const f = await fixture();
    const outsider = await f.t.run((ctx) =>
      ctx.db.insert("users", { email: "outsider@example.test" }),
    );
    const asOutsider = f.t.withIdentity({ subject: `${outsider}|test` });
    const previewArgs = {
      organizationId: f.organizationId,
      profile: "accession" as const,
      criteria: {},
    };
    await expect(
      asOutsider.query(api.registers.preview, previewArgs),
    ).rejects.toThrow();
    await expect(
      asOutsider.mutation(api.exports.create, {
        organizationId: f.organizationId,
        requestKey: "outsider",
        format: "csv",
        source: custody,
      }),
    ).rejects.toThrow();

    const noRead = await fixture("pro", []);
    await expect(
      noRead.user.query(api.registers.preview, {
        ...previewArgs,
        organizationId: noRead.organizationId,
      }),
    ).rejects.toThrow(/Permission denied/);
    await expect(
      noRead.user.mutation(api.exports.create, {
        organizationId: noRead.organizationId,
        requestKey: "no-read",
        format: "csv",
        source: custody,
      }),
    ).rejects.toThrow(/Permission denied/);

    const free = await fixture("free");
    await expect(
      free.user.query(api.registers.preview, {
        ...previewArgs,
        organizationId: free.organizationId,
      }),
    ).rejects.toThrow(/Feature requires pro tier/);
    await expect(
      free.user.mutation(api.exports.create, {
        organizationId: free.organizationId,
        requestKey: "free",
        format: "csv",
        source: custody,
      }),
    ).rejects.toThrow(/Feature requires pro tier/);
  });

  test("catalogue readers without loan access get accession registers but not loan-bearing custody or condition registers", async () => {
    const f = await fixture("pro", ["collections.read"]);
    const accession = await f.user.query(api.registers.preview, {
      organizationId: f.organizationId,
      profile: "accession",
      criteria: {},
    });
    expect(accession.rows).toEqual([]);
    for (const profile of ["custody", "condition"] as const) {
      await expect(
        f.user.query(api.registers.preview, {
          organizationId: f.organizationId,
          profile,
          criteria: {},
        }),
      ).rejects.toThrow(/Permission denied/);
      await expect(
        f.user.mutation(api.exports.create, {
          organizationId: f.organizationId,
          requestKey: `no-loans-${profile}`,
          format: "jsonl",
          source: { kind: "register", profile, criteria: {} },
        }),
      ).rejects.toThrow(/Permission denied/);
    }
  });

  test("pages of large condition evidence stay under the chunk limit and complete", async () => {
    const f = await fixture();
    const objectId = await insertObject(f, {
      accessionNumber: "BIG-1",
      title: "Heavily documented",
    });
    await f.t.run(async (ctx) => {
      for (let i = 0; i < 30; i++)
        await ctx.db.insert("conditionAssessments", {
          organizationId: f.organizationId,
          collectionId: objectId,
          assessedBy: f.userId,
          assessedAt: T0 - 1000 + i,
          recordedAt: T0 - 1000 + i,
          condition: "Fair",
          summary: `${i}:${"x".repeat(20_000)}`,
          observations: [],
          photos: [],
          status: "accepted",
          acceptedBy: f.userId,
          acceptedAt: T0 - 500,
        });
    });
    vi.advanceTimersByTime(1000);
    const { jobId, job } = await runExport(
      f,
      { kind: "register", profile: "condition", criteria: {} },
      "csv",
      "large-condition",
    );
    expect(job.status).toBe("completed");
    expect(job.rows).toBe(30);
    expect(job.checkpoint).toBeGreaterThan(1);
    const manifest = await downloadManifest(f, jobId);
    const rows = decodeRegisterCsv(
      await downloadText(f, jobId),
      manifest.columns,
    );
    expect(rows.map((row) => String(row.summary).split(":")[0])).toEqual(
      Array.from({ length: 30 }, (_, i) => String(i)),
    );
  });

  test("criteria naming another organization's object or an impossible range are refused with stable errors", async () => {
    const f = await fixture();
    const foreignObject = await insertObject(f, {
      accessionNumber: "THEIRS-1",
      title: "Not ours",
      organizationId: f.otherOrganizationId,
    });
    const create = (requestKey: string, source: Source) =>
      f.user.mutation(api.exports.create, {
        organizationId: f.organizationId,
        requestKey,
        format: "csv",
        source,
      });
    await expect(
      create("foreign", {
        kind: "register",
        profile: "condition",
        criteria: { objectId: foreignObject },
      }),
    ).rejects.toThrow(/Filter outside organization/);
    await expect(
      f.user.query(api.registers.preview, {
        organizationId: f.organizationId,
        profile: "custody",
        criteria: { objectId: foreignObject },
      }),
    ).rejects.toThrow(/Filter outside organization/);
    for (const [requestKey, criteria, profile] of [
      ["status-on-custody", { status: "approved" }, "custody"],
      ["reversed-range", { fromDate: T0, toDate: T0 - 1 }, "accession"],
      ["future-as-of", { asOf: T0 + 60_000 }, "disposal"],
    ] as const) {
      expect(
        await errorCodeOf(
          create(requestKey, { kind: "register", profile, criteria }),
        ),
      ).toBe("REGISTER_CRITERIA_INVALID");
    }
    const list = await f.user.query(api.exports.list, {
      organizationId: f.organizationId,
    });
    expect(list).toEqual([]);
  });

  test("multi-page custody exports survive revocation, retry from the checkpoint and emit every event once", async () => {
    const f = await fixture();
    const location = await f.t.run((ctx) =>
      ctx.db.insert("locations", {
        organizationId: f.organizationId,
        name: "Store",
        type: "room",
        sortOrder: 0,
        isActive: true,
      }),
    );
    const busy = await insertObject(f, {
      accessionNumber: "BUSY-1",
      title: "Often moved",
    });
    await f.t.run(async (ctx) => {
      for (let i = 0; i < 450; i++)
        await ctx.db.insert("locationHistory", {
          collectionId: busy,
          toLocationId: location,
          movedBy: f.userId,
          movedAt: T0 + i,
          movementKind: "direct",
        });
      for (let i = 0; i < 30; i++) {
        const collectionId = await ctx.db.insert("collections", {
          organizationId: f.organizationId,
          accessionNumber: `QUIET-${i}`,
          title: `Quiet ${i}`,
          status: "active",
          catalogedBy: f.userId,
          catalogedAt: T0,
        });
        await ctx.db.insert("locationHistory", {
          collectionId,
          toLocationId: location,
          movedBy: f.userId,
          movedAt: T0 + 1000 + i,
          movementKind: "direct",
        });
      }
    });
    vi.advanceTimersByTime(1000);
    const jobId = await f.user.mutation(api.exports.create, {
      organizationId: f.organizationId,
      requestKey: "busy",
      format: "jsonl",
      source: custody,
    });
    vi.advanceTimersByTime(1);
    await f.t.finishInProgressScheduledFunctions();
    const firstPage = await f.user.query(api.exports.status, { jobId });
    expect(firstPage.rows).toBe(200);
    expect(firstPage.checkpoint).toBe(1);

    await f.t.run((ctx) => ctx.db.delete(f.membershipId));
    await f.t.finishAllScheduledFunctions(() => vi.advanceTimersByTime(1));
    const revoked = await f.t.run((ctx) => ctx.db.get(jobId));
    expect(revoked?.status).toBe("failed");
    expect(revoked?.error).toMatch(/permission revoked/);
    expect(revoked?.rows).toBe(200);

    await f.t.run(async (ctx) => {
      const role = await ctx.db
        .query("roles")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", f.organizationId),
        )
        .first();
      if (!role) throw new Error("role missing");
      await ctx.db.insert("userOrganizations", {
        userId: f.userId,
        organizationId: f.organizationId,
        roleId: role._id,
        joinedAt: T0,
      });
    });
    await f.user.mutation(api.exports.resume, { jobId });
    await f.t.finishAllScheduledFunctions(() => vi.advanceTimersByTime(1));
    const job = await f.user.query(api.exports.status, { jobId });
    expect(job.status).toBe("completed");
    expect(job.rows).toBe(480);
    const rows = decodeJsonl(await downloadText(f, jobId));
    expect(rows).toHaveLength(480);
    expect(new Set(rows.map((row) => row.eventId)).size).toBe(480);
    expect(rows.filter((row) => row.objectId === busy)).toHaveLength(450);
  });

  test("register jobs disappear and stop downloading after the plan loses reporting", async () => {
    const f = await fixture();
    await insertObject(f, { accessionNumber: "A-1", title: "Object" });
    vi.advanceTimersByTime(1000);
    const { jobId, job } = await runExport(
      f,
      { kind: "register", profile: "condition", criteria: {} },
      "csv",
      "downgrade",
    );
    expect(job.status).toBe("completed");
    expect(
      (
        await f.user.query(api.exports.list, {
          organizationId: f.organizationId,
        })
      ).map((listed) => listed.jobId),
    ).toEqual([jobId]);
    await f.t.run((ctx) =>
      ctx.db.patch(f.organizationId, { subscriptionTier: "free" }),
    );
    expect(
      await f.user.query(api.exports.list, {
        organizationId: f.organizationId,
      }),
    ).toEqual([]);
    expect(
      (await f.user.fetch(`/exports/download?jobId=${jobId}`)).status,
    ).toBe(403);
  });

  test("preview returns the typed schema and the first rows of one bounded page", async () => {
    const f = await fixture();
    await f.t.run(async (ctx) => {
      for (let i = 0; i < 12; i++)
        await ctx.db.insert("accessions", {
          organizationId: f.organizationId,
          accessionNumber: `P-${String(i).padStart(2, "0")}`,
          dateReceived: T0 - 100000 + i,
          source: "Donor",
          method: "gift",
          status: "pending",
        });
    });
    const preview = await f.user.query(api.registers.preview, {
      organizationId: f.organizationId,
      profile: "accession",
      criteria: { status: "pending" },
    });
    expect(preview.profileVersion).toBe(1);
    expect(preview.columns.slice(0, 3)).toEqual([
      { name: "accessionId", type: "id" },
      { name: "accessionNumber", type: "text" },
      { name: "catalogIdentifier", type: "text" },
    ]);
    expect(preview.rows).toHaveLength(10);
    expect(preview.rows[0]?.accessionNumber).toBe("P-00");
    expect(preview.rows[0]?.capturedAt).toBeNull();
    expect(preview.pageRows).toBe(12);
    expect(preview.hasMore).toBe(true);
  });
});
