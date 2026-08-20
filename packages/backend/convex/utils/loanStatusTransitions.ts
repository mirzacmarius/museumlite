import type { Doc } from "../_generated/dataModel";

export type LoanStatus = Doc<"loans">["status"];

export const ALLOWED_LOAN_TRANSITIONS: Record<
  LoanStatus,
  readonly LoanStatus[]
> = {
  pending: ["active", "cancelled"],
  active: ["dispatched", "returned", "cancelled"],
  dispatched: ["returned", "cancelled"],
  returned: [],
  cancelled: [],
};

export function assertAllowedLoanTransition(
  from: LoanStatus,
  to: LoanStatus,
  message: string,
): void {
  if (from === to || !ALLOWED_LOAN_TRANSITIONS[from].includes(to)) {
    throw new Error(message);
  }
}
