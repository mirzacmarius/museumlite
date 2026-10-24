// @vitest-environment jsdom

import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import { renderOnPage } from "@/testing/render-on-page";
import { EMPTY_PARTIAL_DATE, type PartialDateDraft } from "./historical-date";
import { PartialDateFields } from "./partial-date-fields";

const YEAR: PartialDateDraft = {
  ...EMPTY_PARTIAL_DATE,
  precision: "year",
  year: "500",
};

test("a provenance date offers every qualifier and no era", async () => {
  await renderOnPage(
    <PartialDateFields
      id="made"
      label="From"
      value={YEAR}
      onChange={vi.fn()}
    />,
  );
  const user = userEvent.setup();

  expect(screen.queryByRole("combobox", { name: "Era" })).toBeNull();
  await user.click(screen.getByRole("combobox", { name: "Qualifier" }));
  expect(
    screen.getAllByRole("option").map((option) => option.textContent),
  ).toEqual(["As given", "Circa", "By (on or before)", "After (on or after)"]);
});

test("a date made offers only the qualifiers given, and BC for a year", async () => {
  const onChange = vi.fn<(value: PartialDateDraft) => void>();
  await renderOnPage(
    <PartialDateFields
      id="made"
      label="From"
      value={YEAR}
      onChange={onChange}
      qualifiers={["exact", "circa"]}
      allowBc
    />,
  );
  const user = userEvent.setup();

  await user.click(screen.getByRole("combobox", { name: "Qualifier" }));
  expect(
    screen.getAllByRole("option").map((option) => option.textContent),
  ).toEqual(["As given", "Circa"]);
  await user.keyboard("{Escape}");

  await user.click(screen.getByRole("combobox", { name: "Era" }));
  await user.click(await screen.findByRole("option", { name: "BC" }));
  expect(onChange).toHaveBeenLastCalledWith({ ...YEAR, era: "bc" });
});

test("the era is offered for a year only", async () => {
  await renderOnPage(
    <PartialDateFields
      id="made"
      label="From"
      value={{ ...YEAR, precision: "decade", year: "1850" }}
      onChange={vi.fn()}
      allowBc
    />,
  );

  expect(screen.queryByRole("combobox", { name: "Era" })).toBeNull();
  expect(
    screen.getByText("Enter the first year of the decade, for example 1920."),
  ).toBeTruthy();
});
