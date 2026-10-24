import {
  type OrganizationAddressLine,
  organizationContactErrorFromError,
} from "@v1/backend/convex/utils/organizationContact";
import { useScopedI18n } from "@/locales/client";

/** Label of each address line and the phone, under `settings.organization`. */
export const CONTACT_FIELD_LABELS = {
  street: "streetAddressLabel",
  street2: "addressLine2Label",
  postalCode: "postalCodeLabel",
  city: "cityLabel",
  region: "regionLabel",
  country: "countryLabel",
  phone: "phoneLabel",
} as const satisfies Record<OrganizationAddressLine | "phone", string>;

/**
 * Translates a refused Organization address or phone, naming the field to
 * shorten. Returns null for any other failure so callers keep their own
 * handling.
 */
export function useOrganizationContactErrorMessage() {
  const t = useScopedI18n("settings.organization");
  return (error: unknown): string | null => {
    const refusal = organizationContactErrorFromError(error);
    if (!refusal) return null;
    return t("contactFieldTooLong", {
      field: t(CONTACT_FIELD_LABELS[refusal.field]),
      limit: refusal.limit,
    });
  };
}
