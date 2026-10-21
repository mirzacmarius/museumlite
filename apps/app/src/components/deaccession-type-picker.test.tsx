// @vitest-environment jsdom

import { screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { renderOnPage } from "@/testing/render-on-page";
import type { ObjectActions } from "./deaccession-dialog-types";
import { DeaccessionTypePicker } from "./deaccession-type-picker";

async function renderPicker(actions: ObjectActions) {
  await renderOnPage(
    <DeaccessionTypePicker actions={actions} onSelect={vi.fn()} />,
    "/en/objects/object-1",
    { id: "object-1" },
  );
}

test("options the Object does not allow are hidden or disabled with the reason", async () => {
  await renderPicker({
    deaccession: { state: "blocked", reason: "on_loan" },
    remove: { state: "hidden" },
  });

  const sold = screen.getByRole("button", { name: /Object Sold/i });
  expect(sold.hasAttribute("disabled")).toBe(true);
  expect(sold.textContent).toContain("On loan");
  expect(screen.queryByRole("button", { name: /Remove object/i })).toBeNull();
  expect(
    screen
      .getByRole("button", { name: /Move to another organization/i })
      .hasAttribute("disabled"),
  ).toBe(false);
});

test("an object held by its transfer offers neither a sale nor a removal", async () => {
  await renderPicker({
    deaccession: { state: "blocked", reason: "in_transfer" },
    remove: { state: "blocked", reason: "in_transfer" },
  });

  for (const name of [/Object Sold/i, /Remove object/i]) {
    const option = screen.getByRole("button", { name });
    expect(option.hasAttribute("disabled")).toBe(true);
    expect(option.textContent).toContain("Transfer in progress");
  }
});

test("an approval workflow is noted on the sale option", async () => {
  await renderPicker({
    deaccession: { state: "available", approvalSteps: 1 },
    remove: { state: "available" },
  });

  expect(
    screen.getByRole("button", { name: /Object Sold/i }).textContent,
  ).toMatch(/approval/i);
  expect(
    screen
      .getByRole("button", { name: /Remove object/i })
      .hasAttribute("disabled"),
  ).toBe(false);
});
