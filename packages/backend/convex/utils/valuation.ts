import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { currencyGroupKey, normalizeCurrency } from "./currency";

/**
 * Valuation rules shared by appraisals, disposal decisions and insurance.
 *
 * An appraisal records a value for one purpose (`appraisalType`) in one
 * currency. The current valuation for an object, purpose and currency is the
 * latest appraisal that has not been superseded. Values are never converted
 * between currencies, so an object can have one current valuation per
 * purpose and currency. Recorded values are immutable: a correction is a new
 * appraisal that supersedes the old one, which stays in the history.
 */

export const VALUATION_PERMISSION = "collections.view_valuation";

export const appraisalPurposeValidator = v.union(
  v.literal("insurance"),
  v.literal("market"),
  v.literal("fair_market"),
  v.literal("replacement"),
  v.literal("liquidation"),
);

export type AppraisalPurpose = Doc<"appraisals">["appraisalType"];

export const APPRAISAL_PURPOSE_ORDER: readonly AppraisalPurpose[] = [
  "insurance",
  "replacement",
  "market",
  "fair_market",
  "liquidation",
];

export const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Valuations older than two years are due for renewal. Disposal decisions
 * that require a valuation accept only one within this age (see
 * `disposalPolicy.ts`).
 */
export const VALUATION_MAX_AGE_MS = 730 * DAY_MS;

/** Insurance appraisals older than three years no longer support coverage. */
export const INSURANCE_APPRAISAL_MAX_AGE_MS = 1095 * DAY_MS;

/** Appraisals read per object, newest appraisal date first. */
export const MAX_APPRAISALS_PER_OBJECT = 200;

type ReadCtx = Pick<QueryCtx, "db">;

export function valuationGroupKey(
  appraisal: Pick<Doc<"appraisals">, "appraisalType" | "currency">,
) {
  return `${appraisal.appraisalType}|${currencyGroupKey(appraisal.currency)}`;
}

function isLater(a: Doc<"appraisals">, b: Doc<"appraisals">) {
  if (a.appraisalDate !== b.appraisalDate) {
    return a.appraisalDate > b.appraisalDate;
  }
  return a._creationTime > b._creationTime;
}

/**
 * The current valuation per purpose and currency among one object's
 * appraisals, keyed by `valuationGroupKey`.
 */
export function selectCurrentValuations(appraisals: Doc<"appraisals">[]) {
  const current = new Map<string, Doc<"appraisals">>();
  for (const appraisal of appraisals) {
    if (appraisal.supersededBy !== undefined) continue;
    const key = valuationGroupKey(appraisal);
    const existing = current.get(key);
    if (!existing || isLater(appraisal, existing)) {
      current.set(key, appraisal);
    }
  }
  return current;
}

export async function loadObjectAppraisals(
  ctx: ReadCtx,
  collectionId: Id<"collections">,
) {
  return await ctx.db
    .query("appraisals")
    .withIndex("by_collection_and_date", (q) =>
      q.eq("collectionId", collectionId),
    )
    .order("desc")
    .take(MAX_APPRAISALS_PER_OBJECT);
}

/**
 * The current valuation of an object for one purpose. With a currency, only
 * that currency's valuation qualifies; without one, the most recent current
 * valuation for the purpose in any currency is returned.
 */
export async function currentValuationFor(
  ctx: ReadCtx,
  collectionId: Id<"collections">,
  purpose: AppraisalPurpose,
  currency?: string,
) {
  const appraisals = await loadObjectAppraisals(ctx, collectionId);
  const currencyKey =
    currency === undefined ? undefined : currencyGroupKey(currency);
  let best: Doc<"appraisals"> | null = null;
  for (const appraisal of selectCurrentValuations(appraisals).values()) {
    if (appraisal.appraisalType !== purpose) continue;
    if (
      currencyKey !== undefined &&
      currencyGroupKey(appraisal.currency) !== currencyKey
    ) {
      continue;
    }
    if (!best || isLater(appraisal, best)) best = appraisal;
  }
  return best;
}

/** When the appraisal stops supporting the purpose: its age limit or `validUntil`, whichever is first. */
export function appraisalExpiresAt(
  appraisal: Pick<Doc<"appraisals">, "appraisalDate" | "validUntil">,
  maxAgeMs: number,
) {
  const byAge = appraisal.appraisalDate + maxAgeMs;
  return appraisal.validUntil === undefined
    ? byAge
    : Math.min(byAge, appraisal.validUntil);
}

export function appraisalAgeDays(
  appraisal: Pick<Doc<"appraisals">, "appraisalDate">,
  now: number,
) {
  return Math.floor((now - appraisal.appraisalDate) / DAY_MS);
}

/** Dated on or before `now` and not past its age limit or `validUntil`. */
export function isWithinValuationAge(
  appraisal: Pick<Doc<"appraisals">, "appraisalDate" | "validUntil">,
  now: number,
  maxAgeMs: number,
) {
  return (
    appraisal.appraisalDate <= now &&
    now <= appraisalExpiresAt(appraisal, maxAgeMs)
  );
}

/**
 * Keeps the stored `isCurrentValuation` flag, which organization-wide
 * projections read, in step with the rule above for one object.
 */
export async function refreshCurrentValuationFlags(
  ctx: Pick<MutationCtx, "db">,
  collectionId: Id<"collections">,
) {
  const appraisals = await loadObjectAppraisals(ctx, collectionId);
  const current = new Set(
    [...selectCurrentValuations(appraisals).values()].map(
      (appraisal) => appraisal._id,
    ),
  );
  for (const appraisal of appraisals) {
    const isCurrent = current.has(appraisal._id);
    if (appraisal.isCurrentValuation !== isCurrent) {
      await ctx.db.patch(appraisal._id, { isCurrentValuation: isCurrent });
    }
  }
}

export const appraisalViewValidator = v.object({
  _id: v.id("appraisals"),
  collectionId: v.id("collections"),
  purpose: appraisalPurposeValidator,
  appraisalDate: v.number(),
  appraiserName: v.string(),
  appraiserCompany: v.optional(v.string()),
  appraiserCredentials: v.optional(v.string()),
  value: v.number(),
  currency: v.string(),
  currencyRecognized: v.boolean(),
  notes: v.optional(v.string()),
  validUntil: v.optional(v.number()),
  createdAt: v.number(),
  isCurrent: v.boolean(),
  supersedes: v.optional(v.id("appraisals")),
  supersessionReason: v.optional(v.string()),
  supersededBy: v.optional(v.id("appraisals")),
  supersededAt: v.optional(v.number()),
  ageDays: v.number(),
  /** Within the two-year valuation age and any `validUntil`. */
  isWithinValuationAge: v.boolean(),
  renewalDueAt: v.number(),
});

export function toAppraisalView(
  appraisal: Doc<"appraisals">,
  isCurrent: boolean,
  now: number,
) {
  return {
    _id: appraisal._id,
    collectionId: appraisal.collectionId,
    purpose: appraisal.appraisalType,
    appraisalDate: appraisal.appraisalDate,
    appraiserName: appraisal.appraiserName,
    appraiserCompany: appraisal.appraiserCompany,
    appraiserCredentials: appraisal.appraiserCredentials,
    value: appraisal.value,
    currency: appraisal.currency,
    currencyRecognized: normalizeCurrency(appraisal.currency) !== null,
    notes: appraisal.notes,
    validUntil: appraisal.validUntil,
    createdAt: appraisal.createdAt,
    isCurrent,
    supersedes: appraisal.supersedes,
    supersessionReason: appraisal.supersessionReason,
    supersededBy: appraisal.supersededBy,
    supersededAt: appraisal.supersededAt,
    ageDays: appraisalAgeDays(appraisal, now),
    isWithinValuationAge: isWithinValuationAge(
      appraisal,
      now,
      VALUATION_MAX_AGE_MS,
    ),
    renewalDueAt: appraisalExpiresAt(appraisal, VALUATION_MAX_AGE_MS),
  };
}
