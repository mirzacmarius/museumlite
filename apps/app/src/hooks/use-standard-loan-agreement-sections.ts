import { standardLoanAgreementSections } from "@/lib/loan-agreement-template";
import { useScopedI18n } from "@/locales/client";

/** The built-in standard agreement, worded in the current UI language. */
export function useStandardLoanAgreementSections() {
  const t = useScopedI18n("untranslatedRecords.loans.agreement");
  return standardLoanAgreementSections({
    periodHeading: t("period"),
    startDate: t("startDate"),
    endDate: t("endDate"),
    objectsHeading: t("objectsOnLoan"),
    insuranceHeading: t("insurance"),
    totalInsuranceValue: t("totalInsuranceValue"),
    termsHeading: t("termsConditions"),
    standardConditionsHeading: t("standardConditions"),
    conditions: [
      t("borrowerCare"),
      t("noTreatment"),
      t("safeEnvironment"),
      t("noReproduction"),
      t("inspection"),
      t("reportDamage"),
      t("returnCondition"),
    ],
  });
}
