// @vitest-environment jsdom

import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import { renderOnPage } from "@/testing/render-on-page";
import { AdvancedSearchDialog } from "./advanced-search-dialog";

test("conditions left blank, even with spaces, are not applied", async () => {
  const onApply = vi.fn();
  await renderOnPage(
    <AdvancedSearchDialog
      open
      onOpenChange={() => {}}
      onApply={onApply}
      initialFilterGroups={[
        {
          operator: "OR",
          filters: [
            { field: "title", operator: "contains", value: "bowl" },
            { field: "title", operator: "ne", value: "  " },
          ],
        },
        {
          operator: "AND",
          filters: [{ field: "culture", operator: "ne", value: " " }],
        },
      ]}
      initialGroupOperator="OR"
    />,
    "/en/objects",
  );

  await userEvent.click(screen.getByRole("button", { name: "Apply Filters" }));

  expect(onApply).toHaveBeenCalledWith(
    [
      {
        operator: "OR",
        filters: [{ field: "title", operator: "contains", value: "bowl" }],
      },
    ],
    "OR",
  );
});
