import { expect, test } from "vitest";
import {
  isSuppressedNotification,
  withoutSuppressedNotifications,
} from "./suppressedNotifications";

test("suppresses missing insurance coverage notices by type or title", () => {
  expect(
    isSuppressedNotification({
      type: "missing_coverage",
      title: "Objects Missing Insurance Coverage",
    }),
  ).toBe(true);
  expect(
    isSuppressedNotification({
      type: "missing_coverage",
      title: "Something else",
    }),
  ).toBe(true);
  expect(
    isSuppressedNotification({
      type: "insurance_expiry",
      title: "Objects Missing Insurance Coverage",
    }),
  ).toBe(true);
  expect(
    isSuppressedNotification({
      type: "insurance_expiry",
      title: "Insurance Policy Expiring in 7 Days",
    }),
  ).toBe(false);
});

test("filters suppressed notices from a list", () => {
  expect(
    withoutSuppressedNotifications([
      { type: "loan_due_soon", title: "Loan due soon" },
      {
        type: "missing_coverage",
        title: "Objects Missing Insurance Coverage",
      },
    ]),
  ).toEqual([{ type: "loan_due_soon", title: "Loan due soon" }]);
});
