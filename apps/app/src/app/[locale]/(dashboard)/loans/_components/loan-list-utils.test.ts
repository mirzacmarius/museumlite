import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { describe, expect, test } from "vitest";
import { buildSelectedLoansCsv } from "./loan-list-utils";

describe("buildSelectedLoansCsv", () => {
  test("quotes text cells and disarms spreadsheet formulas", () => {
    const csv = buildSelectedLoansCsv(
      [
        {
          _id: "loan1" as Id<"loans">,
          loanNumber: "LOAN-1",
          type: "outgoing",
          lenderBorrowerName: '=HYPERLINK("https://x.test","open")',
          startDate: Date.UTC(2026, 0, 2),
          endDate: Date.UTC(2026, 2, 4),
          status: "active",
          itemCount: 3,
        },
        {
          _id: "loan2" as Id<"loans">,
          loanNumber: "LOAN-2",
          type: "incoming",
          lenderBorrowerName: 'Museum "North"',
          startDate: Date.UTC(2026, 4, 6),
          status: "pending",
        },
      ],
      ["Loan", "Type", "Partner", "Start", "End", "Status", "Items"],
    );

    expect(csv.split("\n")).toEqual([
      '"Loan","Type","Partner","Start","End","Status","Items"',
      '"LOAN-1","outgoing","\'=HYPERLINK(""https://x.test"",""open"")",2026-01-02,2026-03-04,"active",3',
      '"LOAN-2","incoming","Museum ""North""",2026-05-06,,"pending",',
    ]);
  });
});
