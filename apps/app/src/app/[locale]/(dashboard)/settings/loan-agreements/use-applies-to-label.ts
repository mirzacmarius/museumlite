import { useScopedI18n } from "@/locales/client";
import type { TemplateLoanType } from "./template-options";

export function useAppliesToLabel() {
  const t = useScopedI18n("loanAgreementTemplates.appliesTo");
  const labels: Record<TemplateLoanType, string> = {
    any: t("any"),
    incoming: t("incoming"),
    outgoing: t("outgoing"),
  };
  return (loanType: TemplateLoanType) => labels[loanType];
}
