import { afterEach, describe, expect, test, vi } from "vitest";
import { api } from "../convex/_generated/api";
import type { Doc, Id } from "../convex/_generated/dataModel";
import {
  decodeJsonl,
  decodeRegisterCsv,
  downloadManifest,
  downloadText,
  errorCodeOf,
  type Fixture,
  fixture,
  insertObject,
  runExport,
  type Source,
  T0,
  withoutCapture,
} from "./registerExportHarness";

const DAY = 24 * 60 * 60 * 1000;

afterEach(() => {
  vi.useRealTimers();
});

interface AppraisalFields {
  collectionId: Id<"collections">;
  appraisalType:
    | "insurance"
    | "market"
    | "fair_market"
    | "replacement"
    | "liquidation";
  currency: string;
  value: number;
  appraisalDate: number;
  createdAt?: number;
  appraiserName?: string;
  appraiserCompany?: string;
  validUntil?: number;
  supersedes?: Id<"appraisals">;
  supersessionReason?: string;
}

async function insertAppraisal(f: Fixture, fields: AppraisalFields) {
  return await f.t.run((ctx) =>
    ctx.db.insert("appraisals", {
      organizationId: f.organizationId,
      createdBy: f.userId,
      createdAt: T0 - 10,
      appraiserName: "A. Valuer",
      ...fields,
    }),
  );
}

/** Records a correction the way `appraisals.supersede` does. */
async function supersedeAppraisal(
  f: Fixture,
  original: Id<"appraisals">,
  correction: Omit<AppraisalFields, "supersedes"> & { createdAt: number },
) {
  const corrected = await insertAppraisal(f, {
    ...correction,
    supersedes: original,
  });
  await f.t.run((ctx) =>
    ctx.db.patch(original, {
      supersededBy: corrected,
      supersededAt: correction.createdAt,
      supersededByUserId: f.userId,
    }),
  );
  return corrected;
}

const valuation: Source = {
  kind: "register",
  profile: "valuation",
  criteria: {},
};

describe("board valuation report", () => {
  test("lists each object's current valuation per purpose and currency, keeps unvalued objects explicit and round-trips CSV and JSONL", async () => {
    const f = await fixture("pro", ["collections.read"]);
    const vase = await insertObject(f, {
      accessionNumber: "2020.1",
      title: "=Vase",
    });
    const chair = await insertObject(f, {
      accessionNumber: "2020.2",
      title: "Chair",
    });
    const original = await insertAppraisal(f, {
      collectionId: vase,
      appraisalType: "insurance",
      currency: "EUR",
      value: 120000,
      appraisalDate: T0 - 100 * DAY,
      createdAt: T0 - 20,
    });
    const corrected = await supersedeAppraisal(f, original, {
      collectionId: vase,
      appraisalType: "insurance",
      currency: "EUR",
      value: 125000.5,
      appraisalDate: T0 - 100 * DAY,
      createdAt: T0 - 5,
      supersessionReason: "Frame included",
    });
    const market = await insertAppraisal(f, {
      collectionId: vase,
      appraisalType: "market",
      currency: "USD",
      value: 130000,
      appraisalDate: T0 - 50 * DAY,
      appraiserCompany: "Auction House",
      validUntil: T0 + 300 * DAY,
    });
    vi.advanceTimersByTime(1000);

    const csv = await runExport(f, valuation, "csv", "valuation-csv");
    const jsonl = await runExport(f, valuation, "jsonl", "valuation-jsonl");
    expect(csv.job.status).toBe("completed");
    expect(jsonl.job.status).toBe("completed");

    const manifest = await downloadManifest(f, csv.jobId);
    expect(manifest.generator).toEqual({
      name: "MuseumLite register export",
      profile: "register.valuation",
      profileVersion: 1,
      exportSchemaVersion: 1,
    });
    expect(manifest.compatibility).toContain("not a SPECTRUM, LIDO");
    const rows = decodeRegisterCsv(
      await downloadText(f, csv.jobId),
      manifest.columns,
    );
    expect(withoutCapture(rows)).toEqual(
      withoutCapture(decodeJsonl(await downloadText(f, jsonl.jobId))),
    );
    expect(rows).toHaveLength(3);
    const [insurance, marketRow, unvalued] = rows;
    expect(insurance).toMatchObject({
      objectId: vase,
      objectAccessionNumber: "2020.1",
      objectTitle: "=Vase",
      objectStatus: "active",
      inventoryScope: "owned",
      purpose: "insurance",
      currency: "EUR",
      currencyRecognized: true,
      value: 125000.5,
      validityAsOf: "valid",
      appraisalId: corrected,
      appraisalDate: T0 - 100 * DAY,
      validUntil: null,
      renewalDueAt: T0 - 100 * DAY + 730 * DAY,
      appraiserName: "A. Valuer",
      supersedesAppraisalId: original,
      supersessionReason: "Frame included",
      recordedAt: T0 - 5,
      evidenceStatus: "recorded",
      notRecorded: null,
    });
    expect(marketRow).toMatchObject({
      purpose: "market",
      currency: "USD",
      value: 130000,
      appraisalId: market,
      appraiserCompany: "Auction House",
      validUntil: T0 + 300 * DAY,
      renewalDueAt: T0 + 300 * DAY,
      supersedesAppraisalId: null,
    });
    expect(unvalued).toMatchObject({
      objectId: chair,
      objectAccessionNumber: "2020.2",
      purpose: null,
      currency: null,
      currencyRecognized: null,
      value: null,
      validityAsOf: "none",
      appraisalId: null,
      evidenceStatus: "recorded",
      notRecorded: "purpose;currency;value;appraisalId;appraisalDate;appraiserName",
    });
  });

  test("totals are exact, grouped by inventory scope, purpose and currency, and never add across currencies or borrowed property", async () => {
    const f = await fixture("pro", ["collections.read"]);
    const object = (accessionNumber: string) =>
      insertObject(f, { accessionNumber, title: accessionNumber });
    const [a, b, c, d, borrowed] = [
      await object("A"),
      await object("B"),
      await object("C"),
      await object("D"),
      await object("LOAN-IN-1"),
    ];
    await f.t.run(async (ctx) => {
      const loanId = await ctx.db.insert("loans", {
        organizationId: f.organizationId,
        loanNumber: "IN-1",
        type: "incoming",
        lenderBorrowerName: "Lender",
        startDate: T0 - 10000,
        status: "active",
      });
      await ctx.db.insert("loanItems", { loanId, collectionId: borrowed });
    });
    const insurance = (
      collectionId: Id<"collections">,
      currency: string,
      value: number,
    ) =>
      insertAppraisal(f, {
        collectionId,
        appraisalType: "insurance",
        currency,
        value,
        appraisalDate: T0 - DAY,
      });
    await insurance(a, "EUR", 0.1);
    await insurance(b, "EUR", 0.2);
    await insurance(c, "USD", 13500);
    await insurance(d, "dollars", 900);
    await insurance(borrowed, "EUR", 500);
    await insertAppraisal(f, {
      collectionId: a,
      appraisalType: "market",
      currency: "EUR",
      value: 100,
      appraisalDate: T0 - DAY,
    });
    vi.advanceTimersByTime(1000);

    const { jobId, job } = await runExport(f, valuation, "csv", "totals");
    expect(job.status).toBe("completed");
    expect(job.totals).toEqual([
      {
        group: ["incoming", "insurance"],
        currency: "EUR",
        total: "500",
        count: 1,
      },
      {
        group: ["owned", "insurance"],
        currency: "EUR",
        total: "0.3",
        count: 2,
      },
      {
        group: ["owned", "insurance"],
        currency: "USD",
        total: "13500",
        count: 1,
      },
      {
        group: ["owned", "insurance"],
        currency: null,
        total: null,
        count: 1,
      },
      {
        group: ["owned", "market"],
        currency: "EUR",
        total: "100",
        count: 1,
      },
    ]);
    const manifest = await downloadManifest(f, jobId);
    expect(manifest.totals).toMatchObject({
      groupBy: ["inventoryScope", "purpose"],
      amountColumn: "value",
      currencyColumn: "currency",
    });
    expect(manifest.totals?.definition).toContain(
      "never added across currencies",
    );
    expect(manifest.totals?.entries).toContainEqual({
      inventoryScope: "owned",
      purpose: "insurance",
      currency: "EUR",
      total: "0.3",
      count: 2,
    });
    expect(manifest.totals?.entries).toContainEqual({
      inventoryScope: "owned",
      purpose: "insurance",
      currency: null,
      total: null,
      count: 1,
    });
  });

  test("a historical as-of reproduces the valuations then current and judges their validity at that time", async () => {
    const f = await fixture("pro", ["collections.read"]);
    const vase = await insertObject(f, {
      accessionNumber: "2020.1",
      title: "Vase",
    });
    const recordedAt = T0 + 1000;
    const historicalAsOf = T0 + 2000;
    const original = await insertAppraisal(f, {
      collectionId: vase,
      appraisalType: "insurance",
      currency: "EUR",
      value: 1000,
      appraisalDate: historicalAsOf - 400 * DAY,
      createdAt: recordedAt,
    });
    const scheduled = await insertAppraisal(f, {
      collectionId: vase,
      appraisalType: "market",
      currency: "GBP",
      value: 700,
      appraisalDate: T0 + 5 * DAY,
      createdAt: recordedAt,
    });
    const corrected = await supersedeAppraisal(f, original, {
      collectionId: vase,
      appraisalType: "insurance",
      currency: "EUR",
      value: 1500,
      appraisalDate: T0 - 20 * DAY,
      createdAt: T0 + 3000,
      supersessionReason: "Revalued",
    });
    await insertAppraisal(f, {
      collectionId: vase,
      appraisalType: "replacement",
      currency: "CHF",
      value: 900,
      appraisalDate: T0 - 2 * DAY,
      createdAt: T0 + 4000,
    });
    vi.advanceTimersByTime(5000);
    const preview = (asOf?: number) =>
      f.user.query(api.registers.preview, {
        organizationId: f.organizationId,
        profile: "valuation",
        criteria: { asOf },
        now: Date.now(),
      });

    const then = await preview(historicalAsOf);
    expect(
      then.rows.map((row) => [
        row.purpose,
        row.appraisalId,
        row.value,
        row.validityAsOf,
      ]),
    ).toEqual([
      ["insurance", original, 1000, "valid"],
      ["market", scheduled, 700, "future_dated"],
    ]);

    const now = await preview();
    expect(
      now.rows.map((row) => [row.purpose, row.value, row.validityAsOf]),
    ).toEqual([
      ["insurance", 1500, "valid"],
      ["replacement", 900, "valid"],
      ["market", 700, "future_dated"],
    ]);
    expect(now.rows[0]?.appraisalId).toBe(corrected);
  });

  test("purpose, currency, inventory scope and object criteria narrow the rows and the gaps they report", async () => {
    const f = await fixture("pro", ["collections.read"]);
    const valued = await insertObject(f, { accessionNumber: "A", title: "A" });
    const marketOnly = await insertObject(f, {
      accessionNumber: "B",
      title: "B",
    });
    const borrowed = await insertObject(f, {
      accessionNumber: "C",
      title: "C",
    });
    await f.t.run(async (ctx) => {
      const loanId = await ctx.db.insert("loans", {
        organizationId: f.organizationId,
        loanNumber: "IN-2",
        type: "incoming",
        lenderBorrowerName: "Lender",
        startDate: T0 - 10000,
        status: "active",
      });
      await ctx.db.insert("loanItems", { loanId, collectionId: borrowed });
    });
    const appraise = (
      collectionId: Id<"collections">,
      appraisalType: AppraisalFields["appraisalType"],
      currency: string,
    ) =>
      insertAppraisal(f, {
        collectionId,
        appraisalType,
        currency,
        value: 10,
        appraisalDate: T0 - DAY,
      });
    const insuredInEuro = await appraise(valued, "insurance", "EUR");
    await appraise(valued, "insurance", "USD");
    await appraise(valued, "market", "EUR");
    const market = await appraise(marketOnly, "market", "EUR");
    await appraise(borrowed, "insurance", "EUR");
    vi.advanceTimersByTime(1000);
    const preview = (criteria: Extract<Source, { kind: "register" }>["criteria"]) =>
      f.user.query(api.registers.preview, {
        organizationId: f.organizationId,
        profile: "valuation",
        criteria,
        now: Date.now(),
      });

    const insured = await preview({
      purpose: "insurance",
      currency: "EUR",
      inventoryScope: "owned",
    });
    expect(
      insured.rows.map((row) => [
        row.objectAccessionNumber,
        row.purpose,
        row.currency,
        row.appraisalId,
        row.validityAsOf,
        row.notRecorded,
      ]),
    ).toEqual([
      ["A", "insurance", "EUR", insuredInEuro, "valid", null],
      [
        "B",
        "insurance",
        "EUR",
        null,
        "none",
        "value;appraisalId;appraisalDate;appraiserName",
      ],
    ]);

    const single = await preview({ objectId: marketOnly });
    expect(single.rows.map((row) => row.appraisalId)).toEqual([market]);
  });

  test("criteria a profile does not use, or an unrecognised currency, are refused with the stable code", async () => {
    const f = await fixture();
    const create = (
      requestKey: string,
      profile: Extract<Source, { kind: "register" }>["profile"],
      criteria: Record<string, unknown>,
    ) =>
      errorCodeOf(
        f.user.mutation(api.exports.create, {
          organizationId: f.organizationId,
          requestKey,
          format: "csv",
          source: {
            kind: "register",
            profile,
            criteria,
          } as Source,
        }),
      );
    for (const [requestKey, profile, criteria] of [
      ["valuation-range", "valuation", { fromDate: T0 - DAY }],
      ["valuation-status", "valuation", { status: "approved" }],
      ["valuation-currency-text", "valuation", { currency: "dollars" }],
      ["valuation-currency-case", "valuation", { currency: "eur" }],
      ["custody-purpose", "custody", { purpose: "insurance" }],
      ["accession-currency", "accession", { currency: "EUR" }],
      ["accession-scope", "accession", { inventoryScope: "owned" }],
    ] as const) {
      expect(await create(requestKey, profile, criteria)).toBe(
        "REGISTER_CRITERIA_INVALID",
      );
    }
  });

  test("valuations past their two-year age or valid-until date are due for renewal", async () => {
    const f = await fixture("pro", ["collections.read"]);
    const old = await insertObject(f, { accessionNumber: "OLD", title: "Old" });
    const lapsed = await insertObject(f, {
      accessionNumber: "LAPSED",
      title: "Lapsed",
    });
    await insertAppraisal(f, {
      collectionId: old,
      appraisalType: "insurance",
      currency: "EUR",
      value: 10,
      appraisalDate: T0 - 731 * DAY,
      createdAt: T0 - 731 * DAY,
    });
    await insertAppraisal(f, {
      collectionId: lapsed,
      appraisalType: "insurance",
      currency: "EUR",
      value: 20,
      appraisalDate: T0 - 30 * DAY,
      validUntil: T0 - DAY,
    });
    vi.advanceTimersByTime(1000);
    const preview = await f.user.query(api.registers.preview, {
      organizationId: f.organizationId,
      profile: "valuation",
      criteria: {},
      now: Date.now(),
    });
    expect(
      preview.rows.map((row) => [
        row.objectAccessionNumber,
        row.validityAsOf,
        row.renewalDueAt,
      ]),
    ).toEqual([
      ["OLD", "renewal_due", T0 - 731 * DAY + 730 * DAY],
      ["LAPSED", "renewal_due", T0 - DAY],
    ]);
  });
});

interface PolicyFields {
  policyNumber: string;
  currency?: string;
  effectiveDate: number;
  expirationDate: number;
  status?: "active" | "pending" | "expired" | "cancelled" | "suspended";
  policyType?: "blanket" | "scheduled" | "exhibition" | "transit" | "loan";
}

async function insertPolicy(f: Fixture, fields: PolicyFields) {
  return await f.t.run((ctx) =>
    ctx.db.insert("insurancePolicies", {
      organizationId: f.organizationId,
      carrier: "Fine Art Mutual",
      policyType: "scheduled",
      coverageAmount: 1_000_000,
      status: "active",
      createdBy: f.userId,
      createdAt: T0 - 200 * DAY,
      ...fields,
    }),
  );
}

interface CoverageFields {
  policyId: Id<"insurancePolicies">;
  targetType?: "object" | "loan" | "exhibition";
  collectionId?: Id<"collections">;
  loanId?: Id<"loans">;
  coveredValue: number;
  currency?: string;
  status?: "active" | "pending" | "expired" | "removed";
  effectiveDate?: number;
  expirationDate?: number;
  createdAt?: number;
}

async function insertCoverage(f: Fixture, fields: CoverageFields) {
  return await f.t.run((ctx) =>
    ctx.db.insert("insuranceCoverages", {
      organizationId: f.organizationId,
      status: "active",
      createdBy: f.userId,
      createdAt: T0 - 50 * DAY,
      ...fields,
    }),
  );
}

const insuranceSchedule: Source = {
  kind: "register",
  profile: "insurance",
  criteria: {},
};

describe("insurer schedule", () => {
  test("lists every coverage with its state, value and supporting insurance valuation, totalled per state and currency", async () => {
    const f = await fixture("pro", ["collections.read", "loans.read"]);
    const vase = await insertObject(f, {
      accessionNumber: "2020.1",
      title: "Vase",
    });
    const bowl = await insertObject(f, {
      accessionNumber: "2020.2",
      title: "Bowl",
    });
    const loanId = await f.t.run((ctx) =>
      ctx.db.insert("loans", {
        organizationId: f.organizationId,
        loanNumber: "OUT-7",
        type: "outgoing",
        lenderBorrowerName: "City Gallery",
        startDate: T0 - 10 * DAY,
        status: "active",
      }),
    );
    const appraisal = await insertAppraisal(f, {
      collectionId: vase,
      appraisalType: "insurance",
      currency: "EUR",
      value: 125000,
      appraisalDate: T0 - 30 * DAY,
      appraiserName: "B. Assessor",
    });
    const policy = await insertPolicy(f, {
      policyNumber: "POL-1",
      currency: "EUR",
      effectiveDate: T0 - 100 * DAY,
      expirationDate: T0 + 265 * DAY,
    });
    // Recorded as active, but its period ended: the date decides.
    const lapsed = await insertPolicy(f, {
      policyNumber: "POL-OLD",
      currency: "EUR",
      effectiveDate: T0 - 400 * DAY,
      expirationDate: T0 - 35 * DAY,
    });
    const vaseCover = await insertCoverage(f, {
      policyId: policy,
      targetType: "object",
      collectionId: vase,
      coveredValue: 125000,
      currency: "EUR",
    });
    const bowlCover = await insertCoverage(f, {
      policyId: policy,
      targetType: "object",
      collectionId: bowl,
      coveredValue: 50000.25,
      currency: "EUR",
    });
    const loanCover = await insertCoverage(f, {
      policyId: policy,
      targetType: "loan",
      loanId,
      coveredValue: 20000,
      currency: "USD",
      effectiveDate: T0 - 10 * DAY,
      expirationDate: T0 + 20 * DAY,
    });
    const legacyCover = await insertCoverage(f, {
      policyId: policy,
      collectionId: bowl,
      loanId,
      coveredValue: 300,
    });
    await insertCoverage(f, {
      policyId: policy,
      targetType: "object",
      collectionId: bowl,
      coveredValue: 999,
      currency: "EUR",
      status: "removed",
    });
    await insertCoverage(f, {
      policyId: lapsed,
      targetType: "object",
      collectionId: vase,
      coveredValue: 1000,
      currency: "EUR",
      createdAt: T0 - 300 * DAY,
    });
    vi.advanceTimersByTime(1000);

    const csv = await runExport(f, insuranceSchedule, "csv", "schedule-csv");
    const jsonl = await runExport(
      f,
      insuranceSchedule,
      "jsonl",
      "schedule-jsonl",
    );
    expect(csv.job.status).toBe("completed");
    const manifest = await downloadManifest(f, csv.jobId);
    expect(manifest.generator).toMatchObject({
      profile: "register.insurance",
      profileVersion: 1,
    });
    const rows = decodeRegisterCsv(
      await downloadText(f, csv.jobId),
      manifest.columns,
    );
    expect(withoutCapture(rows)).toEqual(
      withoutCapture(decodeJsonl(await downloadText(f, jsonl.jobId))),
    );
    expect(
      rows.map((row) => [row.coverageId ?? null, row.stateAsOf]),
    ).toEqual([
      [vaseCover, "in_force"],
      [bowlCover, "in_force"],
      [loanCover, "in_force"],
      [legacyCover, "needs_review"],
      [expect.any(String), "removed"],
      [expect.any(String), "expired"],
    ]);
    const [vaseRow, bowlRow, loanRow, legacyRow, , lapsedRow] = rows;
    expect(vaseRow).toMatchObject({
      policyId: policy,
      policyNumber: "POL-1",
      carrier: "Fine Art Mutual",
      policyType: "scheduled",
      policyStatusAsOf: "active",
      policyEffectiveDate: T0 - 100 * DAY,
      policyExpirationDate: T0 + 265 * DAY,
      targetKind: "object",
      targetId: vase,
      targetReference: "2020.1",
      targetLabel: "Vase",
      coveredValue: 125000,
      currency: "EUR",
      currencyRecognized: true,
      coverageStart: T0 - 100 * DAY,
      coverageEnd: T0 + 265 * DAY,
      appraisalStatusAsOf: "current",
      appraisalId: appraisal,
      appraisalValue: 125000,
      appraisalDate: T0 - 30 * DAY,
      appraiserName: "B. Assessor",
      recordedAt: T0 - 50 * DAY,
      evidenceStatus: "recorded",
      notRecorded: null,
    });
    expect(bowlRow).toMatchObject({
      appraisalStatusAsOf: "missing",
      appraisalId: null,
      notRecorded: "appraisalId;appraisalValue;appraisalDate;appraiserName",
    });
    expect(loanRow).toMatchObject({
      targetKind: "loan",
      targetId: loanId,
      targetReference: "OUT-7",
      targetLabel: "City Gallery",
      coverageStart: T0 - 10 * DAY,
      coverageEnd: T0 + 20 * DAY,
      appraisalStatusAsOf: "not_applicable",
      notRecorded: null,
    });
    expect(legacyRow).toMatchObject({
      targetKind: null,
      targetId: null,
      currency: null,
      currencyRecognized: false,
      appraisalStatusAsOf: "not_applicable",
      evidenceStatus: "legacy",
      notRecorded: "targetKind;targetId;targetReference;targetLabel;currency",
    });
    expect(lapsedRow).toMatchObject({
      policyNumber: "POL-OLD",
      policyStatusAsOf: "expired",
    });
    expect(csv.job.totals).toEqual([
      { group: ["expired"], currency: "EUR", total: "1000", count: 1 },
      { group: ["in_force"], currency: "EUR", total: "175000.25", count: 2 },
      { group: ["in_force"], currency: "USD", total: "20000", count: 1 },
      { group: ["needs_review"], currency: null, total: null, count: 1 },
      { group: ["removed"], currency: "EUR", total: "999", count: 1 },
    ]);
    expect(manifest.totals).toMatchObject({
      groupBy: ["stateAsOf"],
      amountColumn: "coveredValue",
      currencyColumn: "currency",
    });
  });

  test("a historical as-of judges coverage and appraisal states from their dates; policy and currency criteria narrow the schedule", async () => {
    const f = await fixture("pro", ["collections.read", "loans.read"]);
    const vase = await insertObject(f, {
      accessionNumber: "2020.1",
      title: "Vase",
    });
    const historicalAsOf = T0 - 100 * DAY;
    const appraisal = await insertAppraisal(f, {
      collectionId: vase,
      appraisalType: "insurance",
      currency: "EUR",
      value: 5000,
      appraisalDate: T0 - 1200 * DAY,
      createdAt: T0 - 1200 * DAY,
    });
    // Reconciled since: recorded expired, but in force at the historical as-of.
    const ended = await insertPolicy(f, {
      policyNumber: "POL-ENDED",
      currency: "EUR",
      effectiveDate: T0 - 300 * DAY,
      expirationDate: T0 - 10 * DAY,
      status: "expired",
    });
    const running = await insertPolicy(f, {
      policyNumber: "POL-RUNNING",
      currency: "USD",
      effectiveDate: T0 - 250 * DAY,
      expirationDate: T0 + 100 * DAY,
    });
    const reconciled = await insertCoverage(f, {
      policyId: ended,
      targetType: "object",
      collectionId: vase,
      coveredValue: 5000,
      currency: "EUR",
      status: "expired",
      createdAt: T0 - 290 * DAY,
    });
    const later = await insertCoverage(f, {
      policyId: ended,
      targetType: "object",
      collectionId: vase,
      coveredValue: 6000,
      currency: "EUR",
      createdAt: T0 - 50 * DAY,
    });
    const dollars = await insertCoverage(f, {
      policyId: running,
      targetType: "object",
      collectionId: vase,
      coveredValue: 7000,
      currency: "USD",
      createdAt: T0 - 200 * DAY,
    });
    vi.advanceTimersByTime(1000);
    const preview = (
      criteria: Extract<Source, { kind: "register" }>["criteria"],
    ) =>
      f.user.query(api.registers.preview, {
        organizationId: f.organizationId,
        profile: "insurance",
        criteria,
        now: Date.now(),
      });

    const then = await preview({ policyId: ended, asOf: historicalAsOf });
    expect(then.rows).toHaveLength(1);
    expect(then.rows[0]).toMatchObject({
      coverageId: reconciled,
      policyStatusAsOf: "active",
      stateAsOf: "in_force",
      appraisalStatusAsOf: "stale",
      appraisalId: appraisal,
    });

    const now = await preview({ policyId: ended });
    expect(
      now.rows.map((row) => [row.coverageId, row.stateAsOf]),
    ).toEqual([
      [reconciled, "expired"],
      [later, "expired"],
    ]);

    const inDollars = await preview({ currency: "USD" });
    expect(now.rows.map((row) => row.policyStatusAsOf)).toEqual([
      "expired",
      "expired",
    ]);
    expect(
      inDollars.rows.map((row) => [row.coverageId, row.stateAsOf]),
    ).toEqual([[dollars, "in_force"]]);

    const foreignPolicy = await f.t.run((ctx) =>
      ctx.db.insert("insurancePolicies", {
        organizationId: f.otherOrganizationId,
        policyNumber: "THEIRS",
        carrier: "Elsewhere",
        policyType: "blanket",
        coverageAmount: 1,
        effectiveDate: T0 - DAY,
        expirationDate: T0 + DAY,
        status: "active",
        createdBy: f.userId,
        createdAt: T0,
      }),
    );
    await expect(preview({ policyId: foreignPolicy })).rejects.toThrow(
      /Filter outside organization/,
    );
    await expect(
      f.user.mutation(api.exports.create, {
        organizationId: f.organizationId,
        requestKey: "foreign-policy",
        format: "csv",
        source: {
          kind: "register",
          profile: "insurance",
          criteria: { policyId: foreignPolicy },
        },
      }),
    ).rejects.toThrow(/Filter outside organization/);
  });
});

type ClaimFields = Partial<Doc<"provenanceClaims">> &
  Pick<Doc<"provenanceClaims">, "objectId" | "statement" | "partyKind">;

async function insertClaim(f: Fixture, fields: ClaimFields) {
  return await f.t.run((ctx) =>
    ctx.db.insert("provenanceClaims", {
      organizationId: f.organizationId,
      confidence: "unassessed",
      reviewStatus: "unreviewed",
      createdBy: f.userId,
      createdAt: T0 - 30,
      ...fields,
    }),
  );
}

async function insertCitation(
  f: Fixture,
  fields: {
    objectId: Id<"collections">;
    claimId: Id<"provenanceClaims">;
    citation: string;
    url?: string;
    excerpt?: string;
    locator?: string;
    linkedAt: number;
    retractedAt?: number;
    retractionReason?: string;
  },
) {
  return await f.t.run((ctx) =>
    ctx.db.insert("provenanceEvidence", {
      organizationId: f.organizationId,
      kind: "citation",
      linkedBy: f.userId,
      ...fields,
    }),
  );
}

const provenanceReport: Source = {
  kind: "register",
  profile: "provenance",
  criteria: {},
};

describe("provenance research report", () => {
  test("lists each claim with its holder, partial dates, confidence and review, then its evidence and the legacy text", async () => {
    const f = await fixture("pro", ["collections.read", "media.read"]);
    const vase = await insertObject(f, {
      accessionNumber: "1937.4",
      title: "Vase",
      provenance: "Bought in Paris, c. 1930",
      ownershipHistory: [
        {
          owner: "Dealer X",
          startYear: "1925",
          endYear: "1930",
          verified: true,
          verificationSource: "Invoice",
        },
      ],
    });
    const documented = await insertClaim(f, {
      objectId: vase,
      statement: "Sold by Dealer X in Paris",
      partyKind: "named",
      partyText: "Dealer X",
      role: "owner",
      method: "purchase",
      place: "Paris",
      startDate: { precision: "year", year: 1925, qualifier: "circa" },
      endDate: { precision: "month", year: 1930, month: 6 },
      confidence: "documented",
      reviewStatus: "accepted",
      reviewedAt: T0 - 5,
      reviewedBy: f.userId,
      reviewNote: "Invoice seen",
      createdAt: T0 - 20,
    });
    const retracted = await insertClaim(f, {
      objectId: vase,
      statement: "Private collection",
      partyKind: "anonymous",
      partyText: "private collection",
      confidence: "probable",
      supersededAt: T0 - 3,
      supersededBy: f.userId,
      supersessionReason: "Duplicate",
      createdAt: T0 - 18,
    });
    const gap = await insertClaim(f, {
      objectId: vase,
      statement: "Whereabouts unknown",
      partyKind: "unknown",
      startDate: { precision: "decade", year: 1930 },
      endDate: {
        precision: "year",
        year: 1937,
        qualifier: "notAfter",
        uncertain: true,
      },
      confidence: "possible",
      createdAt: T0 - 15,
    });
    await f.t.run((ctx) =>
      ctx.db.insert("provenanceReviews", {
        organizationId: f.organizationId,
        objectId: vase,
        claimId: documented,
        decision: "accepted",
        previousStatus: "unreviewed",
        note: "Invoice seen",
        reviewedBy: f.userId,
        reviewedAt: T0 - 5,
      }),
    );
    const catalogue = await insertCitation(f, {
      objectId: vase,
      claimId: documented,
      citation: "=Sale catalogue",
      url: "https://example.test/catalogue",
      excerpt: "Lot 12, a vase",
      locator: "lot 12",
      linkedAt: T0 - 20,
    });
    const invoiceFile = await f.t.run(async (ctx) => {
      const storageId = await ctx.storage.store(new Blob(["invoice"]));
      return await ctx.db.insert("mediaFiles", {
        organizationId: f.organizationId,
        collectionId: vase,
        storageId,
        fileName: "invoice-renamed.pdf",
        fileType: "document",
        fileSize: 7,
        mimeType: "application/pdf",
        mediaCategory: "document",
        isPrimary: false,
        uploadedBy: f.userId,
        uploadedAt: T0 - 25,
        uploadStatus: "completed",
      });
    });
    const invoice = await f.t.run((ctx) =>
      ctx.db.insert("provenanceEvidence", {
        organizationId: f.organizationId,
        objectId: vase,
        claimId: documented,
        kind: "media",
        mediaId: invoiceFile,
        fileNameSnapshot: "invoice.pdf",
        linkedBy: f.userId,
        linkedAt: T0 - 19,
      }),
    );
    const wrongSource = await insertCitation(f, {
      objectId: vase,
      claimId: gap,
      citation: "Old guidebook",
      linkedAt: T0 - 15,
      retractedAt: T0 - 2,
      retractionReason: "Wrong source",
    });
    vi.advanceTimersByTime(1000);

    const csv = await runExport(f, provenanceReport, "csv", "provenance-csv");
    const jsonl = await runExport(
      f,
      provenanceReport,
      "jsonl",
      "provenance-jsonl",
    );
    expect(csv.job.status).toBe("completed");
    expect(csv.job.totals).toBeUndefined();
    const manifest = await downloadManifest(f, csv.jobId);
    expect(manifest.generator).toMatchObject({
      profile: "register.provenance",
      profileVersion: 1,
    });
    expect(manifest.totals).toBeUndefined();
    const rows = decodeRegisterCsv(
      await downloadText(f, csv.jobId),
      manifest.columns,
    );
    expect(withoutCapture(rows)).toEqual(
      withoutCapture(decodeJsonl(await downloadText(f, jsonl.jobId))),
    );
    expect(
      rows.map((row) => [row.recordType, row.claimId, row.evidenceId]),
    ).toEqual([
      ["claim", documented, null],
      ["claim", gap, null],
      ["claim", retracted, null],
      ["evidence", documented, catalogue],
      ["evidence", documented, invoice],
      ["evidence", gap, wrongSource],
      ["legacy_text", null, null],
      ["legacy_ownership", null, null],
    ]);
    const [
      documentedRow,
      gapRow,
      retractedRow,
      catalogueRow,
      invoiceRow,
      wrongSourceRow,
      legacyText,
      legacyOwner,
    ] = rows;
    expect(documentedRow).toMatchObject({
      objectId: vase,
      objectAccessionNumber: "1937.4",
      objectTitle: "Vase",
      currentAsOf: true,
      statement: "Sold by Dealer X in Paris",
      partyKind: "named",
      partyText: "Dealer X",
      role: "owner",
      method: "purchase",
      place: "Paris",
      startDate: "1925~",
      endDate: "1930-06",
      confidence: "documented",
      reviewStatusAsOf: "accepted",
      reviewedAt: T0 - 5,
      reviewedBy: f.userId,
      reviewNote: "Invoice seen",
      contestedAsOf: false,
      supersededAt: null,
      recordedAt: T0 - 20,
      evidenceStatus: "recorded",
      notRecorded: null,
    });
    expect(gapRow).toMatchObject({
      partyKind: "unknown",
      partyText: null,
      startDate: "193X",
      endDate: "[..1937?]",
      confidence: "possible",
      reviewStatusAsOf: "unreviewed",
      reviewedAt: null,
      notRecorded: "role;method;place",
    });
    expect(retractedRow).toMatchObject({
      currentAsOf: false,
      partyKind: "anonymous",
      partyText: "private collection",
      supersededAt: T0 - 3,
      supersededByClaimId: null,
      supersessionReason: "Duplicate",
      notRecorded: "role;method;place;startDate;endDate",
    });
    expect(catalogueRow).toMatchObject({
      evidenceKind: "citation",
      currentAsOf: true,
      citation: "=Sale catalogue",
      url: "https://example.test/catalogue",
      excerpt: "Lot 12, a vase",
      locator: "lot 12",
      recordedAt: T0 - 20,
      evidenceStatus: "recorded",
      notRecorded: null,
    });
    expect(invoiceRow).toMatchObject({
      evidenceKind: "media",
      mediaId: invoiceFile,
      fileName: "invoice.pdf",
      citation: null,
    });
    expect(wrongSourceRow).toMatchObject({
      currentAsOf: false,
      retractedAt: T0 - 2,
      retractionReason: "Wrong source",
    });
    expect(legacyText).toMatchObject({
      objectId: vase,
      statement: "Bought in Paris, c. 1930",
      evidenceStatus: "legacy",
      notRecorded: "recordedAt",
    });
    expect(legacyOwner).toMatchObject({
      partyText: "Dealer X",
      legacyStartYear: "1925",
      legacyEndYear: "1930",
      legacyVerified: true,
      citation: "Invoice",
      evidenceStatus: "legacy",
      notRecorded: "recordedAt",
    });
    expect(await downloadText(f, csv.jobId)).toContain(`"'=Sale catalogue"`);
  });
});
