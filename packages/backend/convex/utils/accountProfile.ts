import type { Id } from "../_generated/dataModel";

export type AccountType =
  | "lender"
  | "borrower"
  | "both"
  | "institution"
  | "patron";

export type HolderType = "organization" | "privatePerson";

export type CustomerCategory = "person" | "business" | "nonProfit";

export type AccountStatus =
  | "active"
  | "expired"
  | "suspended"
  | "blocked"
  | "inactive";

export interface NotificationPreferences {
  email: boolean;
  sms: boolean;
  dueDateReminder: boolean;
  holdReady: boolean;
}

export interface StructuredAddress {
  street: string;
  city: string;
  state?: string;
  postalCode: string;
  country?: string;
}

interface AccountProfileFields {
  accountType: AccountType;
  holderType?: HolderType;
  customerCategory?: CustomerCategory;
  businessName?: string;
  taxId?: string;
  contactPerson?: string;
  contactPhone?: string;
  contactEmail?: string;
  firstName?: string;
  lastName?: string;
  dateOfBirth?: number;
  phone?: string;
  email?: string;
  address?: string;
  address2?: string;
  zipCode?: string;
  city?: string;
  country?: string;
  structuredAddress?: StructuredAddress;
  cardNumber?: string;
  pin?: string;
  membershipTypeId?: Id<"membershipTypes">;
  membershipType?: string;
  registrationDate?: number;
  expirationDate?: number;
  status?: AccountStatus;
  blockReason?: string;
  borrowingLimit?: number;
  holdLimit?: number;
  preferredBranch?: Id<"locations">;
  notificationPreferences?: NotificationPreferences;
  notes?: string;
}

export interface AccountCreateProfileInput extends AccountProfileFields {
  organizationId: Id<"organizations">;
}

export type AccountUpdateProfileInput = Partial<AccountProfileFields>;

export interface AccountCreateMetadata {
  accountNumber: string;
  createdBy: Id<"users">;
  createdAt: number;
}

export interface AccountUpdateMetadata {
  lastModifiedBy: Id<"users">;
  lastModifiedAt: number;
}

function trimmedOptional(value: string | undefined) {
  if (value === undefined) {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function validateAccountProfileForCreate(
  input: Pick<
    AccountCreateProfileInput,
    "accountType" | "businessName" | "firstName" | "lastName"
  >,
) {
  if (input.accountType === "patron") {
    if (!trimmedOptional(input.firstName) || !trimmedOptional(input.lastName)) {
      throw new Error(
        "First name and last name are required for patron accounts",
      );
    }
    return;
  }

  if (!trimmedOptional(input.businessName)) {
    throw new Error("Business name is required for non-patron accounts");
  }
}

export function buildAccountCreateDocument(
  input: AccountCreateProfileInput,
  metadata: AccountCreateMetadata,
) {
  const holderType = input.holderType ?? "organization";

  return {
    organizationId: input.organizationId,
    accountNumber: metadata.accountNumber,
    accountType: input.accountType,
    holderType,
    customerCategory: input.customerCategory,
    businessName: trimmedOptional(input.businessName),
    taxId: trimmedOptional(input.taxId),
    contactPerson: trimmedOptional(input.contactPerson),
    contactPhone: trimmedOptional(input.contactPhone),
    contactEmail: trimmedOptional(input.contactEmail),
    firstName: trimmedOptional(input.firstName),
    lastName: trimmedOptional(input.lastName),
    dateOfBirth: input.dateOfBirth,
    phone: trimmedOptional(input.phone),
    email: trimmedOptional(input.email),
    address: trimmedOptional(input.address),
    address2: trimmedOptional(input.address2),
    zipCode: trimmedOptional(input.zipCode),
    city: trimmedOptional(input.city),
    country: trimmedOptional(input.country),
    structuredAddress: input.structuredAddress,
    cardNumber: trimmedOptional(input.cardNumber),
    pin: input.pin,
    membershipTypeId: input.membershipTypeId,
    membershipType: trimmedOptional(input.membershipType),
    registrationDate: input.registrationDate,
    expirationDate: input.expirationDate,
    status: input.status,
    borrowingLimit: input.borrowingLimit,
    holdLimit: input.holdLimit,
    fineBalance: input.accountType === "patron" ? 0 : undefined,
    preferredBranch: input.preferredBranch,
    notificationPreferences: input.notificationPreferences,
    totalCheckouts: input.accountType === "patron" ? 0 : undefined,
    notes: trimmedOptional(input.notes),
    createdBy: metadata.createdBy,
    createdAt: metadata.createdAt,
  };
}

export function buildAccountUpdatePatch(
  input: AccountUpdateProfileInput,
  metadata: AccountUpdateMetadata,
) {
  const updates: Record<string, unknown> = {
    lastModifiedBy: metadata.lastModifiedBy,
    lastModifiedAt: metadata.lastModifiedAt,
  };

  const setString = (field: string, value: string | undefined) => {
    if (value !== undefined) {
      updates[field] = trimmedOptional(value);
    }
  };

  if (input.accountType !== undefined) updates.accountType = input.accountType;
  if (input.holderType !== undefined) updates.holderType = input.holderType;
  setString("businessName", input.businessName);
  setString("taxId", input.taxId);
  setString("contactPerson", input.contactPerson);
  setString("contactPhone", input.contactPhone);
  setString("contactEmail", input.contactEmail);
  setString("firstName", input.firstName);
  setString("lastName", input.lastName);
  if (input.dateOfBirth !== undefined) updates.dateOfBirth = input.dateOfBirth;
  setString("phone", input.phone);
  setString("email", input.email);
  setString("address", input.address);
  setString("address2", input.address2);
  setString("zipCode", input.zipCode);
  setString("city", input.city);
  setString("country", input.country);
  if (input.structuredAddress !== undefined) {
    updates.structuredAddress = input.structuredAddress;
  }
  setString("cardNumber", input.cardNumber);
  if (input.pin !== undefined) updates.pin = input.pin;
  if (input.membershipTypeId !== undefined) {
    updates.membershipTypeId = input.membershipTypeId;
  }
  setString("membershipType", input.membershipType);
  if (input.registrationDate !== undefined) {
    updates.registrationDate = input.registrationDate;
  }
  if (input.expirationDate !== undefined) {
    updates.expirationDate = input.expirationDate;
  }
  if (input.status !== undefined) updates.status = input.status;
  setString("blockReason", input.blockReason);
  if (input.borrowingLimit !== undefined) {
    updates.borrowingLimit = input.borrowingLimit;
  }
  if (input.holdLimit !== undefined) updates.holdLimit = input.holdLimit;
  if (input.preferredBranch !== undefined) {
    updates.preferredBranch = input.preferredBranch;
  }
  if (input.notificationPreferences !== undefined) {
    updates.notificationPreferences = input.notificationPreferences;
  }
  setString("notes", input.notes);

  return updates;
}
