import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { type QueryCtx, query } from "./_generated/server";
import { buildAccountCreateDocument } from "./utils/accountProfile";
import { requireModuleEnabled } from "./utils/featureGates";
import { mutation } from "./utils/mutationBuilders";
import { generateNextAccountNumber } from "./utils/numberGenerator";
import { toPartySummary } from "./utils/parties";
import {
  duplicateReasonsFor,
  findPartyCandidates,
  orderedPair,
  recordDuplicateSuggestions,
} from "./utils/partyDuplicates";
import { partyError } from "./utils/partyErrors";
import {
  type DuplicateReason,
  duplicateReasonValidator,
  type PartySummary,
  partySummaryValidator,
} from "./utils/partyValidators";
import { requirePermission } from "./utils/permissions";

const DEFAULT_SEARCH_LIMIT = 20;
const MAX_SEARCH_LIMIT = 50;
const RECENT_SCAN_LIMIT = 100;
const SIMILAR_PARTY_LIMIT = 10;
/** Pending reviews one party creation may add. */
const CREATE_DUPLICATE_REVIEW_LIMIT = 10;

async function requirePartyReader(
  ctx: QueryCtx,
  organizationId: Id<"organizations">,
) {
  await requireModuleEnabled(ctx, organizationId, "accounts");
  await requirePermission(ctx, organizationId, "accounts.read");
}

/**
 * Picker search over people and institutions. Uses the name search indexes
 * and the account number index, so older parties are found too. Archived
 * parties are left out because they cannot be linked.
 */
export const search = query({
  args: {
    organizationId: v.id("organizations"),
    search: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  returns: v.array(partySummaryValidator),
  handler: async (ctx, args) => {
    await requirePartyReader(ctx, args.organizationId);
    const limit = Math.min(
      MAX_SEARCH_LIMIT,
      Math.max(1, Math.floor(args.limit ?? DEFAULT_SEARCH_LIMIT)),
    );
    const term = args.search?.trim() ?? "";
    let matches: Doc<"accounts">[];
    if (!term) {
      matches = await ctx.db
        .query("accounts")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", args.organizationId),
        )
        .order("desc")
        .take(RECENT_SCAN_LIMIT);
    } else {
      const [byNumber, byBusinessName, byLastName] = await Promise.all([
        ctx.db
          .query("accounts")
          .withIndex("by_organization_and_accountNumber", (q) =>
            q
              .eq("organizationId", args.organizationId)
              .eq("accountNumber", term.toUpperCase()),
          )
          .take(1),
        ctx.db
          .query("accounts")
          .withSearchIndex("search_accounts", (q) =>
            q
              .search("businessName", term)
              .eq("organizationId", args.organizationId),
          )
          .take(limit * 2),
        ctx.db
          .query("accounts")
          .withSearchIndex("search_accounts_by_name", (q) =>
            q
              .search("lastName", term)
              .eq("organizationId", args.organizationId),
          )
          .take(limit * 2),
      ]);
      matches = [...byNumber, ...byBusinessName, ...byLastName];
    }
    const seen = new Set<Id<"accounts">>();
    const results: PartySummary[] = [];
    for (const account of matches) {
      if (seen.has(account._id) || account.status === "archived") continue;
      seen.add(account._id);
      results.push(toPartySummary(account));
      if (results.length >= limit) break;
    }
    return results;
  },
});

/** The selected party, so pickers can show it without searching for it. */
export const get = query({
  args: { accountId: v.id("accounts") },
  returns: v.union(partySummaryValidator, v.null()),
  handler: async (ctx, args) => {
    const account = await ctx.db.get(args.accountId);
    if (!account) return null;
    await requirePartyReader(ctx, account.organizationId);
    return toPartySummary(account);
  },
});

/**
 * Existing parties whose normalized name or email matches, so staff can
 * reuse one instead of creating a duplicate.
 */
export const findSimilar = query({
  args: {
    organizationId: v.id("organizations"),
    name: v.string(),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
  },
  returns: v.array(
    v.object({
      party: partySummaryValidator,
      reasons: v.array(duplicateReasonValidator),
    }),
  ),
  handler: async (ctx, args) => {
    await requirePartyReader(ctx, args.organizationId);
    const candidates = await findPartyCandidates(ctx, args.organizationId, {
      name: args.name,
      email: args.email,
    });
    const similar: Array<{
      party: PartySummary;
      reasons: DuplicateReason[];
    }> = [];
    for (const candidate of candidates) {
      const reasons = duplicateReasonsFor(args, candidate);
      if (reasons.length > 0)
        similar.push({ party: toPartySummary(candidate), reasons });
      if (similar.length >= SIMILAR_PARTY_LIMIT) break;
    }
    return similar;
  },
});

/**
 * Creates a person or institution from a procedure picker. Policy: staff who
 * may write accounts (`accounts.write`, held by Collection Managers) may add
 * a party here; editing, archiving and deleting non-patron accounts stays
 * with administrators (`organization.manage_settings`). Possible duplicates
 * are recorded for review, never merged.
 */
export const create = mutation({
  args: {
    organizationId: v.id("organizations"),
    holderType: v.union(v.literal("organization"), v.literal("privatePerson")),
    name: v.string(),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    taxId: v.optional(v.string()),
    dateOfBirth: v.optional(v.number()),
    address: v.optional(v.string()),
    address2: v.optional(v.string()),
    zipCode: v.optional(v.string()),
    city: v.optional(v.string()),
    country: v.optional(v.string()),
    contactPerson: v.optional(v.string()),
    contactPhone: v.optional(v.string()),
    contactEmail: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  returns: v.object({
    accountId: v.id("accounts"),
    duplicateSuggestions: v.number(),
  }),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    await requireModuleEnabled(ctx, args.organizationId, "accounts");
    await requirePermission(ctx, args.organizationId, "accounts.write");
    const name = args.name.trim();
    if (!name) {
      throw partyError("PARTY_NAME_REQUIRED", "A party name is required");
    }
    const isOrganization = args.holderType === "organization";
    const accountNumber = await generateNextAccountNumber(
      ctx,
      args.organizationId,
    );
    const accountId = await ctx.db.insert(
      "accounts",
      buildAccountCreateDocument(
        {
          organizationId: args.organizationId,
          accountType: "institution",
          holderType: args.holderType,
          businessName: name,
          taxId: isOrganization ? args.taxId : undefined,
          dateOfBirth: isOrganization ? undefined : args.dateOfBirth,
          email: args.email,
          phone: args.phone,
          address: args.address,
          address2: args.address2,
          zipCode: args.zipCode,
          city: args.city,
          country: args.country,
          contactPerson: isOrganization ? args.contactPerson : undefined,
          contactPhone: isOrganization ? args.contactPhone : undefined,
          contactEmail: isOrganization ? args.contactEmail : undefined,
          notes: args.notes,
        },
        { accountNumber, createdBy: userId, createdAt: Date.now() },
      ),
    );

    const candidates = await findPartyCandidates(ctx, args.organizationId, {
      name,
      email: args.email,
    });
    const pairs = candidates.flatMap((candidate) => {
      if (candidate._id === accountId) return [];
      const reasons = duplicateReasonsFor(
        { name, email: args.email, phone: args.phone },
        candidate,
      );
      return reasons.length > 0
        ? [{ ...orderedPair(accountId, candidate._id), reasons }]
        : [];
    });
    const duplicateSuggestions = await recordDuplicateSuggestions(
      ctx,
      args.organizationId,
      pairs,
      userId,
      CREATE_DUPLICATE_REVIEW_LIMIT,
    );

    await ctx.runMutation(internal.audit.logAction, {
      organizationId: args.organizationId,
      userId,
      action: "created_account",
      entityType: "account",
      entityId: accountId,
      changes: {
        accountType: "institution",
        holderType: args.holderType,
        accountNumber,
        businessName: name,
        createdFrom: "party_picker",
        duplicateSuggestions,
      },
    });

    return { accountId, duplicateSuggestions };
  },
});
