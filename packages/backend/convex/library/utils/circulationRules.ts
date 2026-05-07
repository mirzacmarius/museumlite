import type { Doc } from "../../_generated/dataModel";

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

type CheckoutAccount = Pick<
  Doc<"accounts">,
  "accountType" | "status" | "fineBalance" | "borrowingLimit"
>;

type CheckoutSettings = Pick<
  Doc<"librarySettings">,
  "fineThresholdForBlock" | "defaultLoanPeriodDays"
>;

type CheckoutCopy = Pick<Doc<"itemCopies">, "status">;

type CheckoutItem = Pick<
  Doc<"libraryItems">,
  "isCirculating" | "loanPeriodDays"
>;

type CheckoutMembershipType = Pick<Doc<"membershipTypes">, "loanPeriodDays">;

interface CheckoutEligibilityInput {
  account: CheckoutAccount;
  settings: CheckoutSettings | null;
  activeCheckoutCount: number;
  copy: CheckoutCopy;
  item: CheckoutItem;
}

interface FineThresholdInput {
  account: CheckoutAccount;
  settings: CheckoutSettings | null;
}

interface BorrowingLimitInput {
  account: CheckoutAccount;
  activeCheckoutCount: number;
}

interface ResolveCheckoutDueDateInput {
  requestedDueDate?: number;
  now: number;
  item: CheckoutItem;
  membershipType?: CheckoutMembershipType | null;
  settings: CheckoutSettings | null;
}

interface CalculateOverdueFineInput {
  now: number;
  dueDate: number;
  finePerDay: number;
  gracePeriodDays: number;
}

export function assertCheckoutEligible(input: CheckoutEligibilityInput) {
  const { account, settings, activeCheckoutCount, copy, item } = input;

  assertPatronAccountCanCheckout(account);
  assertFineThresholdAllowsCheckout({ account, settings });
  assertBorrowingLimitAllowsCheckout({ account, activeCheckoutCount });
  assertCopyAvailable(copy);
  assertItemCanCirculate(item);
}

export function assertPatronAccountCanCheckout(account: CheckoutAccount) {
  if (account.accountType !== "patron") {
    throw new Error("Only patron accounts can checkout library items");
  }

  if (account.status !== "active") {
    throw new Error(`Cannot checkout: Account status is ${account.status}`);
  }
}

export function assertFineThresholdAllowsCheckout({
  account,
  settings,
}: FineThresholdInput) {
  if (
    settings?.fineThresholdForBlock &&
    account.fineBalance &&
    account.fineBalance >= settings.fineThresholdForBlock
  ) {
    throw new Error(
      `Cannot checkout: Account has outstanding fines of $${account.fineBalance.toFixed(2)}`,
    );
  }
}

export function assertBorrowingLimitAllowsCheckout({
  account,
  activeCheckoutCount,
}: BorrowingLimitInput) {
  const borrowingLimit = account.borrowingLimit ?? 10;
  if (activeCheckoutCount >= borrowingLimit) {
    throw new Error(`Account has reached borrowing limit of ${borrowingLimit}`);
  }
}

export function assertCopyAvailable(copy: CheckoutCopy) {
  if (copy.status !== "available") {
    throw new Error(`Copy is not available (status: ${copy.status})`);
  }
}

export function assertItemCanCirculate(item: CheckoutItem) {
  if (!item.isCirculating) {
    throw new Error(
      "This item is for reference only and cannot be checked out",
    );
  }
}

export function resolveCheckoutDueDate(input: ResolveCheckoutDueDateInput) {
  if (input.requestedDueDate) {
    return input.requestedDueDate;
  }

  const loanPeriodDays =
    input.item.loanPeriodDays ||
    input.membershipType?.loanPeriodDays ||
    input.settings?.defaultLoanPeriodDays ||
    14;

  return input.now + loanPeriodDays * MILLISECONDS_PER_DAY;
}

export function calculateOverdueFine(input: CalculateOverdueFineInput) {
  if (input.now <= input.dueDate || input.finePerDay <= 0) {
    return undefined;
  }

  const overdueDays = Math.ceil(
    (input.now - input.dueDate) / MILLISECONDS_PER_DAY,
  );
  const billableDays = Math.max(0, overdueDays - input.gracePeriodDays);
  if (billableDays <= 0) {
    return undefined;
  }

  return billableDays * input.finePerDay;
}
