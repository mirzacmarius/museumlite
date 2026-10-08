import { v } from "convex/values";

/** Keeps a template document well under Convex's 1 MB document limit. */
export const LOAN_AGREEMENT_TEMPLATE_LIMITS = {
  nameLength: 120,
  sections: 30,
  headingLength: 200,
  bodyLength: 20_000,
} as const;

/** Languages a loan agreement template can be written in (the app locales). */
export const loanAgreementLanguageValidator = v.union(
  v.literal("en"),
  v.literal("es"),
  v.literal("fr"),
  v.literal("no"),
  v.literal("ro"),
);

/** Loan direction a template applies to; "any" covers both directions. */
export const loanAgreementLoanTypeValidator = v.union(
  v.literal("any"),
  v.literal("incoming"),
  v.literal("outgoing"),
);

export const loanAgreementSectionValidator = v.object({
  heading: v.string(),
  body: v.string(),
});

export const loanAgreementTemplateStatusValidator = v.union(
  v.literal("active"),
  v.literal("archived"),
);

export const loanAgreementTemplateFields = {
  organizationId: v.id("organizations"),
  name: v.string(),
  language: loanAgreementLanguageValidator,
  loanType: loanAgreementLoanTypeValidator,
  sections: v.array(loanAgreementSectionValidator),
  isDefault: v.boolean(),
  status: loanAgreementTemplateStatusValidator,
  createdBy: v.id("users"),
  createdAt: v.number(),
  updatedBy: v.optional(v.id("users")),
  updatedAt: v.optional(v.number()),
  archivedBy: v.optional(v.id("users")),
  archivedAt: v.optional(v.number()),
};
