import type { Doc } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

export type OrganizationType = Doc<"organizations">["type"];

export type CustomerKindCode = "0100" | "0200";

export type CustomerNumber = string & {
  readonly __customerNumber: "CustomerNumber";
};

export const CUSTOMER_NUMBER_SEQUENCE_START = 100_000;

export const CUSTOMER_NUMBER_SEQUENCE_MAX = 999_999;

const CUSTOMER_NUMBER_PATTERN = /^(0100|0200)[1-9]\d{5}$/;

const KIND_BY_ORGANIZATION_TYPE = {
  collector: "0100",
  museum: "0200",
  gallery: "0200",
  library: "0200",
} as const satisfies Record<OrganizationType, CustomerKindCode>;

export function kindCodeForOrganizationType(
  type: OrganizationType,
): CustomerKindCode {
  return KIND_BY_ORGANIZATION_TYPE[type];
}

export function formatCustomerNumber(
  kind: CustomerKindCode,
  sequence: number,
): CustomerNumber {
  if (
    !Number.isInteger(sequence) ||
    sequence < CUSTOMER_NUMBER_SEQUENCE_START ||
    sequence > CUSTOMER_NUMBER_SEQUENCE_MAX
  ) {
    throw new Error(
      `Customer number sequence must be an integer between ${CUSTOMER_NUMBER_SEQUENCE_START} and ${CUSTOMER_NUMBER_SEQUENCE_MAX}`,
    );
  }

  return `${kind}${String(sequence).padStart(6, "0")}` as CustomerNumber;
}

export function parseCustomerNumber(value: string): CustomerNumber | null {
  if (!CUSTOMER_NUMBER_PATTERN.test(value)) {
    return null;
  }

  return value as CustomerNumber;
}

export async function mintCustomerNumber(
  ctx: MutationCtx,
  type: OrganizationType,
): Promise<CustomerNumber> {
  const kind = kindCodeForOrganizationType(type);
  const counter = await ctx.db
    .query("customerNumberCounter")
    .withIndex("by_scopeKey", (q) => q.eq("scopeKey", "global"))
    .first();

  let nextValue: number;
  if (counter) {
    nextValue = counter.currentValue + 1;
    if (nextValue > CUSTOMER_NUMBER_SEQUENCE_MAX) {
      throw new Error("Customer number sequence exhausted");
    }
    await ctx.db.patch(counter._id, {
      currentValue: nextValue,
    });
  } else {
    nextValue = CUSTOMER_NUMBER_SEQUENCE_START;
    await ctx.db.insert("customerNumberCounter", {
      scopeKey: "global",
      currentValue: nextValue,
    });
  }

  return formatCustomerNumber(kind, nextValue);
}

export async function assignCustomerNumberIfMissing(
  ctx: MutationCtx,
  organization: Doc<"organizations">,
): Promise<CustomerNumber> {
  if (organization.customerNumber !== undefined) {
    const parsed = parseCustomerNumber(organization.customerNumber);
    if (!parsed) {
      throw new Error(
        `Organization ${organization._id} has an invalid customerNumber`,
      );
    }
    return parsed;
  }

  const customerNumber = await mintCustomerNumber(ctx, organization.type);
  await ctx.db.patch(organization._id, { customerNumber });
  return customerNumber;
}
