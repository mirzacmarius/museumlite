import { use } from "react";
import type { FormatLocale } from "@/lib/format-number";
import {
  loadAgreementDictionary,
  loanAgreementLabels,
} from "@/lib/loan-agreement-labels";

/**
 * The fixed wording of a loan agreement in the given language. Suspends while
 * that language's translations load, so render it inside a Suspense boundary.
 */
export function useLoanAgreementLabels(language: FormatLocale) {
  return loanAgreementLabels(use(loadAgreementDictionary(language)));
}
