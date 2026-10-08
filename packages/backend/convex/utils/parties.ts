import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { requireModuleEnabled } from "./featureGates";
import { partyError } from "./partyErrors";
import type { DuplicateReason, PartySummary } from "./partyValidators";
import { requirePermission } from "./permissions";

type PartyAccount = Pick<
  Doc<"accounts">,
  | "_id"
  | "accountNumber"
  | "accountType"
  | "holderType"
  | "businessName"
  | "legalName"
  | "firstName"
  | "lastName"
  | "contactPerson"
  | "contactEmail"
  | "contactPhone"
  | "email"
  | "phone"
  | "status"
>;

function trimmed(value: string | undefined) {
  const text = value?.trim();
  return text ? text : undefined;
}

/**
 * The name staff recognise a Party by. Museum parties keep the full name in
 * `businessName` (people and institutions alike); library patrons use first
 * and last name.
 */
export function partyDisplayName(account: PartyAccount): string {
  const personName = [trimmed(account.firstName), trimmed(account.lastName)]
    .filter(Boolean)
    .join(" ");
  return (
    trimmed(account.businessName) ??
    (personName || undefined) ??
    trimmed(account.legalName) ??
    account.accountNumber
  );
}

export function partyHolderType(
  account: PartyAccount,
): "organization" | "privatePerson" {
  if (account.holderType) return account.holderType;
  return account.accountType === "patron" ? "privatePerson" : "organization";
}

export function partyContactSnapshot(
  account: PartyAccount,
): string | undefined {
  const parts = [
    trimmed(account.contactPerson),
    trimmed(account.email) ?? trimmed(account.contactEmail),
    trimmed(account.phone) ?? trimmed(account.contactPhone),
  ].filter((part): part is string => part !== undefined);
  return parts.length > 0 ? parts.join(", ") : undefined;
}

export function toPartySummary(account: PartyAccount): PartySummary {
  return {
    _id: account._id,
    accountNumber: account.accountNumber,
    displayName: partyDisplayName(account),
    holderType: partyHolderType(account),
    email: trimmed(account.email) ?? trimmed(account.contactEmail),
    phone: trimmed(account.phone) ?? trimmed(account.contactPhone),
    contactPerson: trimmed(account.contactPerson),
    archived: account.status === "archived",
  };
}

/** Lowercase, accent-free, punctuation-free, with name tokens sorted. */
export function normalizePartyName(name: string): string | undefined {
  const tokens = name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .split(" ")
    .filter(Boolean)
    .sort();
  return tokens.length > 0 ? tokens.join(" ") : undefined;
}

export function normalizePartyEmail(email: string | undefined) {
  const value = email?.trim().toLowerCase();
  return value?.includes("@") ? value : undefined;
}

export function normalizePartyPhone(phone: string | undefined) {
  const digits = phone?.replace(/\D/g, "") ?? "";
  return digits.length >= 6 ? digits : undefined;
}

/** Normalized identity keys used to suggest (never decide) duplicates. */
export function partyIdentityKeys(
  account: PartyAccount,
): Array<{ reason: DuplicateReason; key: string }> {
  const keys: Array<{ reason: DuplicateReason; key: string }> = [];
  const name = normalizePartyName(partyDisplayName(account));
  if (name && name !== normalizePartyName(account.accountNumber)) {
    keys.push({ reason: "name", key: name });
  }
  const email = normalizePartyEmail(account.email ?? account.contactEmail);
  if (email) keys.push({ reason: "email", key: email });
  const phone = normalizePartyPhone(account.phone ?? account.contactPhone);
  if (phone) keys.push({ reason: "phone", key: phone });
  return keys;
}

/**
 * Loads a Party that may be linked to a procedure in `organizationId`.
 * Requires the accounts module and `accounts.read`; a missing, foreign or
 * archived account is rejected with a stable code.
 */
export async function requireLinkableParty(
  ctx: QueryCtx | MutationCtx,
  organizationId: Id<"organizations">,
  accountId: Id<"accounts">,
): Promise<Doc<"accounts">> {
  await requireModuleEnabled(ctx, organizationId, "accounts");
  await requirePermission(ctx, organizationId, "accounts.read");
  const account = await ctx.db.get(accountId);
  if (!account || account.organizationId !== organizationId) {
    throw partyError("PARTY_NOT_FOUND", "Party not found in this organization");
  }
  if (account.status === "archived") {
    throw partyError("PARTY_ARCHIVED", "Archived parties cannot be linked");
  }
  return account;
}
