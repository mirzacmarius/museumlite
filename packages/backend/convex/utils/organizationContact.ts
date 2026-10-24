import { ConvexError, type Infer, v } from "convex/values";
import { convexErrorData } from "./convexErrorData";

/** An Organization's postal address. Every line is optional. */
export const organizationAddressValidator = v.object({
  street: v.optional(v.string()),
  street2: v.optional(v.string()),
  postalCode: v.optional(v.string()),
  city: v.optional(v.string()),
  region: v.optional(v.string()),
  country: v.optional(v.string()),
});

export type OrganizationAddress = Infer<typeof organizationAddressValidator>;
export type OrganizationAddressLine = keyof OrganizationAddress;

/** Address lines in the order a form shows and an envelope prints them. */
export const ORGANIZATION_ADDRESS_LINES = [
  "street",
  "street2",
  "postalCode",
  "city",
  "region",
  "country",
] as const satisfies readonly OrganizationAddressLine[];

export const MAX_ADDRESS_LINE_LENGTH = 200;
export const MAX_PHONE_LENGTH = 50;

// Type alias (not an interface) so the payload satisfies Convex's Value type.
export type OrganizationContactErrorData = {
  code: "CONTACT_FIELD_TOO_LONG";
  message: string;
  /** An address line, or "phone". */
  field: OrganizationAddressLine | "phone";
  limit: number;
};

function tooLong(
  field: OrganizationAddressLine | "phone",
  limit: number,
): ConvexError<OrganizationContactErrorData> {
  return new ConvexError({
    code: "CONTACT_FIELD_TOO_LONG",
    message: `The ${field} field is longer than ${limit} characters`,
    field,
    limit,
  });
}

/**
 * Trims every line and drops the empty ones; undefined when no line is left,
 * so saving a blank form removes the stored address.
 */
export function normalizeOrganizationAddress(
  address: OrganizationAddress,
): OrganizationAddress | undefined {
  const normalized: OrganizationAddress = {};
  for (const line of ORGANIZATION_ADDRESS_LINES) {
    const value = address[line]?.trim();
    if (!value) continue;
    if (value.length > MAX_ADDRESS_LINE_LENGTH) {
      throw tooLong(line, MAX_ADDRESS_LINE_LENGTH);
    }
    normalized[line] = value;
  }
  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

/** The trimmed phone number; undefined when blank, which removes it. */
export function normalizeOrganizationPhone(phone: string): string | undefined {
  const value = phone.trim();
  if (value.length > MAX_PHONE_LENGTH) {
    throw tooLong("phone", MAX_PHONE_LENGTH);
  }
  return value || undefined;
}

/** Reads a refused address or phone from a thrown error; null otherwise. */
export function organizationContactErrorFromError(
  error: unknown,
): OrganizationContactErrorData | null {
  const data = convexErrorData(error);
  if (typeof data !== "object" || data === null) return null;
  const record = data as Record<string, unknown>;
  if (record.code !== "CONTACT_FIELD_TOO_LONG") return null;
  const field =
    record.field === "phone"
      ? "phone"
      : ORGANIZATION_ADDRESS_LINES.find((line) => line === record.field);
  if (!field || typeof record.limit !== "number") return null;
  return {
    code: "CONTACT_FIELD_TOO_LONG",
    message:
      typeof record.message === "string"
        ? record.message
        : "CONTACT_FIELD_TOO_LONG",
    field,
    limit: record.limit,
  };
}
