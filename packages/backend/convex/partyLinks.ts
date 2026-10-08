import { getAuthUserId } from "@convex-dev/auth/server";
import {
  paginationOptsValidator,
  paginationResultValidator,
} from "convex/server";
import { type Infer, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { type MutationCtx, type QueryCtx, query } from "./_generated/server";
import { requireModuleEnabled } from "./utils/featureGates";
import { requireLoansAccess } from "./utils/loanAccess";
import { internalMutation, mutation } from "./utils/mutationBuilders";
import {
  partyDisplayName,
  requireLinkableParty,
  toPartySummary,
} from "./utils/parties";
import { partyError } from "./utils/partyErrors";
import {
  accessionSourceAssertion,
  hasCurrentPartyLink,
  partyLinksForTarget,
  partyTargetOf,
  readablePartyTargetLabel,
  recordPartyLink,
  resolvePartyTarget,
} from "./utils/partyLinks";
import {
  type PartyRole,
  type PartySummary,
  type PartyTarget,
  partyRoleValidator,
  partySummaryValidator,
  partyTargetIdValidator,
  partyTargetTypeValidator,
  partyTargetValidator,
} from "./utils/partyValidators";
import { requirePermission } from "./utils/permissions";

const linkOriginValidator = v.union(v.literal("staff"), v.literal("backfill"));

const partyLinkViewValidator = v.object({
  _id: v.id("partyLinks"),
  role: partyRoleValidator,
  accountId: v.id("accounts"),
  /** The Party's current name; null when the account is no longer available. */
  partyName: v.union(v.string(), v.null()),
  partyArchived: v.boolean(),
  nameSnapshot: v.string(),
  assertedName: v.optional(v.string()),
  contactSnapshot: v.optional(v.string()),
  effectiveFrom: v.number(),
  effectiveTo: v.optional(v.number()),
  origin: linkOriginValidator,
  createdAt: v.number(),
  createdByName: v.optional(v.string()),
  supersededAt: v.optional(v.number()),
  supersessionReason: v.optional(v.string()),
  isCurrent: v.boolean(),
});

const roleHistoryItemValidator = v.object({
  _id: v.id("partyLinks"),
  role: partyRoleValidator,
  targetType: partyTargetTypeValidator,
  targetId: partyTargetIdValidator,
  /** Null when the caller may not read the linked record. */
  targetLabel: v.union(v.string(), v.null()),
  nameSnapshot: v.string(),
  assertedName: v.optional(v.string()),
  contactSnapshot: v.optional(v.string()),
  effectiveFrom: v.number(),
  effectiveTo: v.optional(v.number()),
  origin: linkOriginValidator,
  createdAt: v.number(),
  supersededAt: v.optional(v.number()),
  supersessionReason: v.optional(v.string()),
  isCurrent: v.boolean(),
});

async function requirePartyReader(
  ctx: QueryCtx,
  organizationId: Doc<"organizations">["_id"],
) {
  await requireModuleEnabled(ctx, organizationId, "accounts");
  await requirePermission(ctx, organizationId, "accounts.read");
}

/**
 * Parties linked to a procedure record: current roles first, then superseded
 * links with their original name and contact snapshots.
 */
export const listForTarget = query({
  args: { target: partyTargetValidator },
  returns: v.array(partyLinkViewValidator),
  handler: async (ctx, args) => {
    const resolved = await resolvePartyTarget(ctx, args.target, "read");
    await requirePartyReader(ctx, resolved.organizationId);
    const links = await partyLinksForTarget(
      ctx,
      resolved.organizationId,
      args.target,
    );
    const views = await Promise.all(
      links.map(async (link) => {
        const [account, creator] = await Promise.all([
          ctx.db.get(link.accountId),
          link.createdBy ? ctx.db.get(link.createdBy) : null,
        ]);
        const sameTenant = account?.organizationId === link.organizationId;
        return {
          _id: link._id,
          role: link.role,
          accountId: link.accountId,
          partyName: account && sameTenant ? partyDisplayName(account) : null,
          partyArchived: sameTenant && account?.status === "archived",
          nameSnapshot: link.nameSnapshot,
          assertedName: link.assertedName,
          contactSnapshot: link.contactSnapshot,
          effectiveFrom: link.effectiveFrom,
          effectiveTo: link.effectiveTo,
          origin: link.origin,
          createdAt: link.createdAt,
          createdByName: creator?.name ?? undefined,
          supersededAt: link.supersededAt,
          supersessionReason: link.supersessionReason,
          isCurrent: link.supersededAt === undefined,
        };
      }),
    );
    return views.sort(
      (left, right) =>
        Number(right.isCurrent) - Number(left.isCurrent) ||
        right.createdAt - left.createdAt,
    );
  },
});

/** Role history of one Party across procedures, newest first. */
export const listForAccount = query({
  args: {
    accountId: v.id("accounts"),
    paginationOpts: paginationOptsValidator,
  },
  returns: paginationResultValidator(roleHistoryItemValidator),
  handler: async (ctx, args) => {
    const account = await ctx.db.get(args.accountId);
    if (!account) {
      throw partyError("PARTY_NOT_FOUND", "Party not found");
    }
    await requirePartyReader(ctx, account.organizationId);
    const result = await ctx.db
      .query("partyLinks")
      .withIndex("by_account", (q) => q.eq("accountId", args.accountId))
      .order("desc")
      .paginate(args.paginationOpts);
    const page = await Promise.all(
      result.page
        .filter((link) => link.organizationId === account.organizationId)
        .map(async (link) => ({
          _id: link._id,
          role: link.role,
          targetType: link.targetType,
          targetId: link.targetId,
          targetLabel: await readablePartyTargetLabel(ctx, link),
          nameSnapshot: link.nameSnapshot,
          assertedName: link.assertedName,
          contactSnapshot: link.contactSnapshot,
          effectiveFrom: link.effectiveFrom,
          effectiveTo: link.effectiveTo,
          origin: link.origin,
          createdAt: link.createdAt,
          supersededAt: link.supersededAt,
          supersessionReason: link.supersessionReason,
          isCurrent: link.supersededAt === undefined,
        })),
    );
    return { ...result, page };
  },
});

/**
 * Links a Party to a procedure record in a contextual role. Requires the
 * record's own write permission and `accounts.read`; the Party must belong
 * to the record's organization, be active, and fit the role. A different
 * current Party in that role is superseded, never deleted.
 */
export const link = mutation({
  args: {
    target: partyTargetValidator,
    accountId: v.id("accounts"),
    role: partyRoleValidator,
    effectiveFrom: v.optional(v.number()),
    effectiveTo: v.optional(v.number()),
    assertedName: v.optional(v.string()),
    reason: v.optional(v.string()),
  },
  returns: v.id("partyLinks"),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    const resolved = await resolvePartyTarget(ctx, args.target, "write");
    const account = await requireLinkableParty(
      ctx,
      resolved.organizationId,
      args.accountId,
    );
    const { linkId } = await recordPartyLink(ctx, {
      organizationId: resolved.organizationId,
      target: args.target,
      account,
      role: args.role,
      allowedRoles: resolved.allowedRoles,
      effectiveFrom:
        args.effectiveFrom ?? resolved.defaultEffectiveFrom ?? Date.now(),
      effectiveTo: args.effectiveTo,
      assertedName: args.assertedName,
      supersessionReason: args.reason,
      userId,
      origin: "staff",
    });
    return linkId;
  },
});

/**
 * Ends a current link without naming a replacement. The link and its
 * snapshots stay in the record's history.
 */
export const supersede = mutation({
  args: {
    linkId: v.id("partyLinks"),
    reason: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    const existing = await ctx.db.get(args.linkId);
    if (!existing) {
      throw partyError("PARTY_LINK_NOT_FOUND", "Party link not found");
    }
    const resolved = await resolvePartyTarget(
      ctx,
      partyTargetOf(existing),
      "write",
    );
    if (resolved.organizationId !== existing.organizationId) {
      throw partyError("PARTY_LINK_NOT_FOUND", "Party link not found");
    }
    await requireModuleEnabled(ctx, existing.organizationId, "accounts");
    await requirePermission(ctx, existing.organizationId, "accounts.read");
    if (existing.supersededAt !== undefined) {
      throw partyError(
        "PARTY_LINK_ALREADY_SUPERSEDED",
        "This party link has already been superseded",
      );
    }
    const reason = args.reason.trim();
    await ctx.db.patch(existing._id, {
      supersededAt: Date.now(),
      supersededBy: userId,
      supersessionReason: reason || undefined,
    });
    await ctx.runMutation(internal.audit.logAction, {
      organizationId: existing.organizationId,
      userId,
      action: "party_link_ended",
      entityType: existing.targetType,
      entityId: existing.targetId,
      changes: {
        role: existing.role,
        accountId: existing.accountId,
        linkId: existing._id,
        reason: reason || undefined,
      },
    });
    return null;
  },
});

const LEGACY_REVIEW_PAGE_LIMIT = 50;
const BACKFILL_BATCH_LIMIT = 100;

const legacyKindValidator = v.union(
  v.literal("accession"),
  v.literal("loan"),
  v.literal("deaccession"),
);

const legacyLinkItemValidator = v.object({
  targetType: legacyKindValidator,
  targetId: partyTargetIdValidator,
  label: v.string(),
  /** The name as written on the record. */
  assertedName: v.optional(v.string()),
  contact: v.optional(v.string()),
  date: v.number(),
  suggestedRole: partyRoleValidator,
  /** An account the record already references but has no typed link to. */
  existingParty: v.union(partySummaryValidator, v.null()),
});

interface LegacyCandidate {
  target: PartyTarget;
  label: string;
  assertedName?: string;
  contact?: string;
  date: number;
  roles: PartyRole[];
  existingAccountId?: Id<"accounts">;
}

async function legacyLinkItem(
  ctx: QueryCtx,
  organizationId: Id<"organizations">,
  candidate: LegacyCandidate,
) {
  const [suggestedRole] = candidate.roles;
  if (!suggestedRole) return null;
  if (!candidate.assertedName && !candidate.existingAccountId) return null;
  if (
    await hasCurrentPartyLink(
      ctx,
      organizationId,
      candidate.target,
      candidate.roles,
    )
  ) {
    return null;
  }
  let existingParty: PartySummary | null = null;
  if (candidate.existingAccountId) {
    const account = await ctx.db.get(candidate.existingAccountId);
    if (account?.organizationId === organizationId) {
      existingParty = toPartySummary(account);
    }
  }
  return {
    targetType: candidate.target.type as "accession" | "loan" | "deaccession",
    targetId: candidate.target.id,
    label: candidate.label,
    assertedName: candidate.assertedName,
    contact: candidate.contact,
    date: candidate.date,
    suggestedRole,
    existingParty,
  };
}

function loanRoles(loan: Doc<"loans">): PartyRole[] {
  return loan.type === "incoming" ? ["lender", "owner"] : ["borrower"];
}

/**
 * Records that name a party only in free text, or reference an account
 * without a typed link. Staff confirm each link; nothing is linked
 * automatically.
 */
export const listLegacyLinks = query({
  args: {
    organizationId: v.id("organizations"),
    kind: legacyKindValidator,
    paginationOpts: paginationOptsValidator,
  },
  returns: v.object({
    items: v.array(legacyLinkItemValidator),
    checkedCount: v.number(),
    isDone: v.boolean(),
    continueCursor: v.string(),
  }),
  handler: async (ctx, args) => {
    await requirePartyReader(ctx, args.organizationId);
    if (args.kind === "loan") {
      await requireLoansAccess(ctx, args.organizationId);
      await requirePermission(ctx, args.organizationId, "loans.read");
    } else {
      await requirePermission(ctx, args.organizationId, "collections.read");
    }
    const paginationOpts = {
      ...args.paginationOpts,
      numItems: Math.min(
        LEGACY_REVIEW_PAGE_LIMIT,
        Math.max(1, args.paginationOpts.numItems),
      ),
    };
    let candidates: LegacyCandidate[];
    let page: { isDone: boolean; continueCursor: string; checked: number };
    if (args.kind === "accession") {
      const result = await ctx.db
        .query("accessions")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", args.organizationId),
        )
        .paginate(paginationOpts);
      candidates = result.page.map((accession) => ({
        target: { type: "accession", id: accession._id },
        label: accession.accessionNumber,
        assertedName: accessionSourceAssertion(accession.source),
        date: accession.dateReceived,
        roles: ["donor", "owner"],
        existingAccountId: accession.donorAccountId,
      }));
      page = { ...result, checked: result.page.length };
    } else if (args.kind === "loan") {
      const result = await ctx.db
        .query("loans")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", args.organizationId),
        )
        .paginate(paginationOpts);
      candidates = result.page.map((loan) => ({
        target: { type: "loan", id: loan._id },
        label: loan.loanNumber,
        assertedName: loan.lenderBorrowerName.trim() || undefined,
        contact: loan.lenderBorrowerContact?.trim() || undefined,
        date: loan.startDate,
        roles: loanRoles(loan),
        existingAccountId: loan.accountId,
      }));
      page = { ...result, checked: result.page.length };
    } else {
      const result = await ctx.db
        .query("deaccessions")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", args.organizationId),
        )
        .paginate(paginationOpts);
      candidates = result.page.flatMap((deaccession) =>
        deaccession.exitRecord
          ? [
              {
                target: {
                  type: "deaccession" as const,
                  id: deaccession._id,
                },
                label: deaccession.deaccessionNumber,
                assertedName: deaccession.exitRecord.recipient,
                date: deaccession.exitRecord.exitDate,
                roles: ["recipient" as const],
              },
            ]
          : [],
      );
      page = { ...result, checked: result.page.length };
    }
    const items: Array<Infer<typeof legacyLinkItemValidator>> = [];
    for (const candidate of candidates) {
      const item = await legacyLinkItem(ctx, args.organizationId, candidate);
      if (item) items.push(item);
    }
    return {
      items,
      checkedCount: page.checked,
      isDone: page.isDone,
      continueCursor: page.continueCursor,
    };
  },
});

async function backfillLink(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
  input: {
    target: PartyTarget;
    accountId: Id<"accounts">;
    role: PartyRole;
    effectiveFrom: number;
    effectiveTo?: number;
    assertedName?: string;
  },
) {
  const account = await ctx.db.get(input.accountId);
  if (!account || account.organizationId !== organizationId) return false;
  if (await hasCurrentPartyLink(ctx, organizationId, input.target, [input.role]))
    return false;
  await recordPartyLink(ctx, {
    organizationId,
    target: input.target,
    account,
    role: input.role,
    allowedRoles: [input.role],
    effectiveFrom: input.effectiveFrom,
    effectiveTo: input.effectiveTo,
    assertedName: input.assertedName,
    origin: "backfill",
  });
  return true;
}

/**
 * Creates typed links from existing account references (accession donor
 * accounts and loan accounts) in one bounded batch. Run only with owner
 * approval, page by page with the returned cursor; reruns skip records that
 * already have a link. Name-only records are never linked here.
 */
export const backfillFromAccountFields = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    kind: v.union(v.literal("accession"), v.literal("loan")),
    cursor: v.union(v.string(), v.null()),
  },
  returns: v.object({
    created: v.number(),
    checked: v.number(),
    isDone: v.boolean(),
    continueCursor: v.string(),
  }),
  handler: async (ctx, args) => {
    const paginationOpts = {
      numItems: BACKFILL_BATCH_LIMIT,
      cursor: args.cursor,
    };
    let created = 0;
    if (args.kind === "accession") {
      const result = await ctx.db
        .query("accessions")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", args.organizationId),
        )
        .paginate(paginationOpts);
      for (const accession of result.page) {
        if (!accession.donorAccountId) continue;
        const linked = await backfillLink(ctx, args.organizationId, {
          target: { type: "accession", id: accession._id },
          accountId: accession.donorAccountId,
          role: "donor",
          effectiveFrom: accession.dateReceived,
          assertedName: accessionSourceAssertion(accession.source),
        });
        if (linked) created++;
      }
      return {
        created,
        checked: result.page.length,
        isDone: result.isDone,
        continueCursor: result.continueCursor,
      };
    }
    const result = await ctx.db
      .query("loans")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .paginate(paginationOpts);
    for (const loan of result.page) {
      if (!loan.accountId) continue;
      const linked = await backfillLink(ctx, args.organizationId, {
        target: { type: "loan", id: loan._id },
        accountId: loan.accountId,
        role: loan.type === "incoming" ? "lender" : "borrower",
        effectiveFrom: loan.startDate,
        effectiveTo: loan.endDate,
        assertedName: loan.lenderBorrowerName,
      });
      if (linked) created++;
    }
    return {
      created,
      checked: result.page.length,
      isDone: result.isDone,
      continueCursor: result.continueCursor,
    };
  },
});
