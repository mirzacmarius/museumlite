import type { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import {
  REGISTER_CRITERIA_FIELDS,
  REGISTER_PROFILES,
} from "@v1/backend/convex/utils/registerProfiles";
import type { FunctionArgs } from "convex/server";

export type RegisterSource = Extract<
  FunctionArgs<typeof api.exports.create>["source"],
  { kind: "register" }
>;
export type Profile = RegisterSource["profile"];
export type Criteria = RegisterSource["criteria"];
export type CriterionField = keyof Criteria;
export type Status = NonNullable<Criteria["status"]>;
export type Purpose = NonNullable<Criteria["purpose"]>;
export type InventoryScope = NonNullable<Criteria["inventoryScope"]>;

export const STATUSES: readonly Status[] = ["pending", "approved", "rejected"];
export const INVENTORY_SCOPES: readonly InventoryScope[] = [
  "owned",
  "incoming",
  "unclassified",
];

const DAY_MS = 24 * 60 * 60 * 1000;

/** The register card's inputs, as typed; criteria are derived from them. */
export interface RegisterForm {
  profile: Profile;
  /** `YYYY-MM-DD` UTC day, or empty. */
  fromDate: string;
  toDate: string;
  status: Status | "";
  /** `datetime-local` value read as UTC, or empty. */
  asOf: string;
  purpose: Purpose | "";
  /** ISO 4217 code as typed, or empty. */
  currency: string;
  inventoryScope: InventoryScope | "";
  policyId: Id<"insurancePolicies"> | "";
}

export const EMPTY_REGISTER_FORM: RegisterForm = {
  profile: "accession",
  fromDate: "",
  toDate: "",
  status: "",
  asOf: "",
  purpose: "",
  currency: "",
  inventoryScope: "",
  policyId: "",
};

export function isProfile(value: string): value is Profile {
  return REGISTER_PROFILES.some((profile) => profile === value);
}

/** Whether the profile accepts the criterion; the server refuses others. */
export function acceptsCriterion(profile: Profile, field: CriterionField) {
  return REGISTER_CRITERIA_FIELDS[profile].includes(field);
}

/** `YYYY-MM-DD` as the first or last UTC millisecond of that day. */
function utcDay(value: string, endOfDay: boolean) {
  if (!value) return undefined;
  const start = Date.parse(`${value}T00:00:00Z`);
  if (!Number.isFinite(start)) return undefined;
  return endOfDay ? start + DAY_MS - 1 : start;
}

/** A `datetime-local` value read as UTC, like the date criteria. */
function utcDateTime(value: string) {
  if (!value) return undefined;
  return Date.parse(`${value}Z`);
}

/** The criteria the selected profile accepts, from the form's inputs. */
export function criteriaFromForm(form: RegisterForm): Criteria {
  const accepts = (field: CriterionField) =>
    acceptsCriterion(form.profile, field);
  const currency = form.currency.trim().toUpperCase();
  return {
    fromDate: accepts("fromDate") ? utcDay(form.fromDate, false) : undefined,
    toDate: accepts("toDate") ? utcDay(form.toDate, true) : undefined,
    status: accepts("status") && form.status ? form.status : undefined,
    asOf: utcDateTime(form.asOf),
    purpose: accepts("purpose") && form.purpose ? form.purpose : undefined,
    currency: accepts("currency") && currency ? currency : undefined,
    inventoryScope:
      accepts("inventoryScope") && form.inventoryScope
        ? form.inventoryScope
        : undefined,
    policyId: accepts("policyId") && form.policyId ? form.policyId : undefined,
  };
}

/**
 * Checks the server would otherwise refuse: a reversed range, an unreadable
 * as-of or a currency that is not a three-letter code.
 */
export function hasValidCriteriaShape(criteria: Criteria) {
  return (
    (criteria.fromDate === undefined ||
      criteria.toDate === undefined ||
      criteria.fromDate <= criteria.toDate) &&
    (criteria.asOf === undefined || Number.isFinite(criteria.asOf)) &&
    (criteria.currency === undefined || /^[A-Z]{3}$/.test(criteria.currency))
  );
}
