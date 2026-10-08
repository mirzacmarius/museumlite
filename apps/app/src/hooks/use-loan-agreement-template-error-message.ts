import {
  type LoanAgreementTemplateErrorData,
  loanAgreementTemplateErrorFromError,
} from "@v1/backend/convex/utils/loanAgreementErrors";
import { useScopedI18n } from "@/locales/client";

/**
 * Translates loan agreement template and loan currency errors. Any other
 * failure gets the translated fallback; server error text is never shown.
 */
export function useLoanAgreementTemplateErrorMessage() {
  const t = useScopedI18n("loanAgreementTemplates.errors");
  function errorMessage(error: LoanAgreementTemplateErrorData) {
    switch (error.code) {
      case "TEMPLATE_NOT_FOUND":
        return t("templateNotFound");
      case "TEMPLATE_ARCHIVED":
        return t("templateArchived");
      case "NAME_REQUIRED":
        return t("nameRequired");
      case "SECTIONS_REQUIRED":
        return t("sectionsRequired");
      case "TEMPLATE_TOO_LARGE":
        return t("templateTooLarge");
      case "UNKNOWN_PLACEHOLDER":
        return t("unknownPlaceholder", {
          placeholder: `{{${error.placeholder ?? ""}}}`,
        });
      case "MALFORMED_PLACEHOLDER":
        return t("malformedPlaceholder");
      case "INVALID_CURRENCY":
        return t("invalidCurrency");
    }
  }

  return (error: unknown, fallback?: string) => {
    const data = loanAgreementTemplateErrorFromError(error);
    if (data) return errorMessage(data);
    return fallback ?? t("fallback");
  };
}
