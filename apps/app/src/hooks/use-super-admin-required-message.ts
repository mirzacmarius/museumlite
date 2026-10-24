import { isSuperAdminRequiredError } from "@v1/backend/convex/utils/superAdmins";
import { useScopedI18n } from "@/locales/client";

/**
 * Translates the refusal of a change only a SuperAdmin may make, such as
 * giving someone the SuperAdmin role. Returns null for any other failure so
 * callers keep their own handling.
 */
export function useSuperAdminRequiredMessage() {
  const t = useScopedI18n("users");
  return (error: unknown): string | null =>
    isSuperAdminRequiredError(error) ? t("superAdminRequired") : null;
}
