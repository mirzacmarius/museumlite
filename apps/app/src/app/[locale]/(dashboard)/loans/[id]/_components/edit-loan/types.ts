import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { isLoanCurrencyCode } from "@v1/backend/convex/utils/loanCurrency";
import { z } from "zod";
import type { Loan } from "../types";

/** Loan edit input; dates are epoch milliseconds so input can be stored. */
export interface EditLoanFormData {
  lenderBorrowerName: string;
  lenderBorrowerContact: string;
  startDate: number;
  endDate: number | null;
  terms: string;
  insuranceValue: string;
  currency: string;
  notes: string;
}

export type EditLoanField = keyof EditLoanFormData;

export const EMPTY_EDIT_LOAN_FORM: EditLoanFormData = {
  lenderBorrowerName: "",
  lenderBorrowerContact: "",
  startDate: 0,
  endDate: null,
  terms: "",
  insuranceValue: "",
  currency: "",
  notes: "",
};

export function editLoanFormValues(loan: Loan): EditLoanFormData {
  return {
    lenderBorrowerName: loan.lenderBorrowerName || "",
    lenderBorrowerContact: loan.lenderBorrowerContact || "",
    startDate: loan.startDate,
    endDate: loan.endDate ?? null,
    terms: loan.terms || "",
    insuranceValue: loan.insuranceValue?.toString() || "",
    currency: loan.currency ?? "",
    notes: loan.notes || "",
  };
}

/** The values staff see; an amount compares by value, not by its spelling. */
export function comparableEditLoanForm(
  values: EditLoanFormData,
): Record<string, unknown> {
  const amount = values.insuranceValue.trim();
  return {
    ...values,
    insuranceValue:
      amount && Number.isFinite(Number(amount)) ? Number(amount) : amount,
    currency: values.currency.trim().toUpperCase(),
  };
}

const editLoanFormSchema = z.object({
  lenderBorrowerName: z.string(),
  lenderBorrowerContact: z.string(),
  startDate: z.number(),
  endDate: z.number().nullable(),
  terms: z.string(),
  insuranceValue: z.string(),
  currency: z.string(),
  notes: z.string(),
});

export function parseEditLoanForm(stored: unknown): EditLoanFormData | null {
  const parsed = editLoanFormSchema.safeParse(stored);
  return parsed.success ? parsed.data : null;
}

function parseAmount(value: string) {
  const amount = value.trim();
  if (!amount) return null;
  const parsed = Number(amount);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

/** Client-side checks; `loans.update` applies the same rules. */
export function validateEditLoanForm(
  values: EditLoanFormData,
  messages: {
    required: (field: EditLoanField) => string;
    dateOrder: string;
    amount: string;
    currency: string;
  },
): Partial<Record<EditLoanField, string>> {
  const errors: Partial<Record<EditLoanField, string>> = {};
  if (!values.lenderBorrowerName.trim())
    errors.lenderBorrowerName = messages.required("lenderBorrowerName");
  if (values.endDate !== null && values.endDate < values.startDate)
    errors.endDate = messages.dateOrder;
  if (parseAmount(values.insuranceValue) === undefined)
    errors.insuranceValue = messages.amount;
  const currency = values.currency.trim();
  if (currency && !isLoanCurrencyCode(currency))
    errors.currency = messages.currency;
  return errors;
}

/** The `loans.update` arguments for the fields staff changed. */
export function editLoanPatch(
  loanId: Id<"loans">,
  values: EditLoanFormData,
  changedFields: string[],
) {
  const changed = new Set(changedFields);
  return {
    loanId,
    ...(changed.has("lenderBorrowerName") && {
      lenderBorrowerName: values.lenderBorrowerName,
    }),
    ...(changed.has("lenderBorrowerContact") && {
      lenderBorrowerContact: values.lenderBorrowerContact,
    }),
    ...(changed.has("startDate") && { startDate: values.startDate }),
    ...(changed.has("endDate") && { endDate: values.endDate }),
    ...(changed.has("terms") && { terms: values.terms }),
    ...(changed.has("insuranceValue") && {
      insuranceValue: parseAmount(values.insuranceValue) ?? null,
    }),
    // An empty currency clears a previously recorded one.
    ...(changed.has("currency") && { currency: values.currency.trim() }),
    ...(changed.has("notes") && { notes: values.notes }),
  };
}
