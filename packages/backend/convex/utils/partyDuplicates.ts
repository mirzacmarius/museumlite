import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import {
  normalizePartyEmail,
  normalizePartyName,
  normalizePartyPhone,
  partyIdentityKeys,
} from "./parties";
import type { DuplicateReason } from "./partyValidators";

/** Most recent parties compared by one duplicate scan. */
export const DUPLICATE_SCAN_ACCOUNT_LIMIT = 500;
/** New review rows one scan may add; rerun the scan for more. */
export const DUPLICATE_SCAN_NEW_REVIEW_LIMIT = 50;
/** Parties sharing one key that are paired with each other. */
const SAME_KEY_PAIR_LIMIT = 10;
const CANDIDATE_LOOKUP_LIMIT = 20;

export interface DuplicatePair {
  firstAccountId: Id<"accounts">;
  secondAccountId: Id<"accounts">;
  pairKey: string;
  reasons: DuplicateReason[];
}

const REASON_ORDER: readonly DuplicateReason[] = ["name", "email", "phone"];

export function orderedPair(a: Id<"accounts">, b: Id<"accounts">) {
  const [firstAccountId, secondAccountId] = a < b ? [a, b] : [b, a];
  return {
    firstAccountId,
    secondAccountId,
    pairKey: `${firstAccountId}:${secondAccountId}`,
  };
}

/** Pairs of accounts that share a normalized name, email or phone. */
export function findDuplicatePairs(
  accounts: ReadonlyArray<Doc<"accounts">>,
): DuplicatePair[] {
  const groups = new Map<
    string,
    { reason: DuplicateReason; members: Set<Id<"accounts">> }
  >();
  for (const account of accounts) {
    for (const { reason, key } of partyIdentityKeys(account)) {
      const groupKey = `${reason}\u0000${key}`;
      const group = groups.get(groupKey) ?? { reason, members: new Set() };
      if (group.members.size < SAME_KEY_PAIR_LIMIT)
        group.members.add(account._id);
      groups.set(groupKey, group);
    }
  }
  const pairs = new Map<
    string,
    Omit<DuplicatePair, "reasons"> & { reasons: Set<DuplicateReason> }
  >();
  for (const { reason, members } of groups.values()) {
    const ids = Array.from(members);
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const left = ids[i];
        const right = ids[j];
        if (!left || !right) continue;
        const ordered = orderedPair(left, right);
        const pair = pairs.get(ordered.pairKey) ?? {
          ...ordered,
          reasons: new Set<DuplicateReason>(),
        };
        pair.reasons.add(reason);
        pairs.set(ordered.pairKey, pair);
      }
    }
  }
  return Array.from(pairs.values(), (pair) => ({
    ...pair,
    reasons: REASON_ORDER.filter((reason) => pair.reasons.has(reason)),
  }));
}

/**
 * Existing parties whose name or email may match the given details. Uses the
 * name search indexes and the email index, so it stays bounded.
 */
export async function findPartyCandidates(
  ctx: QueryCtx | MutationCtx,
  organizationId: Id<"organizations">,
  details: { name: string; email?: string },
): Promise<Doc<"accounts">[]> {
  const name = details.name.trim();
  const byId = new Map<Id<"accounts">, Doc<"accounts">>();
  if (name) {
    const [byBusinessName, byLastName] = await Promise.all([
      ctx.db
        .query("accounts")
        .withSearchIndex("search_accounts", (q) =>
          q.search("businessName", name).eq("organizationId", organizationId),
        )
        .take(CANDIDATE_LOOKUP_LIMIT),
      ctx.db
        .query("accounts")
        .withSearchIndex("search_accounts_by_name", (q) =>
          q.search("lastName", name).eq("organizationId", organizationId),
        )
        .take(CANDIDATE_LOOKUP_LIMIT),
    ]);
    for (const account of [...byBusinessName, ...byLastName])
      byId.set(account._id, account);
  }
  const email = details.email?.trim();
  if (email) {
    const variants = Array.from(new Set([email, email.toLowerCase()]));
    for (const variant of variants) {
      const matches = await ctx.db
        .query("accounts")
        .withIndex("by_email", (q) => q.eq("email", variant))
        .take(CANDIDATE_LOOKUP_LIMIT);
      for (const account of matches)
        if (account.organizationId === organizationId)
          byId.set(account._id, account);
    }
  }
  return Array.from(byId.values());
}

/** Reasons a candidate matches the given details; empty when it does not. */
export function duplicateReasonsFor(
  details: { name: string; email?: string; phone?: string },
  candidate: Doc<"accounts">,
): DuplicateReason[] {
  const keys = partyIdentityKeys(candidate);
  const wanted: Array<{ reason: DuplicateReason; key: string | undefined }> = [
    { reason: "name", key: normalizePartyName(details.name) },
    { reason: "email", key: normalizePartyEmail(details.email) },
    { reason: "phone", key: normalizePartyPhone(details.phone) },
  ];
  return wanted.flatMap(({ reason, key }) =>
    key && keys.some((entry) => entry.reason === reason && entry.key === key)
      ? [reason]
      : [],
  );
}

/**
 * Stores pending reviews for pairs that have never been suggested. A pair
 * with any review (pending, dismissed or confirmed distinct) is not
 * suggested again.
 */
export async function recordDuplicateSuggestions(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
  pairs: ReadonlyArray<DuplicatePair>,
  userId: Id<"users"> | undefined,
  limit: number,
): Promise<number> {
  let created = 0;
  const now = Date.now();
  for (const pair of pairs) {
    if (created >= limit) break;
    const existing = await ctx.db
      .query("partyDuplicateReviews")
      .withIndex("by_organization_and_pairKey", (q) =>
        q.eq("organizationId", organizationId).eq("pairKey", pair.pairKey),
      )
      .first();
    if (existing) continue;
    await ctx.db.insert("partyDuplicateReviews", {
      organizationId,
      firstAccountId: pair.firstAccountId,
      secondAccountId: pair.secondAccountId,
      pairKey: pair.pairKey,
      reasons: pair.reasons,
      status: "pending",
      suggestedAt: now,
      suggestedBy: userId,
    });
    created++;
  }
  return created;
}
