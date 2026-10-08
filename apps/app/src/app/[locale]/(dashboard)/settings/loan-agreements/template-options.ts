import type { Doc } from "@v1/backend/convex/_generated/dataModel";

export type LoanAgreementTemplate = Doc<"loanAgreementTemplates">;
export type TemplateLanguage = LoanAgreementTemplate["language"];
export type TemplateLoanType = LoanAgreementTemplate["loanType"];

/** Languages are shown by their own names, as in the language switcher. */
export const TEMPLATE_LANGUAGE_NAMES: Record<TemplateLanguage, string> = {
  en: "English",
  fr: "Français",
  es: "Español",
  no: "Norsk",
  ro: "Română",
};

export const TEMPLATE_LANGUAGES = Object.keys(
  TEMPLATE_LANGUAGE_NAMES,
) as TemplateLanguage[];

export const TEMPLATE_LOAN_TYPES: TemplateLoanType[] = [
  "any",
  "outgoing",
  "incoming",
];
