// @vitest-environment jsdom

import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import { renderOnPage } from "@/testing/render-on-page";
import {
  ObjectAppliedFilters,
  type ObjectAppliedFiltersValue,
} from "./object-applied-filters";

const NO_FILTERS: ObjectAppliedFiltersValue = {
  search: "",
  status: "any",
  objectType: "",
  displayStatus: "",
  locationIds: [],
  collectionGroupId: "",
  culture: "",
  period: "",
  materials: "",
  condition: "",
  photograph: "",
  catalogedFrom: "",
  catalogedTo: "",
  advancedFilters: [],
};

test("facet, photograph, cataloged and advanced filters each show a removable chip", async () => {
  const onChange = vi.fn();
  await renderOnPage(
    <ObjectAppliedFilters
      filters={{
        ...NO_FILTERS,
        condition: "Fair",
        photograph: "without",
        catalogedFrom: "2026-03-01",
        advancedFilters: [
          {
            operator: "AND",
            filters: [
              { field: "creator", operator: "contains", value: "Munch" },
              { field: "period", operator: "eq", value: "Viking Age" },
            ],
          },
        ],
      }}
      onChange={onChange}
      onClearAll={() => {}}
    />,
    "/en/objects",
  );

  expect(screen.getByText("Fair")).toBeTruthy();
  expect(screen.getByText("No photograph")).toBeTruthy();
  expect(screen.getByText("Mar 1, 2026")).toBeTruthy();
  expect(screen.getByText("Rules: 2")).toBeTruthy();

  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: /Photograph/ }));
  expect(onChange).toHaveBeenLastCalledWith({ photograph: "" });
  await user.click(screen.getByRole("button", { name: /Advanced/ }));
  expect(onChange).toHaveBeenLastCalledWith({ advancedFilters: [] });
});

test("no chip bar shows without filters", async () => {
  const { container } = await renderOnPage(
    <ObjectAppliedFilters
      filters={NO_FILTERS}
      onChange={() => {}}
      onClearAll={() => {}}
    />,
    "/en/objects",
  );

  expect(container.textContent).toBe("");
});
