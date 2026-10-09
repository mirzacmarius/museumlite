import type { FormatLocale } from "./format-number";
import type { StandardLoanAgreementLabels } from "./loan-agreement-template";

type AgreementKey =
  | "title"
  | "number"
  | "parties"
  | "borrower"
  | "email"
  | "phone"
  | "accessionNumber"
  | "titleDescription"
  | "signatures"
  | "forLender"
  | "forBorrower"
  | "signature"
  | "nameTitle"
  | "period"
  | "startDate"
  | "endDate"
  | "objectsOnLoan"
  | "insurance"
  | "totalInsuranceValue"
  | "termsConditions"
  | "standardConditions"
  | "borrowerCare"
  | "noTreatment"
  | "safeEnvironment"
  | "noReproduction"
  | "inspection"
  | "reportDamage"
  | "returnCondition";

/** The part of a locale dictionary an agreement is worded from. */
interface Dictionary {
  untranslatedRecords: {
    loans: {
      agreement: Record<AgreementKey, string>;
      items: { lenderUpper: string; museumUpper: string };
    };
  };
  accounts: { list: { contact: string } };
  loans: { actions: { condition: string } };
  deaccessions: { report: { date: string } };
}

// The same lazily loaded locale chunks next-international uses for the UI.
const loaders: Record<FormatLocale, () => Promise<Dictionary>> = {
  en: () => import("@/locales/en").then((module) => module.default),
  es: () => import("@/locales/es").then((module) => module.default),
  fr: () => import("@/locales/fr").then((module) => module.default),
  no: () => import("@/locales/no").then((module) => module.default),
  ro: () => import("@/locales/ro").then((module) => module.default),
};

const dictionaries = new Map<FormatLocale, Promise<Dictionary>>();

/** Loads, once per language, the translations an agreement is printed in. */
export function loadAgreementDictionary(language: FormatLocale) {
  let dictionary = dictionaries.get(language);
  if (!dictionary) {
    dictionary = loaders[language]();
    dictionaries.set(language, dictionary);
  }
  return dictionary;
}

/** Fixed wording of a loan agreement, in the agreement's own language. */
export interface LoanAgreementLabels {
  title: string;
  number: string;
  parties: string;
  lender: string;
  museum: string;
  borrower: string;
  contact: string;
  email: string;
  phone: string;
  accessionNumber: string;
  titleDescription: string;
  condition: string;
  signatures: string;
  forLender: string;
  forBorrower: string;
  signature: string;
  nameTitle: string;
  date: string;
  standard: StandardLoanAgreementLabels;
}

export function loanAgreementLabels(
  dictionary: Dictionary,
): LoanAgreementLabels {
  const agreement = dictionary.untranslatedRecords.loans.agreement;
  const items = dictionary.untranslatedRecords.loans.items;
  return {
    title: agreement.title,
    number: agreement.number,
    parties: agreement.parties,
    lender: items.lenderUpper,
    museum: items.museumUpper,
    borrower: agreement.borrower,
    contact: dictionary.accounts.list.contact,
    email: agreement.email,
    phone: agreement.phone,
    accessionNumber: agreement.accessionNumber,
    titleDescription: agreement.titleDescription,
    condition: dictionary.loans.actions.condition,
    signatures: agreement.signatures,
    forLender: agreement.forLender,
    forBorrower: agreement.forBorrower,
    signature: agreement.signature,
    nameTitle: agreement.nameTitle,
    date: dictionary.deaccessions.report.date,
    standard: {
      periodHeading: agreement.period,
      startDate: agreement.startDate,
      endDate: agreement.endDate,
      objectsHeading: agreement.objectsOnLoan,
      insuranceHeading: agreement.insurance,
      totalInsuranceValue: agreement.totalInsuranceValue,
      termsHeading: agreement.termsConditions,
      standardConditionsHeading: agreement.standardConditions,
      conditions: [
        agreement.borrowerCare,
        agreement.noTreatment,
        agreement.safeEnvironment,
        agreement.noReproduction,
        agreement.inspection,
        agreement.reportDamage,
        agreement.returnCondition,
      ],
    },
  };
}
