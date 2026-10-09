import { getAuthUserId } from "@convex-dev/auth/server";
import {
  paginationOptsValidator,
  paginationResultValidator,
} from "convex/server";
import { type Infer, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { type MutationCtx, type QueryCtx, query } from "./_generated/server";
import { requireLoansAccess } from "./utils/loanAccess";
import { internalMutation, mutation } from "./utils/mutationBuilders";
import {
  partyDisplayName,
  requireLinkableParty,
  requirePartyAccess,
  toPartySummary,
} from "./utils/parties";
import { partyError } from "./utils/partyErrors";
import {
  ACCESSION_PARTY_ROLES,
  accessionSourceAssertion,
  assertPartyRoleAllowed,
  currentPartyLink,
  endPartyLink,
  hasPartyLinkHistory,
  loanPartyRoles,
  loanPrimaryRole,
  partyLinksForTarget,
  partyRecordLocked,
  partyTargetOf,
  readablePartyTargetLabel,
  recordPartyLink,
  resolvePartyTarget,
  syncPrimaryPartyField,
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

const partyLinkPolicyValidator = v.union(
  v.literal("open"),
  v.literal("firstLinkOnly"),
  v.literal("closed"),
);

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

const roleHistoryItemValidator = v.union(
  v.object({
    _id: v.id("partyLinks"),
    restricted: v.literal(false),
    role: partyRoleValidator,
    targetType: partyTargetTypeValidator,
    targetId: partyTargetIdValidator,
    targetLabel: v.string(),
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
  }),
  /** The caller may not open the linked record: only the role is shown. */
  v.object({
    _id: v.id("partyLinks"),
    restricted: v.literal(true),
    role: partyRoleValidator,
    targetType: partyTargetTypeValidator,
    isCurrent: v.boolean(),
  }),
);

/**
 * Parties linked to a procedure record: current roles first, then superseded
 * links with their original name and contact snapshots. Also reports which
 * roles fit the record and how its parties may change.
 */
export const listForTarget = query({
  args: { target: partyTargetValidator },
  returns: v.object({
    allowedRoles: v.array(partyRoleValidator),
    policy: partyLinkPolicyValidator,
    links: v.array(partyLinkViewValidator),
  }),
  handler: async (ctx, args) => {
    const resolved = await resolvePartyTarget(ctx, args.target, "read");
    await requirePartyAccess(ctx, resolved.organizationId, "accounts.read");
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
    return {
      allowedRoles: [...resolved.allowedRoles],
      policy: resolved.policy,
      links: views.sort(
        (left, right) =>
          Number(right.isCurrent) - Number(left.isCurrent) ||
          right.createdAt - left.createdAt,
      ),
    };
  },
});

async function toRoleHistoryItem(
  ctx: QueryCtx,
  link: Doc<"partyLinks">,
): Promise<Infer<typeof roleHistoryItemValidator>> {
  const isCurrent = link.supersededAt === undefined;
  const targetLabel = await readablePartyTargetLabel(ctx, link);
  if (targetLabel === null) {
    return {
      _id: link._id,
      restricted: true,
      role: link.role,
      targetType: link.targetType,
      isCurrent,
    };
  }
  return {
    _id: link._id,
    restricted: false,
    role: link.role,
    targetType: link.targetType,
    targetId: link.targetId,
    targetLabel,
    nameSnapshot: link.nameSnapshot,
    assertedName: link.assertedName,
    contactSnapshot: link.contactSnapshot,
    effectiveFrom: link.effectiveFrom,
    effectiveTo: link.effectiveTo,
    origin: link.origin,
    createdAt: link.createdAt,
    supersededAt: link.supersededAt,
    supersessionReason: link.supersessionReason,
    isCurrent,
  };
}

/**
 * Role history of one Party across procedures, newest first. Records the
 * caller may not open are listed by role only.
 */
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
    await requirePartyAccess(ctx, account.organizationId, "accounts.read");
    const result = await ctx.db
      .query("partyLinks")
      .withIndex("by_account", (q) => q.eq("accountId", args.accountId))
      .order("desc")
      .paginate(args.paginationOpts);
    const page = await Promise.all(
      result.page.flatMap((link) =>
        link.organizationId === account.organizationId
          ? [toRoleHistoryItem(ctx, link)]
          : [],
      ),
    );
    return { ...result, page };
  },
});

/**
 * Links a Party to a procedure record in a contextual role. Requires the
 * record's own write permission and `accounts.read`; the Party must belong
 * to the record's organization, be active, and fit the role.
 *
 * Records still open for edits (pending accessions and loans, appraisals,
 * objects) may replace a Party; the earlier link is superseded, never
 * deleted, and the record's own party reference follows. Closed records may
 * only gain a first link per role that agrees with what they already say.
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
    const organizationId = resolved.organizationId;
    const isPrimary = args.role === resolved.primaryRole;
    const confirmsRecord =
      isPrimary && args.accountId === resolved.recordAccountId;
    const account = await requireLinkableParty(
      ctx,
      organizationId,
      args.accountId,
      { allowArchived: confirmsRecord },
    );
    assertPartyRoleAllowed(args.role, resolved.allowedRoles);
    const [current, hasHistory] = await Promise.all([
      currentPartyLink(ctx, organizationId, args.target, args.role),
      hasPartyLinkHistory(ctx, organizationId, args.target, [args.role]),
    ]);
    if (current?.accountId === account._id) {
      return current._id;
    }
    if (resolved.policy === "closed") partyRecordLocked();
    if (
      resolved.policy === "firstLinkOnly" &&
      (hasHistory ||
        (isPrimary &&
          resolved.recordAccountId !== undefined &&
          !confirmsRecord))
    ) {
      partyRecordLocked();
    }
    const explicitAssertion =
      args.target.type === "accession" && args.assertedName !== undefined
        ? accessionSourceAssertion(args.assertedName)
        : args.assertedName;
    const { linkId, created } = await recordPartyLink(ctx, {
      organizationId,
      target: args.target,
      account,
      role: args.role,
      allowedRoles: resolved.allowedRoles,
      effectiveFrom:
        args.effectiveFrom ?? resolved.defaultEffectiveFrom ?? Date.now(),
      effectiveTo: args.effectiveTo,
      // The record's own wording names its first primary party only.
      assertedName:
        explicitAssertion ??
        (isPrimary && !hasHistory ? resolved.recordAssertedName : undefined),
      supersessionReason: args.reason,
      userId,
      origin: "staff",
    });
    if (created && isPrimary && resolved.policy === "open") {
      await syncPrimaryPartyField(ctx, args.target, account);
    }
    return linkId;
  },
});

/**
 * Ends a current link without naming a replacement, on records still open
 * for edits. The link and its snapshots stay in the record's history and
 * the record's own party reference is cleared.
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
    const target = partyTargetOf(existing);
    const resolved = await resolvePartyTarget(ctx, target, "write");
    if (resolved.organizationId !== existing.organizationId) {
      throw partyError("PARTY_LINK_NOT_FOUND", "Party link not found");
    }
    await requirePartyAccess(ctx, existing.organizationId, "accounts.read");
    if (existing.supersededAt !== undefined) {
      throw partyError(
        "PARTY_LINK_ALREADY_SUPERSEDED",
        "This party link has already been superseded",
      );
    }
    if (resolved.policy !== "open") partyRecordLocked();
    await endPartyLink(ctx, existing, userId, args.reason);
    if (existing.role === resolved.primaryRole) {
      await syncPrimaryPartyField(ctx, target, null);
    }
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
  target: partyTargetValidator,
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
  roles: readonly PartyRole[];
  existingAccountId?: Id<"accounts">;
}

async function legacyLinkItem(
  ctx: QueryCtx,
  organizationId: Id<"organizations">,
  candidate: LegacyCandidate,
): Promise<Infer<typeof legacyLinkItemValidator> | null> {
  const [suggestedRole] = candidate.roles;
  if (!suggestedRole) return null;
  if (!candidate.assertedName && !candidate.existingAccountId) return null;
  // Records with any link history (current or ended) have been reviewed.
  if (
    await hasPartyLinkHistory(
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
    target: candidate.target,
    label: candidate.label,
    assertedName: candidate.assertedName,
    contact: candidate.contact,
    date: candidate.date,
    suggestedRole,
    existingParty,
  };
}

/**
 * Records that name a party only in text, or reference an account without
 * a typed link. Staff confirm each link; nothing is linked automatically.
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
    await requirePartyAccess(ctx, args.organizationId, "accounts.read");
    if (args.kind === "loan") {
      await requireLoansAccess(ctx, args.organizationId);
      await requirePermission(ctx, args.organizationId, "loans.read");
    } else {
      await requirePermission(ctx, args.organizationId, "collections.read");
    }
    if (args.paginationOpts.numItems > LEGACY_REVIEW_PAGE_LIMIT) {
      throw new Error(
        `Legacy link review pages hold at most ${LEGACY_REVIEW_PAGE_LIMIT} records`,
      );
    }
    let candidates: LegacyCandidate[];
    let page: { isDone: boolean; continueCursor: string; checked: number };
    if (args.kind === "accession") {
      const result = await ctx.db
        .query("accessions")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", args.organizationId),
        )
        .paginate(args.paginationOpts);
      candidates = result.page.map((accession) => ({
        target: { type: "accession", id: accession._id },
        label: accession.accessionNumber,
        assertedName: accessionSourceAssertion(accession.source),
        date: accession.dateReceived,
        roles: ACCESSION_PARTY_ROLES,
        existingAccountId: accession.donorAccountId,
      }));
      page = { ...result, checked: result.page.length };
    } else if (args.kind === "loan") {
      const result = await ctx.db
        .query("loans")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", args.organizationId),
        )
        .paginate(args.paginationOpts);
      candidates = result.page.map((loan) => ({
        target: { type: "loan", id: loan._id },
        label: loan.loanNumber,
        assertedName: loan.lenderBorrowerName.trim() || undefined,
        contact: loan.lenderBorrowerContact?.trim() || undefined,
        date: loan.startDate,
        roles: loanPartyRoles(loan.type),
        existingAccountId: loan.accountId,
      }));
      page = { ...result, checked: result.page.length };
    } else {
      const result = await ctx.db
        .query("deaccessions")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", args.organizationId),
        )
        .paginate(args.paginationOpts);
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
  // Never recreate a link staff already made or deliberately ended.
  if (
    await hasPartyLinkHistory(ctx, organizationId, input.target, [input.role])
  )
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
 * already have link history. Name-only records are never linked here.
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
        role: loanPrimaryRole(loan.type),
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
