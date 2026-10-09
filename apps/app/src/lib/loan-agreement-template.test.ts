import { expect, test } from "vitest";
import {
  type LoanAgreementData,
  renderLoanAgreement,
  standardLoanAgreementSections,
} from "./loan-agreement-template";

// Noon UTC keeps the calendar date stable in every test-runner time zone.
const outgoingLoan: LoanAgreementData = {
  loanNumber: "LN-2026-004",
  type: "outgoing",
  partnerName: "Harbour Gallery",
  organizationName: "City Museum",
  startDate: Date.UTC(2026, 0, 15, 12),
  objects: [],
};

function bodyText(
  body: string,
  data: LoanAgreementData,
  locale: "en" | "fr" = "en",
) {
  const [section] = renderLoanAgreement([{ heading: "", body }], data, locale);
  return section?.blocks;
}

test("loan facts are formatted in the template's language and the loan's currency", () => {
  const loan: LoanAgreementData = {
    ...outgoingLoan,
    endDate: Date.UTC(2026, 5, 30, 12),
    currency: "EUR",
    insuranceValue: 250000,
    terms: "Courier required.",
  };
  const body =
    "{{loan.number}} runs from {{loan.startDate}} to {{loan.endDate}}, insured for {{insurance.value}} ({{loan.currency}}). {{loan.terms}} Issued by {{organization.name}}.";

  expect(bodyText(body, loan)).toEqual([
    {
      kind: "text",
      text: "LN-2026-004 runs from January 15, 2026 to June 30, 2026, insured for €250,000.00 (EUR). Courier required. Issued by City Museum.",
    },
  ]);
  expect(bodyText("{{loan.startDate}}", loan, "fr")).toEqual([
    { kind: "text", text: "15 janvier 2026" },
  ]);
});

test("an insurance value without a recorded currency is shown as a plain number", () => {
  expect(
    bodyText("Value: {{insurance.value}}", {
      ...outgoingLoan,
      insuranceValue: 250000,
    }),
  ).toEqual([{ kind: "text", text: "Value: 250,000" }]);
});

test("lines whose placeholders have no value are left out, and so are emptied sections", () => {
  const sections = [
    {
      heading: "Loan period",
      body: "Start date: {{loan.startDate}}\nEnd date: {{loan.endDate}}\nOpen-ended loans are reviewed yearly.",
    },
    { heading: "Insurance", body: "Insured for {{insurance.value}}." },
  ];

  expect(renderLoanAgreement(sections, outgoingLoan, "en")).toEqual([
    {
      heading: "Loan period",
      blocks: [
        {
          kind: "text",
          text: "Start date: January 15, 2026\nOpen-ended loans are reviewed yearly.",
        },
      ],
    },
  ]);
});

test("the object list becomes a table between the surrounding text", () => {
  const objects = [
    {
      accessionNumber: "1998.4.1",
      title: "Harbour at dusk",
      conditionOut: "Good",
    },
    { accessionNumber: "2003.12.7", title: "Fishing boat model" },
  ];

  expect(
    bodyText(
      "The following {{object.count}} objects are lent:\n{{object.list}}\nThey travel together.",
      { ...outgoingLoan, objects },
    ),
  ).toEqual([
    { kind: "text", text: "The following 2 objects are lent:" },
    { kind: "objects", objects },
    { kind: "text", text: "They travel together." },
  ]);
});

test("a loan without objects gets no object table, even beside other values", () => {
  expect(
    bodyText("Loan {{loan.number}}: {{object.list}}", outgoingLoan),
  ).toEqual([{ kind: "text", text: "Loan LN-2026-004:" }]);
});

test("an insurance value of zero counts as not insured", () => {
  expect(
    renderLoanAgreement(
      [{ heading: "Insurance", body: "Insured for {{insurance.value}}." }],
      { ...outgoingLoan, currency: "EUR", insuranceValue: 0 },
      "en",
    ),
  ).toEqual([]);
});

const standardLabels = {
  periodHeading: "LOAN PERIOD",
  startDate: "Start Date:",
  endDate: "End Date:",
  objectsHeading: "OBJECTS ON LOAN",
  insuranceHeading: "INSURANCE",
  totalInsuranceValue: "Total Insurance Value:",
  termsHeading: "TERMS AND CONDITIONS",
  standardConditionsHeading: "STANDARD CONDITIONS",
  conditions: ["Handle with care.", "Report damage immediately."],
};

test("the built-in standard agreement keeps only the sections a loan has data for", () => {
  const template = standardLoanAgreementSections(standardLabels);

  const minimal = renderLoanAgreement(template, outgoingLoan, "en");
  const full = renderLoanAgreement(
    template,
    {
      ...outgoingLoan,
      currency: "USD",
      insuranceValue: 1000,
      terms: "Courier required.",
      objects: [{ accessionNumber: "1998.4.1", title: "Harbour at dusk" }],
    },
    "en",
  );

  expect(minimal.map((section) => section.heading)).toEqual([
    "LOAN PERIOD",
    "STANDARD CONDITIONS",
  ]);
  expect(full.map((section) => section.heading)).toEqual([
    "LOAN PERIOD",
    "OBJECTS ON LOAN",
    "INSURANCE",
    "TERMS AND CONDITIONS",
    "STANDARD CONDITIONS",
  ]);
  expect(full[2]?.blocks).toEqual([
    { kind: "text", text: "Total Insurance Value: $1,000.00" },
  ]);
  expect(full[4]?.blocks).toEqual([
    {
      kind: "text",
      text: "1. Handle with care.\n2. Report damage immediately.",
    },
  ]);
});

test("lender and borrower follow the loan's direction", () => {
  const sections = [
    {
      heading: "Parties",
      body: "Lender: {{lender.name}}\nBorrower: {{borrower.name}}",
    },
  ];

  expect(renderLoanAgreement(sections, outgoingLoan, "en")).toEqual([
    {
      heading: "Parties",
      blocks: [
        {
          kind: "text",
          text: "Lender: City Museum\nBorrower: Harbour Gallery",
        },
      ],
    },
  ]);
  expect(
    renderLoanAgreement(sections, { ...outgoingLoan, type: "incoming" }, "en"),
  ).toEqual([
    {
      heading: "Parties",
      blocks: [
        {
          kind: "text",
          text: "Lender: Harbour Gallery\nBorrower: City Museum",
        },
      ],
    },
  ]);
});
