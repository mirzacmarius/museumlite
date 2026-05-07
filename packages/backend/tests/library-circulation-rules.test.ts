import { describe, expect, test } from "vitest";
import {
  assertCheckoutEligible,
  calculateOverdueFine,
  resolveCheckoutDueDate,
} from "../convex/library/utils/circulationRules";

const day = 24 * 60 * 60 * 1000;

describe("library circulation rules", () => {
  test("resolves checkout due date from item, membership, settings, then fallback", () => {
    const now = Date.UTC(2026, 0, 1);

    expect(
      resolveCheckoutDueDate({
        now,
        item: { isCirculating: true, loanPeriodDays: 21 },
        membershipType: { loanPeriodDays: 28 },
        settings: {
          defaultLoanPeriodDays: 14,
          fineThresholdForBlock: undefined,
        },
      }),
    ).toBe(now + 21 * day);

    expect(
      resolveCheckoutDueDate({
        now,
        item: { isCirculating: true, loanPeriodDays: undefined },
        membershipType: { loanPeriodDays: 28 },
        settings: {
          defaultLoanPeriodDays: 14,
          fineThresholdForBlock: undefined,
        },
      }),
    ).toBe(now + 28 * day);

    expect(
      resolveCheckoutDueDate({
        now,
        item: { isCirculating: true, loanPeriodDays: undefined },
        membershipType: null,
        settings: {
          defaultLoanPeriodDays: 14,
          fineThresholdForBlock: undefined,
        },
      }),
    ).toBe(now + 14 * day);

    expect(
      resolveCheckoutDueDate({
        now,
        item: { isCirculating: true, loanPeriodDays: undefined },
        membershipType: null,
        settings: null,
      }),
    ).toBe(now + 14 * day);
  });

  test("honors explicit checkout due date", () => {
    const requestedDueDate = Date.UTC(2026, 1, 15);

    expect(
      resolveCheckoutDueDate({
        requestedDueDate,
        now: Date.UTC(2026, 0, 1),
        item: { isCirculating: true, loanPeriodDays: 21 },
        membershipType: { loanPeriodDays: 28 },
        settings: {
          defaultLoanPeriodDays: 14,
          fineThresholdForBlock: undefined,
        },
      }),
    ).toBe(requestedDueDate);
  });

  test("rejects checkout when account, copy, item, fine, or borrowing rules block it", () => {
    const eligibleCheckout = {
      account: {
        accountType: "patron" as const,
        status: "active" as const,
        fineBalance: 0,
        borrowingLimit: 2,
      },
      settings: {
        defaultLoanPeriodDays: 14,
        fineThresholdForBlock: 10,
      },
      activeCheckoutCount: 1,
      copy: { status: "available" as const },
      item: { isCirculating: true, loanPeriodDays: 14 },
    };

    expect(() => assertCheckoutEligible(eligibleCheckout)).not.toThrow();
    expect(() =>
      assertCheckoutEligible({
        ...eligibleCheckout,
        account: { ...eligibleCheckout.account, status: "suspended" },
      }),
    ).toThrow("Cannot checkout: Account status is suspended");
    expect(() =>
      assertCheckoutEligible({
        ...eligibleCheckout,
        account: { ...eligibleCheckout.account, fineBalance: 10 },
      }),
    ).toThrow("Cannot checkout: Account has outstanding fines of $10.00");
    expect(() =>
      assertCheckoutEligible({
        ...eligibleCheckout,
        activeCheckoutCount: 2,
      }),
    ).toThrow("Account has reached borrowing limit of 2");
    expect(() =>
      assertCheckoutEligible({
        ...eligibleCheckout,
        copy: { status: "checked_out" },
      }),
    ).toThrow("Copy is not available (status: checked_out)");
    expect(() =>
      assertCheckoutEligible({
        ...eligibleCheckout,
        item: { isCirculating: false, loanPeriodDays: 14 },
      }),
    ).toThrow("This item is for reference only and cannot be checked out");
  });

  test("calculates checkin overdue fine after grace period", () => {
    const dueDate = Date.UTC(2026, 0, 1);

    expect(
      calculateOverdueFine({
        now: dueDate + 4 * day,
        dueDate,
        finePerDay: 0.5,
        gracePeriodDays: 1,
      }),
    ).toBe(1.5);

    expect(
      calculateOverdueFine({
        now: dueDate + day,
        dueDate,
        finePerDay: 0.5,
        gracePeriodDays: 1,
      }),
    ).toBeUndefined();

    expect(
      calculateOverdueFine({
        now: dueDate + 4 * day,
        dueDate,
        finePerDay: 0,
        gracePeriodDays: 1,
      }),
    ).toBeUndefined();
  });
});
