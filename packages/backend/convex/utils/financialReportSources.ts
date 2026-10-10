import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { classifyInventoryRecord } from "./collectionMetrics";
import { normalizeCurrency } from "./currency";
import { getPageInventoryEvidence } from "./indexedCounts";
import {
  type CoverageTarget,
  coverageInterval,
  coverageStateAsOf,
  coverageTarget,
  describeTarget,
  needsTargetReview,
  policyStatusAsOf,
  targetId,
} from "./insuranceCoverage";
import { type RegisterRow, registerRow } from "./registerProfiles";
import type { RegisterPage, RegisterScope } from "./registerSources";
import {
  APPRAISAL_PURPOSE_ORDER,
  appraisalExpiresAt,
  INSURANCE_APPRAISAL_MAX_AGE_MS,
  isWithinValuationAge,
  MAX_APPRAISALS_PER_OBJECT,
  selectCurrentValuations,
  VALUATION_MAX_AGE_MS,
} from "./valuation";

/** Objects read per valuation page; each reads at most 200 appraisals. */
const OBJECT_PAGE_SIZE = 25;

/**
 * The appraisal as it stood at as-of: a correction recorded after as-of had
 * not superseded it yet.
 */
function appraisalAsOf(appraisal: Doc<"appraisals">, asOf: number) {
  return appraisal.supersededAt !== undefined && appraisal.supersededAt > asOf
    ? { ...appraisal, supersededBy: undefined, supersededAt: undefined }
    : appraisal;
}

/**
 * The object's current valuations at as-of, by the shared rule: the latest
 * appraisal per purpose and currency that was recorded and not superseded by
 * as-of. Ordered by purpose, then currency.
 */
async function currentValuationsAsOf(
  ctx: QueryCtx,
  organizationId: Id<"organizations">,
  objectId: Id<"collections">,
  asOf: number,
) {
  const appraisals = await ctx.db
    .query("appraisals")
    .withIndex("by_collection_and_date", (q) => q.eq("collectionId", objectId))
    .order("desc")
    .take(MAX_APPRAISALS_PER_OBJECT + 1);
  if (appraisals.length > MAX_APPRAISALS_PER_OBJECT)
    throw new ConvexError(
      `Register appraisals exceed processing limits (${MAX_APPRAISALS_PER_OBJECT} per object)`,
    );
  const recorded = appraisals
    .filter(
      (appraisal) =>
        appraisal.organizationId === organizationId &&
        appraisal.createdAt <= asOf,
    )
    .map((appraisal) => appraisalAsOf(appraisal, asOf));
  const current = [...selectCurrentValuations(recorded).values()].sort(
    (left, right) =>
      APPRAISAL_PURPOSE_ORDER.indexOf(left.appraisalType) -
        APPRAISAL_PURPOSE_ORDER.indexOf(right.appraisalType) ||
      (left.currency < right.currency ? -1 : 1),
  );
  return { current, scanned: appraisals.length };
}

function validityAsOf(appraisal: Doc<"appraisals">, asOf: number) {
  if (appraisal.appraisalDate > asOf) return "future_dated";
  return isWithinValuationAge(appraisal, asOf, VALUATION_MAX_AGE_MS)
    ? "valid"
    : "renewal_due";
}

const UNVALUED_COLUMNS = [
  "value",
  "appraisalId",
  "appraisalDate",
  "appraiserName",
];

/** One page of the board valuation report: objects in catalogue order. */
export async function valuationPage(
  ctx: QueryCtx,
  scope: RegisterScope,
  cursor: string | null,
): Promise<RegisterPage> {
  const { organizationId, criteria, asOf } = scope;
  const objectId = criteria.objectId;
  const page = objectId
    ? {
        page: [await ctx.db.get(objectId)].filter(
          (object): object is Doc<"collections"> => object !== null,
        ),
        continueCursor: "",
        isDone: true,
      }
    : await ctx.db
        .query("collections")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", organizationId),
        )
        .paginate({ numItems: OBJECT_PAGE_SIZE, cursor });
  const objects = page.page.filter(
    (object) =>
      object.organizationId === organizationId && object._creationTime <= asOf,
  );
  const inventory = await getPageInventoryEvidence(
    ctx,
    organizationId,
    objects,
  );
  const rows: RegisterRow[] = [];
  let scanned = page.page.length;
  for (const object of objects) {
    const inventoryScope = classifyInventoryRecord({
      status: object.status,
      hasOpenDeaccession: inventory.openDeaccessionCollectionIds.has(
        object._id,
      ),
      linkedToIncomingLoan: inventory.inventoryLoanAssociations.incoming.has(
        object._id,
      ),
      linkedToOutgoingLoan: inventory.inventoryLoanAssociations.outgoing.has(
        object._id,
      ),
    });
    if (criteria.inventoryScope && inventoryScope !== criteria.inventoryScope)
      continue;
    const objectColumns = {
      objectId: object._id,
      objectAccessionNumber: object.accessionNumber,
      objectTitle: object.title,
      objectStatus: object.status,
      inventoryScope,
      capturedAt: scope.capturedAt,
    };
    const valuations = await currentValuationsAsOf(
      ctx,
      organizationId,
      object._id,
      asOf,
    );
    scanned += valuations.scanned;
    const matching = valuations.current.filter(
      (appraisal) =>
        (criteria.purpose === undefined ||
          appraisal.appraisalType === criteria.purpose) &&
        (criteria.currency === undefined ||
          normalizeCurrency(appraisal.currency) === criteria.currency),
    );
    if (matching.length === 0) {
      rows.push(
        registerRow(
          "valuation",
          {
            ...objectColumns,
            purpose: criteria.purpose ?? null,
            currency: criteria.currency ?? null,
            validityAsOf: "none",
            evidenceStatus: "recorded",
          },
          [
            ...(criteria.purpose ? [] : ["purpose"]),
            ...(criteria.currency ? [] : ["currency"]),
            ...UNVALUED_COLUMNS,
          ],
        ),
      );
      continue;
    }
    for (const appraisal of matching) {
      const currencyRecognized = normalizeCurrency(appraisal.currency) !== null;
      rows.push(
        registerRow(
          "valuation",
          {
            ...objectColumns,
            purpose: appraisal.appraisalType,
            currency: appraisal.currency,
            currencyRecognized,
            value: appraisal.value,
            validityAsOf: validityAsOf(appraisal, asOf),
            appraisalId: appraisal._id,
            appraisalDate: appraisal.appraisalDate,
            validUntil: appraisal.validUntil ?? null,
            renewalDueAt: appraisalExpiresAt(appraisal, VALUATION_MAX_AGE_MS),
            appraiserName: appraisal.appraiserName,
            appraiserCompany: appraisal.appraiserCompany ?? null,
            appraiserCredentials: appraisal.appraiserCredentials ?? null,
            supersedesAppraisalId: appraisal.supersedes ?? null,
            supersessionReason: appraisal.supersessionReason ?? null,
            recordedAt: appraisal.createdAt,
            evidenceStatus: currencyRecognized ? "recorded" : "legacy",
          },
          [],
        ),
      );
    }
  }
  return {
    rows,
    cursor: page.continueCursor,
    done: page.isDone,
    scanned,
  };
}

/** Coverages read per insurer schedule page. */
const COVERAGE_PAGE_SIZE = 25;
const POLICY_COLUMNS = [
  "policyNumber",
  "carrier",
  "policyType",
  "policyStatusAsOf",
  "policyEffectiveDate",
  "policyExpirationDate",
];
const TARGET_COLUMNS = [
  "targetKind",
  "targetId",
  "targetReference",
  "targetLabel",
];
const APPRAISAL_COLUMNS = [
  "appraisalId",
  "appraisalValue",
  "appraisalDate",
  "appraiserName",
];

/**
 * The current insurance valuation at as-of that supports an object coverage
 * in the coverage's currency, judged as `insurance.listCoverages` judges it
 * now.
 */
async function supportingValuationAsOf(
  ctx: QueryCtx,
  organizationId: Id<"organizations">,
  target: CoverageTarget | null,
  currency: string | null,
  asOf: number,
) {
  if (target?.kind !== "object")
    return { status: "not_applicable", appraisal: null, scanned: 0 } as const;
  if (currency === null)
    return {
      status: "currency_not_recorded",
      appraisal: null,
      scanned: 0,
    } as const;
  const { current, scanned } = await currentValuationsAsOf(
    ctx,
    organizationId,
    target.collectionId,
    asOf,
  );
  const appraisal =
    current.find(
      (candidate) =>
        candidate.appraisalType === "insurance" &&
        normalizeCurrency(candidate.currency) === currency,
    ) ?? null;
  if (!appraisal) return { status: "missing", appraisal, scanned } as const;
  const stale =
    appraisalExpiresAt(appraisal, INSURANCE_APPRAISAL_MAX_AGE_MS) < asOf;
  return { status: stale ? "stale" : "current", appraisal, scanned } as const;
}

/** One page of the insurer schedule: coverages in recording order. */
export async function insuranceSchedulePage(
  ctx: QueryCtx,
  scope: RegisterScope,
  cursor: string | null,
): Promise<RegisterPage> {
  const { organizationId, criteria, asOf } = scope;
  const opts = { numItems: COVERAGE_PAGE_SIZE, cursor };
  const policyId = criteria.policyId;
  const page = policyId
    ? await ctx.db
        .query("insuranceCoverages")
        .withIndex("by_policy", (q) => q.eq("policyId", policyId))
        .paginate(opts)
    : await ctx.db
        .query("insuranceCoverages")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", organizationId),
        )
        .paginate(opts);
  const policies = new Map<
    Id<"insurancePolicies">,
    Doc<"insurancePolicies"> | null
  >();
  const rows: RegisterRow[] = [];
  let scanned = page.page.length;
  for (const coverage of page.page) {
    if (coverage.organizationId !== organizationId || coverage.createdAt > asOf)
      continue;
    const currency = normalizeCurrency(coverage.currency);
    if (criteria.currency !== undefined && currency !== criteria.currency)
      continue;
    if (!policies.has(coverage.policyId)) {
      const policy = await ctx.db.get(coverage.policyId);
      policies.set(
        coverage.policyId,
        policy?.organizationId === organizationId ? policy : null,
      );
      scanned += 1;
    }
    const policy = policies.get(coverage.policyId) ?? null;
    const target = coverageTarget(coverage);
    const described = target ? await describeTarget(ctx, target) : null;
    const heldTarget =
      described?.organizationId === organizationId ? described : null;
    const support = await supportingValuationAsOf(
      ctx,
      organizationId,
      target,
      currency,
      asOf,
    );
    scanned += support.scanned;
    const interval = policy
      ? coverageInterval(coverage, policy)
      : { start: coverage.effectiveDate, end: coverage.expirationDate };
    const notRecorded: string[] = [];
    if (!policy) notRecorded.push(...POLICY_COLUMNS);
    if (!target) notRecorded.push(...TARGET_COLUMNS);
    else if (!heldTarget) notRecorded.push("targetReference", "targetLabel");
    if (currency === null) notRecorded.push("currency");
    if (interval.start === undefined) notRecorded.push("coverageStart");
    if (interval.end === undefined) notRecorded.push("coverageEnd");
    if (support.status === "missing" || support.status === "currency_not_recorded")
      notRecorded.push(...APPRAISAL_COLUMNS);
    rows.push(
      registerRow(
        "insurance",
        {
          coverageId: coverage._id,
          policyId: coverage.policyId,
          policyNumber: policy?.policyNumber ?? null,
          carrier: policy?.carrier ?? null,
          policyType: policy?.policyType ?? null,
          policyStatusAsOf: policy ? policyStatusAsOf(policy, asOf) : null,
          policyEffectiveDate: policy?.effectiveDate ?? null,
          policyExpirationDate: policy?.expirationDate ?? null,
          targetKind: target?.kind ?? null,
          targetId: target ? targetId(target) : null,
          targetReference: heldTarget?.reference ?? null,
          targetLabel: heldTarget?.label ?? null,
          coveredValue: coverage.coveredValue,
          currency: coverage.currency ?? null,
          currencyRecognized: currency !== null,
          coverageStart: interval.start ?? null,
          coverageEnd: interval.end ?? null,
          stateAsOf: coverageStateAsOf(coverage, policy, asOf),
          appraisalStatusAsOf: support.status,
          appraisalId: support.appraisal?._id ?? null,
          appraisalValue: support.appraisal?.value ?? null,
          appraisalDate: support.appraisal?.appraisalDate ?? null,
          appraiserName: support.appraisal?.appraiserName ?? null,
          recordedAt: coverage.createdAt,
          evidenceStatus:
            currency === null || needsTargetReview(coverage)
              ? "legacy"
              : "recorded",
          capturedAt: scope.capturedAt,
        },
        notRecorded,
      ),
    );
  }
  return {
    rows,
    cursor: page.continueCursor,
    done: page.isDone,
    scanned,
  };
}
