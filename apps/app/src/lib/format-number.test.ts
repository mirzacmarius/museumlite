import { expect, test } from "vitest";
import { formatMoney, totalsByCurrency } from "./format-number";

test("amounts in different currencies are totalled apart, never added", () => {
  expect(
    totalsByCurrency([
      { amount: 1200, currency: "NOK" },
      { amount: 300, currency: "EUR" },
      { amount: 800, currency: "NOK" },
    ]),
  ).toEqual({
    byCurrency: [
      { currency: "EUR", total: 300 },
      { currency: "NOK", total: 2000 },
    ],
    currencyNotRecordedCount: 0,
  });
});

test("amounts without a recorded currency are counted, not summed", () => {
  expect(
    totalsByCurrency([
      { amount: 500, currency: undefined },
      { amount: 250, currency: "" },
      { amount: undefined, currency: "USD" },
    ]),
  ).toEqual({ byCurrency: [], currencyNotRecordedCount: 2 });
});

test("an amount without a currency is shown as a bare number in the locale's format", () => {
  expect(formatMoney(1234.5, "no", undefined)).toMatch(/^1\s234,5$/u);
});
