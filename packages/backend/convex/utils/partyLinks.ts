import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { objectLabel } from "./collectionDisplayHelpers";
import { isDisposalDecision } from "./disposalPolicy";
import { requireLoansAccess } from "./loanAccess";
import { isOpenEntryStatus } from "./objectEntryValidators";
import {
  normalizePartyName,
  partyContactSnapshot,
  partyDisplayName,
} from "./parties";
import { partyError } from "./partyErrors";
import type { PartyRole, PartyTarget } from "./partyValidators";
import {
  hasPermission,
  requireCapability,
  requirePermission,
} from "./permissions";
import { isWithdrawnObject } from "./provenance";
import { REPRODUCTION_READ_PERMISSIONS } from "./reproductionRequestAccess";

/** History rows read per target; supersession history stays small. */
export const PARTY_LINKS_PER_TARGET_LIMIT = 100;

/** Source text the accession form used to store when only a party was set. */
const LINKED_SOURCE_PLACEHOLDER = "See linked account";

/** The accession's source text as a named assertion, if it is one. */
export function accessionSourceAssertion(source: string): string | undefined {
  const text = source.trim();
  return text && text !== LINKED_SOURCE_PLACEHOLDER ? text : undefined;
}

/** Roles a Party may hold on each kind of record, primary role first. */
export const ACCESSION_PARTY_ROLES: readonly PartyRole[] = ["donor", "owner"];

/** Depositor first: the entry record names the depositor itself. */
export const ENTRY_PARTY_ROLES: readonly PartyRole[] = [
  "depositor",
  "owner",
  "recipient",
];

export function loanPartyRoles(type: Doc<"loans">["type"]): PartyRole[] {
  return type === "incoming" ? ["lender", "owner"] : ["borrower"];
}

export function loanPrimaryRole(type: Doc<"loans">["type"]): PartyRole {
  return type === "incoming" ? "lender" : "borrower";
}

/**
 * How parties may change on a record through `partyLinks`:
 * - `open`: link, replace and end (the record's own edit rules allow it);
 * - `firstLinkOnly`: a closed record may only gain a first link per role
 *   that agrees with what the record already says;
 * - `closed`: no changes here (use the record's own flow).
 */
export type PartyLinkPolicy = "open" | "firstLinkOnly" | "closed";

export interface ResolvedPartyTarget {
  organizationId: Id<"organizations">;
  label: string;
  /** Domain date the role starts from when the caller gives none. */
  defaultEffectiveFrom?: number;
  allowedRoles: readonly PartyRole[];
  policy: PartyLinkPolicy;
  /** The role the record itself names a party for. */
  primaryRole?: PartyRole;
  /** Roles whose current party the record's own fields mirror. */
  mirroredRoles?: readonly PartyRole[];
  /** How the record names that party. */
  recordAssertedName?: string;
  /** The account the record already references for that role. */
  recordAccountId?: Id<"accounts">;
  /**
   * The record's wording names every party linked in its primary role, not
   * only the first, because the record itself is never rewritten.
   */
  recordNamesEveryLink?: boolean;
  /** Links carry no dates; the record keeps them as partial dates. */
  undatedLinks?: boolean;
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
        allowedRoles: ACCESSION_PARTY_ROLES,
        policy: accession.status === "pending" ? "open" : "firstLinkOnly",
        primaryRole: "donor",
        mirroredRoles: ["donor"],
        recordAssertedName: accessionSourceAssertion(accession.source),
        recordAccountId: accession.donorAccountId,
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
        allowedRoles: loanPartyRoles(loan.type),
        policy: loan.status === "pending" ? "open" : "firstLinkOnly",
        primaryRole: loanPrimaryRole(loan.type),
        mirroredRoles: [loanPrimaryRole(loan.type)],
        recordAssertedName: loan.lenderBorrowerName.trim() || undefined,
        recordAccountId: loan.accountId,
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
      const exitRecorded =
        deaccession.status === "approved" &&
        isDisposalDecision(deaccession) &&
        deaccession.exitRecord !== undefined;
      return {
        organizationId: deaccession.organizationId,
        label: deaccession.deaccessionNumber,
        defaultEffectiveFrom:
          deaccession.exitRecord?.exitDate ?? deaccession.dateDeaccessioned,
        allowedRoles: ["recipient"],
        // Recipient changes go through exit corrections (recordExit).
        policy: exitRecorded ? "firstLinkOnly" : "closed",
        primaryRole: "recipient",
        recordAssertedName: deaccession.exitRecord?.recipient,
      };
    }
    case "provenanceClaim": {
      const claim = await ctx.db.get(target.id);
      if (!claim) targetNotFound();
      await requirePermission(ctx, claim.organizationId, collectionsPermission);
      const object = await ctx.db.get(claim.objectId);
      return {
        organizationId: claim.organizationId,
        label: object ? objectLabel(object) : "",
        // Only a named holder whose role the claim states can be a Party.
        allowedRoles:
          claim.partyKind === "named" && claim.role ? [claim.role] : [],
        policy:
          claim.supersededAt === undefined && !isWithdrawnObject(object)
            ? "open"
            : "closed",
        primaryRole: claim.role,
        recordAssertedName: claim.partyText,
        recordNamesEveryLink: true,
        undatedLinks: true,
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
        policy: "open",
        primaryRole: "appraiser",
        recordAssertedName: appraisal.appraiserName.trim() || undefined,
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
        label: objectLabel(collection),
        allowedRoles: ["owner"],
        policy: "open",
      };
    }
    case "entry": {
      const entry = await ctx.db.get(target.id);
      if (!entry) targetNotFound();
      await requirePermission(ctx, entry.organizationId, collectionsPermission);
      return {
        organizationId: entry.organizationId,
        label: entry.entryNumber,
        defaultEffectiveFrom: entry.receivedAt,
        allowedRoles: ENTRY_PARTY_ROLES,
        policy: isOpenEntryStatus(entry.status) ? "open" : "firstLinkOnly",
        primaryRole: "depositor",
        mirroredRoles: ["depositor", "owner"],
        recordAssertedName: entry.depositorName.trim() || undefined,
        recordAccountId: entry.depositorAccountId,
      };
    }
    case "reproductionRequest": {
      const request = await ctx.db.get(target.id);
      if (!request) targetNotFound();
      await requireCapability(
        ctx,
        request.organizationId,
        "reproduction_requests",
        REPRODUCTION_READ_PERMISSIONS,
      );
      // The requester is recorded at intake and never replaced.
      return {
        organizationId: request.organizationId,
        label: request.requestNumber,
        defaultEffectiveFrom: request.createdAt,
        allowedRoles: ["requester"],
        policy: "closed",
        primaryRole: "requester",
        recordAssertedName: request.requesterName,
        recordAccountId: request.requesterAccountId,
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
    link.targetType === "loan"
      ? "loans.read"
      : link.targetType === "reproductionRequest"
        ? "media.read"
        : "collections.read";
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
    case "provenanceClaim": {
      const claim = await ctx.db.get(link.targetId);
      if (claim?.organizationId !== link.organizationId) return null;
      const object = await ctx.db.get(claim.objectId);
      return object?.organizationId === link.organizationId
        ? objectLabel(object)
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
        ? objectLabel(record)
        : null;
    }
    case "entry": {
      const record = await ctx.db.get(link.targetId);
      return record?.organizationId === link.organizationId
        ? record.entryNumber
        : null;
    }
    case "reproductionRequest": {
      const record = await ctx.db.get(link.targetId);
      return record?.organizationId === link.organizationId
        ? record.requestNumber
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

export function partyRecordLocked(): never {
  throw partyError(
    "PARTY_RECORD_LOCKED",
    "This record's parties cannot be changed here",
  );
}

function targetFields(target: PartyTarget) {
  switch (target.type) {
    case "accession":
      return { targetType: "accession" as const, targetId: target.id };
    case "loan":
      return { targetType: "loan" as const, targetId: target.id };
    case "deaccession":
      return { targetType: "deaccession" as const, targetId: target.id };
    case "provenanceClaim":
      return { targetType: "provenanceClaim" as const, targetId: target.id };
    case "appraisal":
      return { targetType: "appraisal" as const, targetId: target.id };
    case "collection":
      return { targetType: "collection" as const, targetId: target.id };
    case "entry":
      return { targetType: "entry" as const, targetId: target.id };
    case "reproductionRequest":
      return {
        targetType: "reproductionRequest" as const,
        targetId: target.id,
      };
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
    case "provenanceClaim":
      return { type: "provenanceClaim", id: link.targetId };
    case "appraisal":
      return { type: "appraisal", id: link.targetId };
    case "collection":
      return { type: "collection", id: link.targetId };
    case "entry":
      return { type: "entry", id: link.targetId };
    case "reproductionRequest":
      return { type: "reproductionRequest", id: link.targetId };
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

/** True when the target has ever had a link (current or ended) in `roles`. */
export async function hasPartyLinkHistory(
  ctx: QueryCtx | MutationCtx,
  organizationId: Id<"organizations">,
  target: PartyTarget,
  roles: readonly PartyRole[],
) {
  for (const role of roles) {
    const link = await ctx.db
      .query("partyLinks")
      .withIndex("by_organization_and_target_and_role_and_supersededAt", (q) =>
        q
          .eq("organizationId", organizationId)
          .eq("targetType", target.type)
          .eq("targetId", target.id)
          .eq("role", role),
      )
      .first();
    if (link) return true;
  }
  return false;
}

/** A record that names a Party in its own fields, for the legacy review. */
export interface LegacyPartyCandidate {
  target: PartyTarget;
  label: string;
  /** The name as written on the record. */
  assertedName?: string;
  contact?: string;
  date: number;
  /** Roles the Party may hold on the record, primary role first. */
  roles: readonly PartyRole[];
  /** An account the record references without a typed link. */
  existingAccountId?: Id<"accounts">;
}

export function accessionLegacyCandidate(
  accession: Doc<"accessions">,
): LegacyPartyCandidate {
  return {
    target: { type: "accession", id: accession._id },
    label: accession.accessionNumber,
    assertedName: accessionSourceAssertion(accession.source),
    date: accession.dateReceived,
    roles: ACCESSION_PARTY_ROLES,
    existingAccountId: accession.donorAccountId,
  };
}

export function loanLegacyCandidate(loan: Doc<"loans">): LegacyPartyCandidate {
  return {
    target: { type: "loan", id: loan._id },
    label: loan.loanNumber,
    assertedName: loan.lenderBorrowerName.trim() || undefined,
    contact: loan.lenderBorrowerContact?.trim() || undefined,
    date: loan.startDate,
    roles: loanPartyRoles(loan.type),
    existingAccountId: loan.accountId,
  };
}

export function deaccessionLegacyCandidate(
  deaccession: Doc<"deaccessions">,
): LegacyPartyCandidate | null {
  if (!deaccession.exitRecord) return null;
  return {
    target: { type: "deaccession", id: deaccession._id },
    label: deaccession.deaccessionNumber,
    assertedName: deaccession.exitRecord.recipient,
    date: deaccession.exitRecord.exitDate,
    roles: ["recipient"],
  };
}

/**
 * True when a record names a Party only in text, or references an account
 * without a typed link, and has never had a link in those roles. Records
 * with any link history (current or ended) have been reviewed. Nothing is
 * linked automatically.
 */
export async function awaitsLegacyPartyReview(
  ctx: QueryCtx | MutationCtx,
  organizationId: Id<"organizations">,
  candidate: LegacyPartyCandidate,
) {
  if (candidate.roles.length === 0) return false;
  if (!candidate.assertedName && !candidate.existingAccountId) return false;
  return !(await hasPartyLinkHistory(
    ctx,
    organizationId,
    candidate.target,
    candidate.roles,
  ));
}

/**
 * Keeps the record's own party reference in step with a mirrored role's
 * link on records that are still open for edits. Ending a link clears the
 * reference but keeps the name the record states.
 */
export async function syncRecordPartyField(
  ctx: MutationCtx,
  target: PartyTarget,
  role: PartyRole,
  account: Doc<"accounts"> | null,
) {
  if (target.type === "accession") {
    await ctx.db.patch(target.id, { donorAccountId: account?._id });
  } else if (target.type === "loan") {
    await ctx.db.patch(
      target.id,
      account
        ? {
            accountId: account._id,
            lenderBorrowerName: partyDisplayName(account),
            lenderBorrowerContact: partyContactSnapshot(account),
          }
        : { accountId: undefined },
    );
  } else if (target.type === "entry" && role === "owner") {
    await ctx.db.patch(
      target.id,
      account
        ? { ownerAccountId: account._id, ownerName: partyDisplayName(account) }
        : { ownerAccountId: undefined },
    );
  } else if (target.type === "entry") {
    await ctx.db.patch(
      target.id,
      account
        ? {
            depositorAccountId: account._id,
            depositorName: partyDisplayName(account),
          }
        : { depositorAccountId: undefined },
    );
  }
}

/** Ends a current link; the link and its snapshots stay in the history. */
export async function endPartyLink(
  ctx: MutationCtx,
  link: Doc<"partyLinks">,
  userId: Id<"users">,
  reason: string | undefined,
) {
  const supersessionReason = reason?.trim() || undefined;
  await ctx.db.patch(link._id, {
    supersededAt: Date.now(),
    supersededBy: userId,
    supersessionReason,
  });
  await ctx.runMutation(internal.audit.logAction, {
    organizationId: link.organizationId,
    userId,
    action: "party_link_ended",
    entityType: link.targetType,
    entityId: link.targetId,
    changes: {
      role: link.role,
      accountId: link.accountId,
      linkId: link._id,
      reason: supersessionReason,
    },
  });
}

/**
 * Keeps the recipient link of a disposal in step with its exit record. A
 * chosen Party becomes (or stays) the recipient. Without one, a correction
 * that names someone else ends the typed link, and a corrected exit date
 * re-records the same Party from the new date.
 */
export async function syncExitRecipientLink(
  ctx: MutationCtx,
  input: {
    deaccession: Doc<"deaccessions">;
    previousExit: Doc<"deaccessions">["exitRecord"];
    exitDate: number;
    recipient: string;
    recipientParty: Doc<"accounts"> | null;
    correctionReason: string | undefined;
    userId: Id<"users">;
  },
) {
  const organizationId = input.deaccession.organizationId;
  const target: PartyTarget = {
    type: "deaccession",
    id: input.deaccession._id,
  };
  const link = (account: Doc<"accounts">) =>
    recordPartyLink(ctx, {
      organizationId,
      target,
      account,
      role: "recipient",
      allowedRoles: ["recipient"],
      effectiveFrom: input.exitDate,
      assertedName: input.recipient,
      supersessionReason: input.correctionReason,
      userId: input.userId,
      origin: "staff",
    });
  if (input.recipientParty) {
    await link(input.recipientParty);
    return;
  }
  if (!input.previousExit) return;
  const current = await currentPartyLink(
    ctx,
    organizationId,
    target,
    "recipient",
  );
  if (!current) return;
  if (input.previousExit.recipient !== input.recipient) {
    await endPartyLink(ctx, current, input.userId, input.correctionReason);
    return;
  }
  if (input.previousExit.exitDate !== input.exitDate) {
    const account = await ctx.db.get(current.accountId);
    if (account?.organizationId === organizationId) await link(account);
  }
}

export interface RecordPartyLinkInput {
  organizationId: Id<"organizations">;
  target: PartyTarget;
  account: Doc<"accounts">;
  role: PartyRole;
  allowedRoles: readonly PartyRole[];
  /** Absent for records that keep the role's dates themselves. */
  effectiveFrom?: number;
  effectiveTo?: number;
  assertedName?: string;
  supersessionReason?: string;
  userId?: Id<"users">;
  origin: "staff" | "backfill";
}

/**
 * Makes `account` the current Party in `role` for the target. A different
 * current Party is superseded (kept, with who and when). Linking the same
 * Party again is a no-op unless its dates or named assertion change, in
 * which case the corrected link supersedes the earlier one. The caller has
 * already enforced the target's permission and the Party's tenant.
 */
export async function recordPartyLink(
  ctx: MutationCtx,
  input: RecordPartyLinkInput,
): Promise<{ linkId: Id<"partyLinks">; created: boolean }> {
  assertPartyRoleAllowed(input.role, input.allowedRoles);
  if (input.account.organizationId !== input.organizationId) {
    throw partyError("PARTY_NOT_FOUND", "Party not found in this organization");
  }
  const current = await currentPartyLink(
    ctx,
    input.organizationId,
    input.target,
    input.role,
  );
  const nameSnapshot = partyDisplayName(input.account);
  const asserted = input.assertedName?.trim();
  let assertedName =
    asserted &&
    normalizePartyName(asserted) !== normalizePartyName(nameSnapshot)
      ? asserted
      : undefined;
  let effectiveTo = input.effectiveTo;
  const samePartyCurrent = current?.accountId === input.account._id;
  if (current && samePartyCurrent) {
    assertedName ??= current.assertedName;
    effectiveTo ??= current.effectiveTo;
    if (
      input.effectiveFrom === current.effectiveFrom &&
      effectiveTo === current.effectiveTo &&
      assertedName === current.assertedName
    ) {
      return { linkId: current._id, created: false };
    }
  }
  if (
    effectiveTo !== undefined &&
    input.effectiveFrom !== undefined &&
    effectiveTo < input.effectiveFrom
  ) {
    throw partyError(
      "PARTY_DATES_INVALID",
      "The role cannot end before it starts",
    );
  }

  const now = Date.now();
  const linkId = await ctx.db.insert("partyLinks", {
    organizationId: input.organizationId,
    accountId: input.account._id,
    role: input.role,
    nameSnapshot,
    contactSnapshot: partyContactSnapshot(input.account),
    assertedName,
    effectiveFrom: input.effectiveFrom,
    effectiveTo,
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
