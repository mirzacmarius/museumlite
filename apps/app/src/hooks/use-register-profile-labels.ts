import type { RegisterProfile } from "@v1/backend/convex/utils/registerProfiles";
import { useScopedI18n } from "@/locales/client";

/** Translated names of the register and report export profiles. */
export function useRegisterProfileLabels(): Record<RegisterProfile, string> {
  const t = useScopedI18n("registerReports");
  return {
    accession: t("profileAccession"),
    disposal: t("profileDisposal"),
    custody: t("profileCustody"),
    condition: t("profileCondition"),
    valuation: t("profileValuation"),
    insurance: t("profileInsurance"),
    provenance: t("profileProvenance"),
  };
}
