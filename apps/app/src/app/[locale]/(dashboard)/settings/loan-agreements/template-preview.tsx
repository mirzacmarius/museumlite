"use client";

import { LoanAgreementSections } from "@/components/loan-agreement-sections";
import { useLoanAgreementLabels } from "@/hooks/use-loan-agreement-labels";
import {
  type LoanAgreementData,
  type LoanAgreementTemplateSection,
  renderLoanAgreement,
} from "@/lib/loan-agreement-template";
import { useScopedI18n } from "@/locales/client";
import type { TemplateLanguage, TemplateLoanType } from "./template-options";

const SAMPLE_LOAN_NUMBER = "LN-2026-001";

interface TemplatePreviewProps {
  sections: LoanAgreementTemplateSection[];
  language: TemplateLanguage;
  loanType: TemplateLoanType;
  organizationName: string;
}

/**
 * The template rendered with a sample loan in the template's language,
 * numbered as in a real agreement. Suspends while that language loads.
 */
export function TemplatePreview({
  sections,
  language,
  loanType,
  organizationName,
}: TemplatePreviewProps) {
  const t = useScopedI18n("loanAgreementTemplates.sample");
  const labels = useLoanAgreementLabels(language);
  const sampleLoan: LoanAgreementData = {
    loanNumber: SAMPLE_LOAN_NUMBER,
    type: loanType === "incoming" ? "incoming" : "outgoing",
    partnerName: t("partnerName"),
    organizationName,
    startDate: Date.UTC(2026, 2, 1, 12),
    endDate: Date.UTC(2026, 8, 30, 12),
    currency: "EUR",
    insuranceValue: 250000,
    terms: t("terms"),
    objects: [
      {
        accessionNumber: "1998.4.1",
        title: t("firstObject"),
        conditionOut: t("condition"),
      },
      {
        accessionNumber: "2003.12.7",
        title: t("secondObject"),
        conditionOut: t("condition"),
      },
    ],
  };
  const rendered = renderLoanAgreement(sections, sampleLoan, language);

  return (
    <div
      lang={language}
      className="rounded border bg-white p-6 text-sm text-black"
      style={{ fontFamily: "serif" }}
    >
      <div className="mb-6 text-center">
        <p className="text-lg font-semibold">{labels.title}</p>
        <p>
          {labels.number} {SAMPLE_LOAN_NUMBER}
        </p>
      </div>
      <LoanAgreementSections
        sections={rendered}
        firstNumber={2}
        labels={labels}
      />
    </div>
  );
}
