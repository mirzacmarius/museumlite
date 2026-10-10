import { loanObjectErrorFromError } from "@v1/backend/convex/utils/loanObjectErrors";
import { useScopedI18n } from "@/locales/client";

/**
 * Translates refusals for objects a loan cannot take. Returns null for any
 * other failure so callers keep their own handling.
 */
export function useLoanObjectErrorMessage() {
  const t = useScopedI18n("loans.actions");
  return (error: unknown): string | null => {
    switch (loanObjectErrorFromError(error)?.code) {
      case "OBJECT_UNAVAILABLE":
        return t("doesNotBelongToOrganization");
      case "OBJECT_NOT_ACTIVE":
        return t("notActive");
      case "OBJECT_ON_ACTIVE_LOAN":
        return t("alreadyInActiveLoan");
      case undefined:
        return null;
    }
  };
}
