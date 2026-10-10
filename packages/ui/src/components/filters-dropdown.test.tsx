// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRef, useState } from "react";
import { expect, test } from "vitest";
import { AppliedFilterChip, AppliedFiltersBar } from "./filters-dropdown";

const initialFilters = [
  { label: "Status", value: "Active" },
  { label: "Location", value: "Store room B, bay 4, shelf 2" },
  { label: "Search", value: "harbour" },
];

/** A catalog toolbar: a search box and the filters currently applied. */
function CatalogFilters() {
  const [filters, setFilters] = useState(initialFilters);
  const searchRef = useRef<HTMLInputElement>(null);
  return (
    <>
      <input ref={searchRef} aria-label="Search objects" />
      {filters.length > 0 ? (
        <AppliedFiltersBar
          onClearAll={() => setFilters([])}
          returnFocusRef={searchRef}
        >
          {filters.map((filter) => (
            <AppliedFilterChip
              key={filter.label}
              label={filter.label}
              value={filter.value}
              onRemove={() =>
                setFilters((current) =>
                  current.filter((item) => item.label !== filter.label),
                )
              }
            />
          ))}
        </AppliedFiltersBar>
      ) : null}
    </>
  );
}

test("each chip is named for the filter it removes", () => {
  render(<CatalogFilters />);

  expect(
    screen.getByRole("button", {
      name: "Remove Location: Store room B, bay 4, shelf 2 filter",
    }),
  ).toBeTruthy();
  expect(screen.getByRole("button", { name: "Clear all" })).toBeTruthy();
});

test("removing a chip moves focus to the chip that takes its place", async () => {
  const user = userEvent.setup();
  render(<CatalogFilters />);

  screen
    .getByRole("button", {
      name: "Remove Location: Store room B, bay 4, shelf 2 filter",
    })
    .focus();
  await user.keyboard("{Enter}");

  expect(document.activeElement).toBe(
    screen.getByRole("button", { name: "Remove Search: harbour filter" }),
  );
});

test("removing the last chip moves focus to the one before it", async () => {
  const user = userEvent.setup();
  render(<CatalogFilters />);

  screen.getByRole("button", { name: "Remove Search: harbour filter" }).focus();
  await user.keyboard(" ");

  expect(document.activeElement).toBe(
    screen.getByRole("button", {
      name: "Remove Location: Store room B, bay 4, shelf 2 filter",
    }),
  );
});

test("clearing every filter moves focus to where filtering starts", async () => {
  const user = userEvent.setup();
  render(<CatalogFilters />);

  await user.click(screen.getByRole("button", { name: "Clear all" }));

  expect(screen.queryByRole("button", { name: /Remove/ })).toBeNull();
  expect(document.activeElement).toBe(
    screen.getByRole("textbox", { name: "Search objects" }),
  );
});
