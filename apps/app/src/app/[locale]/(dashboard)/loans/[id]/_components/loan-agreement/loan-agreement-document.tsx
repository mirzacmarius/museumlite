"use client";

import type { Doc } from "@v1/backend/convex/_generated/dataModel";
import type { RefObject } from "react";
import { LoanAgreementSections } from "@/components/loan-agreement-sections";
import { useLoanAgreementLabels } from "@/hooks/use-loan-agreement-labels";
import {
  renderLoanAgreement,
  standardLoanAgreementSections,
} from "@/lib/loan-agreement-template";
import { useCurrentLocale } from "@/locales/client";
import { LoanAgreementParties } from "./loan-agreement-parties";
import type { LoanAgreementItem, LoanAgreementLoan } from "./types";

interface LoanAgreementDocumentProps {
  printRef: RefObject<HTMLDivElement | null>;
  loan: LoanAgreementLoan;
  items: LoanAgreementItem[];
  organizationName: string;
  /** The chosen template; null renders the built-in standard agreement. */
  template: Pick<Doc<"loanAgreementTemplates">, "language" | "sections"> | null;
}

function SignatureBlock({
  heading,
  signature,
  nameTitle,
  date,
}: {
  heading: string;
  signature: string;
  nameTitle: string;
  date: string;
}) {
  return (
    <div>
      <p className="font-bold mb-16">{heading}</p>
      <div className="border-t border-black pt-2">
        <p>{signature}</p>
      </div>
      <div className="mt-8 border-t border-black pt-2">
        <p>{nameTitle}</p>
      </div>
      <div className="mt-8 border-t border-black pt-2">
        <p>{date}</p>
      </div>
    </div>
  );
}

/**
 * The printable agreement, written entirely in the template's language (the
 * interface language for the standard agreement). Suspends while that
 * language's wording loads.
 */
export function LoanAgreementDocument({
  printRef,
  loan,
  items,
  organizationName,
  template,
}: LoanAgreementDocumentProps) {
  const locale = useCurrentLocale();
  const language = template?.language ?? locale;
  const labels = useLoanAgreementLabels(language);
  const sections = renderLoanAgreement(
    template?.sections ?? standardLoanAgreementSections(labels.standard),
    {
      loanNumber: loan.loanNumber,
      type: loan.type,
      partnerName: loan.lenderBorrowerName,
      organizationName,
      startDate: loan.startDate,
      endDate: loan.endDate,
      currency: loan.currency,
      insuranceValue: loan.insuranceValue,
      terms: loan.terms,
      objects: items,
    },
    language,
  );
  const signatureLabels = {
    signature: labels.signature,
    nameTitle: labels.nameTitle,
    date: labels.date,
  };

  return (
    <div
      ref={printRef}
      lang={language}
      className="bg-white text-black p-8 rounded border"
      style={{ fontFamily: "serif" }}
    >
      <div className="text-center mb-8">
        <h1 className="text-2xl font-semibold mb-2">{labels.title}</h1>
        <p className="text-lg">
          {labels.number} {loan.loanNumber}
        </p>
      </div>

      <LoanAgreementParties
        loan={loan}
        organizationName={organizationName}
        labels={labels}
      />

      <LoanAgreementSections
        sections={sections}
        firstNumber={2}
        labels={labels}
      />

      <div className="mt-16">
        <h2 className="text-lg font-semibold border-b border-black pb-1 mb-8">
          {labels.signatures}
        </h2>
        <div className="grid grid-cols-2 gap-16">
          <SignatureBlock heading={labels.forLender} {...signatureLabels} />
          <SignatureBlock heading={labels.forBorrower} {...signatureLabels} />
        </div>
      </div>
    </div>
  );
}
