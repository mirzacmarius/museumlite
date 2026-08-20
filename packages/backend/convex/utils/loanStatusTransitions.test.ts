import { expect, test } from "vitest";
import { assertAllowedLoanTransition } from "./loanStatusTransitions";

test("assertAllowedLoanTransition rejects returned to active", () => {
  expect(() =>
    assertAllowedLoanTransition("returned", "active", "illegal"),
  ).toThrow("illegal");
});
