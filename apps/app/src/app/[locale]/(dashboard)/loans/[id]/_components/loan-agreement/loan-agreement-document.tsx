"use client";

import type { RefObject } from "react";
import { LoanAgreementSections } from "@/components/loan-agreement-sections";
import type { FormatLocale } from "@/lib/format-number";
import type { RenderedLoanAgreementSection } from "@/lib/loan-agreement-template";
import { useI18n } from "@/locales/client";
import { LoanAgreementParties } from "./loan-agreement-parties";
import type { LoanAgreementLoan } from "./types";

interface LoanAgreementDocumentProps {
  printRef: RefObject<HTMLDivElement | null>;
  loan: LoanAgreementLoan;
  organizationName: string;
  /** Language the template is written in. */
  language: FormatLocale;
  sections: RenderedLoanAgreementSection[];
}

function SignatureBlock({ heading }: { heading: string }) {
  const tRoot = useI18n();
  return (
    <div>
      <p className="font-bold mb-16">{heading}</p>
      <div className="border-t border-black pt-2">
        <p>{tRoot("untranslatedRecords.loans.agreement.signature")}</p>
      </div>
      <div className="mt-8 border-t border-black pt-2">
        <p>{tRoot("untranslatedRecords.loans.agreement.nameTitle")}</p>
      </div>
      <div className="mt-8 border-t border-black pt-2">
        <p>{tRoot("deaccessions.report.date")}</p>
      </div>
    </div>
  );
}

export function LoanAgreementDocument({
  printRef,
  loan,
  organizationName,
  language,
  sections,
}: LoanAgreementDocumentProps) {
  const tRoot = useI18n();
  return (
    <div
      ref={printRef}
      lang={language}
      className="bg-white text-black p-8 rounded border"
      style={{ fontFamily: "serif" }}
    >
      <div className="text-center mb-8">
        <h1 className="text-2xl font-semibold mb-2">
          {tRoot("untranslatedRecords.loans.agreement.title")}
        </h1>
        <p className="text-lg">
          {tRoot("untranslatedRecords.loans.agreement.number")}{" "}
          {loan.loanNumber}
        </p>
      </div>

      <LoanAgreementParties loan={loan} organizationName={organizationName} />

      <LoanAgreementSections sections={sections} firstNumber={2} />

      <div className="mt-16">
        <h2 className="text-lg font-semibold border-b border-black pb-1 mb-8">
          {tRoot("untranslatedRecords.loans.agreement.signatures")}
        </h2>
        <div className="grid grid-cols-2 gap-16">
          <SignatureBlock
            heading={tRoot("untranslatedRecords.loans.agreement.forLender")}
          />
          <SignatureBlock
            heading={tRoot("untranslatedRecords.loans.agreement.forBorrower")}
          />
        </div>
      </div>
    </div>
  );
}
