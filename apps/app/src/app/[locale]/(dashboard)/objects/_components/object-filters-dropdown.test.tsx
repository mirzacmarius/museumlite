// @vitest-environment jsdom

import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TooltipProvider } from "@v1/ui/tooltip";
import { useState } from "react";
import { expect, test, vi } from "vitest";
import { renderOnPage } from "@/testing/render-on-page";
import {
  ObjectFiltersDropdown,
  type ObjectFiltersDropdownValue,
} from "./object-filters-dropdown";

const NO_FILTERS: ObjectFiltersDropdownValue = {
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
  madeFrom: "",
  madeTo: "",
};

/** The dropdown over filters kept as the URL keeps them. */
function Catalog({
  onChange,
}: {
  onChange: (filters: Partial<ObjectFiltersDropdownValue>) => void;
}) {
  const [filters, setFilters] = useState(NO_FILTERS);
  return (
    <TooltipProvider delayDuration={0}>
      <ObjectFiltersDropdown
        filters={filters}
        onChange={(next) => {
          onChange(next);
          setFilters((current) => ({ ...current, ...next }));
        }}
        objectTypes={[]}
        advancedConditionCount={0}
        onOpenAdvancedSearch={() => {}}
        onClearAdvancedSearch={() => {}}
        viewMode="list"
        onViewModeChange={() => {}}
        columns={[]}
        onColumnToggle={() => {}}
      />
    </TooltipProvider>
  );
}

async function openFilters(
  onChange = vi.fn<(filters: Partial<ObjectFiltersDropdownValue>) => void>(),
) {
  await renderOnPage(<Catalog onChange={onChange} />, "/en/objects");
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Filters" }));
  return { user, onChange };
}

test("a date made range applies years either side of 1 AD as written", async () => {
  const { user, onChange } = await openFilters();

  await user.type(screen.getByRole("textbox", { name: "Made from" }), "500");
  await user.selectOptions(
    screen.getByRole("combobox", { name: "Made from Era" }),
    "bc",
  );
  expect(onChange).toHaveBeenLastCalledWith({ madeFrom: "-500", madeTo: "" });

  await user.type(screen.getByRole("textbox", { name: "Made until" }), "1850");
  expect(onChange).toHaveBeenLastCalledWith({
    madeFrom: "-500",
    madeTo: "1850",
  });
  expect(screen.queryByText(/Enter a/)).toBeNull();
});

test.each([
  "0",
  "18.5",
  "10000",
])("%s is not applied as a year from 1 to 9999", async (year) => {
  const { user, onChange } = await openFilters();
  const from = screen.getByRole("textbox", { name: "Made from" });

  await user.type(from, year);

  expect(screen.getByText("Enter a whole year from 1 to 9999.")).toBeTruthy();
  expect(from.getAttribute("aria-invalid")).toBe("true");
  expect(onChange).not.toHaveBeenCalledWith(
    expect.objectContaining({ madeFrom: year }),
  );
});

test("a start after the end is held back until the range is in order", async () => {
  const { user, onChange } = await openFilters();
  await user.type(screen.getByRole("textbox", { name: "Made from" }), "1900");
  onChange.mockClear();

  await user.type(screen.getByRole("textbox", { name: "Made until" }), "1800");
  expect(
    screen.getByText("Enter a start year on or before the end year."),
  ).toBeTruthy();
  expect(onChange).not.toHaveBeenCalled();

  await user.selectOptions(
    screen.getByRole("combobox", { name: "Made from Era" }),
    "bc",
  );
  expect(onChange).toHaveBeenLastCalledWith({
    madeFrom: "-1900",
    madeTo: "1800",
  });
  expect(screen.queryByText(/Enter a/)).toBeNull();
});

test("Clear all empties the date made range", async () => {
  const { user, onChange } = await openFilters();
  await user.type(screen.getByRole("textbox", { name: "Made until" }), "1850");

  await user.click(screen.getByRole("button", { name: "Clear all" }));

  expect(onChange).toHaveBeenLastCalledWith(
    expect.objectContaining({ madeFrom: "", madeTo: "" }),
  );
  expect(screen.getByRole("textbox", { name: "Made until" })).toHaveProperty(
    "value",
    "",
  );
});

test("Clear all also drops a year that was never applied", async () => {
  const { user } = await openFilters();
  await user.click(screen.getByRole("switch", { name: "On display" }));
  const from = screen.getByRole("textbox", { name: "Made from" });
  await user.type(from, "0");
  expect(screen.getByText("Enter a whole year from 1 to 9999.")).toBeTruthy();

  await user.click(screen.getByRole("button", { name: "Clear all" }));

  expect(screen.getByRole("textbox", { name: "Made from" })).toHaveProperty(
    "value",
    "",
  );
  expect(screen.queryByText(/Enter a/)).toBeNull();
});
