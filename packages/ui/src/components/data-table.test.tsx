// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef, type Ref } from "react";
import { afterEach, expect, test, vi } from "vitest";
import { DataTable } from "./data-table";

afterEach(() => {
  vi.restoreAllMocks();
});

interface Loan extends Record<string, unknown> {
  _id: string;
  loanNumber: string;
  status: string;
}

const loans: Loan[] = [
  { _id: "l1", loanNumber: "LN-2026-001", status: "Pending" },
  { _id: "l2", loanNumber: "LN-2026-002", status: "Active" },
];

function LoanTable({
  data = loans,
  loading = false,
  tableRef,
}: {
  data?: Loan[];
  loading?: boolean;
  tableRef?: Ref<HTMLTableElement>;
}) {
  return (
    <DataTable<Loan>
      ref={tableRef}
      label="Loans"
      data={data}
      loading={loading}
      columns={[
        {
          key: "select",
          label: "Select",
          hideLabel: true,
          interactive: true,
          render: (loan) => (
            <input type="checkbox" aria-label={`Select ${loan.loanNumber}`} />
          ),
        },
        { key: "loanNumber", label: "Loan", rowHeader: true },
        { key: "status", label: "Status" },
      ]}
      rowHref={(loan) => `/loans/${loan._id}`}
      emptyState={<p>No loans match</p>}
    />
  );
}

test("every column has a header, including ones shown only to assistive technology", () => {
  render(<LoanTable />);
  const table = screen.getByRole("table", { name: "Loans" });

  expect(
    within(table)
      .getAllByRole("columnheader")
      .map((header) => header.textContent),
  ).toEqual(["Select", "Loan", "Status"]);
});

test("each row is named by its row header, which opens the row", () => {
  render(<LoanTable />);

  const rowHeader = screen.getByRole("rowheader", { name: "LN-2026-002" });
  const link = within(rowHeader).getByRole("link", { name: "LN-2026-002" });
  expect(link.getAttribute("href")).toBe("/loans/l2");
  const row = rowHeader.closest("tr");
  expect(row && within(row).getByRole("cell", { name: "Active" })).toBeTruthy();
});

test("selecting a row is a control of its own, reached before the row link", async () => {
  const user = userEvent.setup();
  render(<LoanTable />);

  for (const link of screen.getAllByRole("link")) {
    expect(within(link).queryByRole("checkbox")).toBeNull();
  }
  await user.tab();
  expect(document.activeElement).toBe(
    screen.getByRole("checkbox", { name: "Select LN-2026-001" }),
  );
  await user.keyboard(" ");
  expect(
    screen.getByRole<HTMLInputElement>("checkbox", {
      name: "Select LN-2026-001",
    }).checked,
  ).toBe(true);
  await user.tab();
  expect(document.activeElement).toBe(
    screen.getByRole("link", { name: "LN-2026-001" }),
  );
});

test("a table wider than its box can be scrolled from the keyboard", () => {
  vi.spyOn(Element.prototype, "scrollWidth", "get").mockReturnValue(704);
  vi.spyOn(Element.prototype, "clientWidth", "get").mockReturnValue(343);
  render(<LoanTable />);

  const region = screen.getByRole("region", { name: "Loans" });
  expect(region.tabIndex).toBe(0);
  expect(within(region).getByRole("table", { name: "Loans" })).toBeTruthy();
});

test("a table that fits its box adds no extra tab stop", () => {
  render(<LoanTable />);

  expect(screen.queryByRole("region")).toBeNull();
});

test("the table can take focus back, without becoming a tab stop", async () => {
  const user = userEvent.setup();
  const tableRef = createRef<HTMLTableElement>();
  render(<LoanTable tableRef={tableRef} />);
  const table = screen.getByRole("table", { name: "Loans" });

  tableRef.current?.focus();
  expect(document.activeElement).toBe(table);
  await user.tab();
  expect(document.activeElement).toBe(
    screen.getByRole("checkbox", { name: "Select LN-2026-001" }),
  );
});

test("the table reports that it is loading", () => {
  render(<LoanTable loading />);

  expect(
    screen.getByRole("table", { name: "Loans" }).getAttribute("aria-busy"),
  ).toBe("true");
});

test("an empty table keeps its headers and shows the empty state in its body", () => {
  render(<LoanTable data={[]} />);
  const table = screen.getByRole("table", { name: "Loans" });

  expect(within(table).getAllByRole("columnheader")).toHaveLength(3);
  expect(within(table).getByRole("cell").textContent).toBe("No loans match");
});
