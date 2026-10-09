import {
  type LoanAgreementPlaceholder,
  parseLoanAgreementTemplateText,
} from "@v1/backend/convex/utils/loanAgreementPlaceholders";
import { formatDate } from "./format-date";
import {
  type FormatLocale,
  formatCurrency,
  formatNumber,
} from "./format-number";

export interface LoanAgreementObject {
  accessionNumber: string;
  title: string;
  conditionOut?: string;
}

/** The loan facts a loan agreement template can refer to. */
export interface LoanAgreementData {
  loanNumber: string;
  type: "incoming" | "outgoing";
  /** The other party: the lender of an incoming loan, the borrower of an outgoing one. */
  partnerName: string;
  organizationName: string;
  startDate: number;
  endDate?: number;
  currency?: string;
  insuranceValue?: number;
  terms?: string;
  objects: LoanAgreementObject[];
}

export interface LoanAgreementTemplateSection {
  heading: string;
  body: string;
}

export type LoanAgreementBlock =
  | { kind: "text"; text: string }
  | { kind: "objects"; objects: LoanAgreementObject[] };

export interface RenderedLoanAgreementSection {
  heading: string;
  blocks: LoanAgreementBlock[];
}

/** Translated wording of the built-in standard agreement. */
export interface StandardLoanAgreementLabels {
  periodHeading: string;
  startDate: string;
  endDate: string;
  objectsHeading: string;
  insuranceHeading: string;
  totalInsuranceValue: string;
  termsHeading: string;
  standardConditionsHeading: string;
  conditions: string[];
}

/**
 * The agreement used when an organization has no template of its own,
 * expressed as a template so it renders like any other. Administrators can
 * also start a new template from it.
 */
export function standardLoanAgreementSections(
  labels: StandardLoanAgreementLabels,
): LoanAgreementTemplateSection[] {
  return [
    {
      heading: labels.periodHeading,
      body: `${labels.startDate} {{loan.startDate}}\n${labels.endDate} {{loan.endDate}}`,
    },
    { heading: labels.objectsHeading, body: "{{object.list}}" },
    {
      heading: labels.insuranceHeading,
      body: `${labels.totalInsuranceValue} {{insurance.value}}`,
    },
    { heading: labels.termsHeading, body: "{{loan.terms}}" },
    {
      heading: labels.standardConditionsHeading,
      body: labels.conditions
        .map((condition, index) => `${index + 1}. ${condition}`)
        .join("\n"),
    },
  ];
}

function formatAgreementDate(timestamp: number, locale: FormatLocale) {
  return formatDate(new Date(timestamp), locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function placeholderValue(
  name: LoanAgreementPlaceholder,
  data: LoanAgreementData,
  locale: FormatLocale,
): string {
  const incoming = data.type === "incoming";
  switch (name) {
    case "loan.number":
      return data.loanNumber;
    case "loan.startDate":
      return formatAgreementDate(data.startDate, locale);
    case "loan.endDate":
      return data.endDate === undefined
        ? ""
        : formatAgreementDate(data.endDate, locale);
    case "loan.currency":
      return data.currency ?? "";
    case "loan.terms":
      return data.terms?.trim() ?? "";
    case "lender.name":
      return incoming ? data.partnerName : data.organizationName;
    case "borrower.name":
      return incoming ? data.organizationName : data.partnerName;
    case "organization.name":
      return data.organizationName;
    case "insurance.value":
      // Zero means no insurance value was entered, as on the loan page.
      if (!data.insuranceValue) return "";
      return data.currency
        ? formatCurrency(data.insuranceValue, locale, data.currency)
        : formatNumber(data.insuranceValue, locale);
    case "object.count":
      return data.objects.length === 0
        ? ""
        : formatNumber(data.objects.length, locale);
    case "object.list":
      // Inline text form (headings); section bodies render a table instead.
      return data.objects.map((object) => object.accessionNumber).join(", ");
  }
}

function fillText(text: string, data: LoanAgreementData, locale: FormatLocale) {
  const parsed = parseLoanAgreementTemplateText(text);
  if (!parsed.ok) return text;
  return parsed.tokens
    .map((token) =>
      token.kind === "text"
        ? token.text
        : placeholderValue(token.name, data, locale),
    )
    .join("");
}

function textBlock(lines: string[]): LoanAgreementBlock | null {
  const first = lines.findIndex((line) => line.trim());
  if (first === -1) return null;
  const last = lines.findLastIndex((line) => line.trim());
  const text = lines
    .slice(first, last + 1)
    .map((line) => line.trimEnd())
    .join("\n");
  return { kind: "text", text };
}

function renderBody(
  body: string,
  data: LoanAgreementData,
  locale: FormatLocale,
): LoanAgreementBlock[] {
  const blocks: LoanAgreementBlock[] = [];
  let lines: string[] = [];
  const flushText = () => {
    const block = textBlock(lines);
    if (block) blocks.push(block);
    lines = [];
  };

  for (const line of body.split("\n")) {
    const parsed = parseLoanAgreementTemplateText(line);
    if (!parsed.ok) {
      lines.push(line);
      continue;
    }
    const values = parsed.tokens.map((token) =>
      token.kind === "text" ? null : placeholderValue(token.name, data, locale),
    );
    const placeholderValues = values.filter((value) => value !== null);
    if (
      placeholderValues.length > 0 &&
      placeholderValues.every((value) => !value)
    ) {
      continue;
    }

    let current = "";
    let splitByTable = false;
    parsed.tokens.forEach((token, index) => {
      if (
        token.kind === "placeholder" &&
        token.name === "object.list" &&
        data.objects.length > 0
      ) {
        if (current.trim()) lines.push(current);
        current = "";
        splitByTable = true;
        flushText();
        blocks.push({ kind: "objects", objects: data.objects });
        return;
      }
      current += token.kind === "text" ? token.text : (values[index] ?? "");
    });
    if (!splitByTable || current.trim()) lines.push(current);
  }
  flushText();
  return blocks;
}

/**
 * Renders template sections with a loan's data. Values are formatted in the
 * given locale (the template's language). A line whose placeholders all lack
 * a value is left out, and a section left without content is omitted.
 */
export function renderLoanAgreement(
  sections: LoanAgreementTemplateSection[],
  data: LoanAgreementData,
  locale: FormatLocale,
): RenderedLoanAgreementSection[] {
  return sections.flatMap((section) => {
    const blocks = renderBody(section.body, data, locale);
    if (blocks.length === 0) return [];
    return [{ heading: fillText(section.heading, data, locale), blocks }];
  });
}
