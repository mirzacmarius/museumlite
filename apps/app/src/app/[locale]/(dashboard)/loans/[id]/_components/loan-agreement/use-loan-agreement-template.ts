"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { useQuery } from "convex/react";
import { useState } from "react";
import { useStandardLoanAgreementSections } from "@/hooks/use-standard-loan-agreement-sections";
import { renderLoanAgreement } from "@/lib/loan-agreement-template";
import { useCurrentLocale } from "@/locales/client";
import type { LoanAgreementItem, LoanAgreementLoan } from "./types";

/** Select value for the built-in standard agreement. */
export const STANDARD_AGREEMENT = "standard";

interface UseLoanAgreementTemplateOptions {
  loanId: Id<"loans">;
  loan: LoanAgreementLoan;
  items: LoanAgreementItem[];
  organizationName: string;
}

/**
 * Offers the organization's templates for this loan, preselects the default,
 * and renders the chosen one (or the standard agreement) with the loan's data.
 */
export function useLoanAgreementTemplate({
  loanId,
  loan,
  items,
  organizationName,
}: UseLoanAgreementTemplateOptions) {
  const locale = useCurrentLocale();
  const offer = useQuery(api.loanAgreementTemplates.listForLoan, { loanId });
  const standardSections = useStandardLoanAgreementSections();
  const [choice, setChoice] = useState<string | null>(null);

  const templates = offer?.templates ?? [];
  const findTemplate = (id: string | null | undefined) =>
    templates.find((template) => template._id === id);
  const selected =
    choice === STANDARD_AGREEMENT
      ? undefined
      : (findTemplate(choice) ?? findTemplate(offer?.defaultTemplateId));
  const language = selected?.language ?? locale;

  const sections = renderLoanAgreement(
    selected?.sections ?? standardSections,
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

  return {
    isLoading: offer === undefined,
    templates,
    selectedValue: selected?._id ?? STANDARD_AGREEMENT,
    selectTemplate: setChoice,
    language,
    sections,
  };
}
