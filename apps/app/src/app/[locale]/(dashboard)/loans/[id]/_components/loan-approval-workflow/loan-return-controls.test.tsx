// @vitest-environment jsdom
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { custodyConflict } from "@v1/backend/convex/utils/custodyErrors";
import { getFunctionName } from "convex/server";
import { useState } from "react";
import { beforeEach, expect, test, vi } from "vitest";
import { renderOnPage } from "@/testing/render-on-page";
import type { LoanItem } from "../types";
import { LoanReturnControls } from "./loan-return-controls";
import { useLoanReturnFlow } from "./use-loan-return-flow";

vi.mock("convex/react", () => ({
  useQuery: (reference: unknown, args: unknown) =>
    args !== "skip" &&
    getFunctionName(reference as never) === "locations:listAllWithPaths"
      ? [
          {
            _id: "store",
            name: "Store room B",
            type: "room",
            status: "active",
            path: [{ name: "Store room B", type: "room" }],
          },
        ]
      : undefined,
  usePaginatedQuery: () => ({
    results: [],
    status: "Exhausted",
    loadMore: () => {},
  }),
  useMutation: () => vi.fn(),
}));
vi.mock("@/components/permission-gate", () => ({
  usePermissions: () => ({ hasPermission: () => true }),
}));

const LOAN_ITEMS: LoanItem[] = [
  {
    _id: "item-1" as Id<"loanItems">,
    collectionId: "object-1" as Id<"collections">,
    accessionNumber: "QA-652-1",
    title: "Portrait of the harbourmaster's daughter",
    custodyStatus: "dispatched",
    dispatchOriginLocationId: "store" as Id<"locations">,
  },
  {
    _id: "item-2" as Id<"loanItems">,
    collectionId: "object-2" as Id<"collections">,
    accessionNumber: "QA-652-2",
    title: "Ship's bell from the Fjordglimt",
    custodyStatus: "dispatched",
    dispatchOriginLocationId: "store" as Id<"locations">,
  },
];

const returnLoan = vi.fn();

function ReturnControls() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const returnFlow = useLoanReturnFlow({
    loanId: "loan-1",
    organizationId: "org" as Id<"organizations">,
    loanType: "outgoing",
    loanItems: LOAN_ITEMS,
    returnLoan,
    isSubmitting,
    setIsSubmitting,
    setError: () => {},
  });
  return <LoanReturnControls loanItems={LOAN_ITEMS} returnFlow={returnFlow} />;
}

beforeEach(() => {
  returnLoan.mockReset();
});

async function openReturnForFirstItem() {
  await renderOnPage(<ReturnControls />, "/en/loans/loan-1", { id: "loan-1" });
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Mark as Returned" }));
  const dialog = await screen.findByRole("dialog");
  await user.click(
    within(dialog).getByRole("checkbox", {
      name: /QA-652-1 Portrait of the harbourmaster's daughter/,
    }),
  );
  return { dialog, user };
}

test("continuing without evidence for a selected item says what is missing and focuses it", async () => {
  const { dialog, user } = await openReturnForFirstItem();

  await user.click(within(dialog).getByRole("button", { name: "Continue" }));

  const notes = within(dialog).getByRole("textbox", {
    name: "Condition notes on receipt",
  });
  expect(notes.getAttribute("aria-invalid")).toBe("true");
  expect(
    document.getElementById(notes.getAttribute("aria-describedby") ?? "")
      ?.textContent,
  ).toBe("Add condition notes or choose an accepted assessment.");
  expect(document.activeElement).toBe(notes);
  const destination = within(dialog).getByRole("combobox", {
    name: "Return destination",
  });
  expect(destination.getAttribute("aria-invalid")).toBe("true");
  expect(returnLoan).not.toHaveBeenCalled();
});

test("a refused return is explained in the return dialog, which keeps the evidence", async () => {
  returnLoan.mockRejectedValue(
    custodyConflict("HANDOFF_ALREADY_RECORDED", "Already returned"),
  );
  const { dialog, user } = await openReturnForFirstItem();
  await user.click(
    within(dialog).getByRole("checkbox", {
      name: "Confirm return to recorded origin",
    }),
  );
  await user.type(
    within(dialog).getByRole("textbox", { name: "Condition notes on receipt" }),
    "Good, no change",
  );
  await user.click(within(dialog).getByRole("button", { name: "Continue" }));
  await user.click(
    await screen.findByRole("button", { name: "Confirm Partial Return" }),
  );

  const reopened = await screen.findByRole("dialog");
  const refusal = await within(reopened).findByRole("alert");
  expect(refusal.textContent).toBe(
    "This handoff has already been recorded. Refresh to see the latest state.",
  );
  expect(document.activeElement).toBe(refusal);
  expect(
    (
      within(reopened).getByRole("textbox", {
        name: "Condition notes on receipt",
      }) as HTMLInputElement
    ).value,
  ).toBe("Good, no change");
});
