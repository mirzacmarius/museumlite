import { organizationDeletionErrorFromError } from "@v1/backend/convex/utils/organizationDeletionErrors";
import { useScopedI18n } from "@/locales/client";

/**
 * Translates Organization deletion and ownership refusals. Returns null for
 * any other failure so callers keep their own handling.
 */
export function useOrganizationDeletionErrorMessage() {
  const t = useScopedI18n("settings.organization.deletion.refusals");
  return (error: unknown): string | null => {
    switch (organizationDeletionErrorFromError(error)?.code) {
      case "EVIDENCE_PROTECTED":
        return t("evidenceProtected");
      case "SUB_ORGANIZATION":
        return t("subOrganization");
      case "NO_ACTIVE_DELETION":
        return t("noActiveDeletion");
      case "ALREADY_OWNER":
        return t("alreadyOwner");
      case "NEW_OWNER_NOT_SUPER_ADMIN":
        return t("newOwnerNotSuperAdmin");
      case "NEW_OWNER_NOT_MEMBER":
        return t("newOwnerNotMember");
      case undefined:
        return null;
    }
  };
}
