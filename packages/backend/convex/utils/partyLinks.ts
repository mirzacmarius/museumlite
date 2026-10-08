import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { requireLoansAccess } from "./loanAccess";
import {
  normalizePartyName,
  partyContactSnapshot,
  partyDisplayName,
} from "./parties";
import { partyError } from "./partyErrors";
import type { PartyRole, PartyTarget } from "./partyValidators";
import { hasPermission, requirePermission } from "./permissions";

/** History rows read per target; supersession history stays small. */
export const PARTY_LINKS_PER_TARGET_LIMIT = 100;

/** Source text the accession form used to store when only a party was set. */
const LINKED_SOURCE_PLACEHOLDER = "See linked account";

/** The accession's source text as a named assertion, if it is one. */
export function accessionSourceAssertion(source: string): string | undefined {
  const text = source.trim();
  return text && text !== LINKED_SOURCE_PLACEHOLDER ? text : undefined;
}

export interface ResolvedPartyTarget {
  organizationId: Id<"organizations">;
  label: string;
  /** Domain date the role starts from when the caller gives none. */
  defaultEffectiveFrom?: number;
  allowedRoles: readonly PartyRole[];
}

type TargetAccess = "read" | "write";

function targetNotFound(): never {
  throw partyError("PARTY_TARGET_NOT_FOUND", "Linked record not found");
}

/**
 * Loads a procedure record and enforces that record's own permission. The
 * target decides the tenant; parties must belong to the same organization.
 */
export async function resolvePartyTarget(
  ctx: QueryCtx | MutationCtx,
  target: PartyTarget,
  access: TargetAccess,
): Promise<ResolvedPartyTarget> {
  const collectionsPermission =
    access === "write" ? "collections.update" : "collections.read";
  switch (target.type) {
    case "accession": {
      const accession = await ctx.db.get(target.id);
      if (!accession) targetNotFound();
      await requirePermission(
        ctx,
        accession.organizationId,
        collectionsPermission,
      );
      return {
        organizationId: accession.organizationId,
        label: accession.accessionNumber,
        defaultEffectiveFrom: accession.dateReceived,
        allowedRoles: ["donor", "owner"],
      };
    }
    case "loan": {
      const loan = await ctx.db.get(target.id);
      if (!loan) targetNotFound();
      await requireLoansAccess(ctx, loan.organizationId);
      await requirePermission(
        ctx,
        loan.organizationId,
        access === "write" ? "loans.update" : "loans.read",
      );
      return {
        organizationId: loan.organizationId,
        label: loan.loanNumber,
        defaultEffectiveFrom: loan.startDate,
        allowedRoles:
          loan.type === "incoming" ? ["lender", "owner"] : ["borrower"],
      };
    }
    case "deaccession": {
      const deaccession = await ctx.db.get(target.id);
      if (!deaccession) targetNotFound();
      await requirePermission(
        ctx,
        deaccession.organizationId,
        collectionsPermission,
      );
      return {
        organizationId: deaccession.organizationId,
        label: deaccession.deaccessionNumber,
        defaultEffectiveFrom:
          deaccession.exitRecord?.exitDate ?? deaccession.dateDeaccessioned,
        allowedRoles: ["recipient"],
      };
    }
    case "appraisal": {
      const appraisal = await ctx.db.get(target.id);
      if (!appraisal) targetNotFound();
      await requirePermission(
        ctx,
        appraisal.organizationId,
        collectionsPermission,
      );
      return {
        organizationId: appraisal.organizationId,
        label: appraisal.appraiserName,
        defaultEffectiveFrom: appraisal.appraisalDate,
        allowedRoles: ["appraiser"],
      };
    }
    case "collection": {
      const collection = await ctx.db.get(target.id);
      if (!collection) targetNotFound();
      await requirePermission(
        ctx,
        collection.organizationId,
        collectionsPermission,
      );
      return {
        organizationId: collection.organizationId,
        label: `${collection.accessionNumber} ${collection.title}`.trim(),
        allowedRoles: ["owner"],
      };
    }
  }
}

/** Reads a target's label only when the caller may read that record. */
export async function readablePartyTargetLabel(
  ctx: QueryCtx,
  link: Doc<"partyLinks">,
): Promise<string | null> {
  const readPermission =
    link.targetType === "loan" ? "loans.read" : "collections.read";
  if (!(await hasPermission(ctx, link.organizationId, readPermission))) {
    return null;
  }
  switch (link.targetType) {
    case "accession": {
      const record = await ctx.db.get(link.targetId);
      return record?.organizationId === link.organizationId
        ? record.accessionNumber
        : null;
    }
    case "loan": {
      const record = await ctx.db.get(link.targetId);
      return record?.organizationId === link.organizationId
        ? record.loanNumber
        : null;
    }
    case "deaccession": {
      const record = await ctx.db.get(link.targetId);
      return record?.organizationId === link.organizationId
        ? record.deaccessionNumber
        : null;
    }
    case "appraisal": {
      const record = await ctx.db.get(link.targetId);
      return record?.organizationId === link.organizationId
        ? record.appraiserName
        : null;
    }
    case "collection": {
      const record = await ctx.db.get(link.targetId);
      return record?.organizationId === link.organizationId
        ? `${record.accessionNumber} ${record.title}`.trim()
        : null;
    }
  }
}

export function assertPartyRoleAllowed(
  role: PartyRole,
  allowedRoles: readonly PartyRole[],
) {
  if (!allowedRoles.includes(role)) {
    throw partyError(
      "PARTY_ROLE_NOT_ALLOWED",
      `The ${role} role does not apply to this record`,
    );
  }
}

function targetFields(target: PartyTarget) {
  switch (target.type) {
    case "accession":
      return { targetType: "accession" as const, targetId: target.id };
    case "loan":
      return { targetType: "loan" as const, targetId: target.id };
    case "deaccession":
      return { targetType: "deaccession" as const, targetId: target.id };
    case "appraisal":
      return { targetType: "appraisal" as const, targetId: target.id };
    case "collection":
      return { targetType: "collection" as const, targetId: target.id };
  }
}

export function partyTargetOf(link: Doc<"partyLinks">): PartyTarget {
  switch (link.targetType) {
    case "accession":
      return { type: "accession", id: link.targetId };
    case "loan":
      return { type: "loan", id: link.targetId };
    case "deaccession":
      return { type: "deaccession", id: link.targetId };
    case "appraisal":
      return { type: "appraisal", id: link.targetId };
    case "collection":
      return { type: "collection", id: link.targetId };
  }
}

export async function currentPartyLink(
  ctx: QueryCtx | MutationCtx,
  organizationId: Id<"organizations">,
  target: PartyTarget,
  role: PartyRole,
) {
  return await ctx.db
    .query("partyLinks")
    .withIndex("by_organization_and_target_and_role_and_supersededAt", (q) =>
      q
        .eq("organizationId", organizationId)
        .eq("targetType", target.type)
        .eq("targetId", target.id)
        .eq("role", role)
        .eq("supersededAt", undefined),
    )
    .first();
}

export async function partyLinksForTarget(
  ctx: QueryCtx | MutationCtx,
  organizationId: Id<"organizations">,
  target: PartyTarget,
) {
  return await ctx.db
    .query("partyLinks")
    .withIndex("by_organization_and_target_and_role_and_supersededAt", (q) =>
      q
        .eq("organizationId", organizationId)
        .eq("targetType", target.type)
        .eq("targetId", target.id),
    )
    .take(PARTY_LINKS_PER_TARGET_LIMIT);
}

/** True when the target has a current link in any of `roles`. */
export async function hasCurrentPartyLink(
  ctx: QueryCtx | MutationCtx,
  organizationId: Id<"organizations">,
  target: PartyTarget,
  roles: readonly PartyRole[],
) {
  for (const role of roles) {
    if (await currentPartyLink(ctx, organizationId, target, role)) return true;
  }
  return false;
}

export interface RecordPartyLinkInput {
  organizationId: Id<"organizations">;
  target: PartyTarget;
  account: Doc<"accounts">;
  role: PartyRole;
  allowedRoles: readonly PartyRole[];
  effectiveFrom: number;
  effectiveTo?: number;
  assertedName?: string;
  supersessionReason?: string;
  userId?: Id<"users">;
  origin: "staff" | "backfill";
}

/**
 * Makes `account` the current Party in `role` for the target. A different
 * current Party is superseded (kept, with who and when); linking the same
 * Party again returns the existing link so retries are harmless. The caller
 * has already enforced the target's permission and the Party's tenant.
 */
export async function recordPartyLink(
  ctx: MutationCtx,
  input: RecordPartyLinkInput,
): Promise<{ linkId: Id<"partyLinks">; created: boolean }> {
  assertPartyRoleAllowed(input.role, input.allowedRoles);
  if (input.account.organizationId !== input.organizationId) {
    throw partyError("PARTY_NOT_FOUND", "Party not found in this organization");
  }
  if (
    input.effectiveTo !== undefined &&
    input.effectiveTo < input.effectiveFrom
  ) {
    throw partyError(
      "PARTY_DATES_INVALID",
      "The role cannot end before it starts",
    );
  }
  const current = await currentPartyLink(
    ctx,
    input.organizationId,
    input.target,
    input.role,
  );
  if (current?.accountId === input.account._id) {
    return { linkId: current._id, created: false };
  }

  const now = Date.now();
  const nameSnapshot = partyDisplayName(input.account);
  const asserted = input.assertedName?.trim();
  const assertedName =
    asserted &&
    normalizePartyName(asserted) !== normalizePartyName(nameSnapshot)
      ? asserted
      : undefined;
  const linkId = await ctx.db.insert("partyLinks", {
    organizationId: input.organizationId,
    accountId: input.account._id,
    role: input.role,
    nameSnapshot,
    contactSnapshot: partyContactSnapshot(input.account),
    assertedName,
    effectiveFrom: input.effectiveFrom,
    effectiveTo: input.effectiveTo,
    origin: input.origin,
    createdBy: input.userId,
    createdAt: now,
    ...targetFields(input.target),
  });
  if (current) {
    await ctx.db.patch(current._id, {
      supersededAt: now,
      supersededBy: input.userId,
      supersededByLinkId: linkId,
      supersessionReason: input.supersessionReason?.trim() || undefined,
    });
  }
  if (input.userId) {
    await ctx.runMutation(internal.audit.logAction, {
      organizationId: input.organizationId,
      userId: input.userId,
      action: current ? "party_link_superseded" : "party_linked",
      entityType: input.target.type,
      entityId: input.target.id,
      changes: {
        role: input.role,
        accountId: input.account._id,
        nameSnapshot,
        assertedName,
        supersededLinkId: current?._id,
        previousAccountId: current?.accountId,
      },
    });
  }
  return { linkId, created: true };
}
