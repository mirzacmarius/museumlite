// @vitest-environment jsdom

import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { RightsStatementUri } from "@v1/backend/convex/utils/rightsStatements";
import { expect, test, vi } from "vitest";
import { renderOnPage } from "@/testing/render-on-page";
import { RightsStatementSelect } from "./rights-statement-select";

const IN_COPYRIGHT = "http://rightsstatements.org/vocab/InC/1.0/";
const CC0 = "https://creativecommons.org/publicdomain/zero/1.0/";

function renderSelect(
  organizationDefault: RightsStatementUri | null | undefined,
  value?: RightsStatementUri,
) {
  const onValueChange =
    vi.fn<(value: RightsStatementUri | undefined) => void>();
  return renderOnPage(
    <>
      <label htmlFor="rights">Rights statement</label>
      <RightsStatementSelect
        id="rights"
        value={value}
        onValueChange={onValueChange}
        organizationDefault={organizationDefault}
      />
    </>,
  ).then(() => onValueChange);
}

function trigger() {
  return screen.getByRole("combobox", { name: "Rights statement" });
}

test("without a statement of its own, the choice names the organization's default", async () => {
  await renderSelect(IN_COPYRIGHT);
  expect(trigger().textContent).toBe("Organization default (In Copyright)");
});

test("without an organization default, the empty choice says none is stated", async () => {
  await renderSelect(null);
  expect(trigger().textContent).toBe("Not stated");
});

test("while the default loads, the empty choice says only that it is the default", async () => {
  await renderSelect(undefined);
  expect(trigger().textContent).toBe("Organization default");
});

test("statements are offered by name, grouped by publisher, and the default clears the record's own", async () => {
  const onValueChange = await renderSelect(IN_COPYRIGHT, CC0);
  const user = userEvent.setup();
  expect(trigger().textContent).toBe("CC0 1.0 Universal");

  await user.click(trigger());
  expect(screen.getByText("RightsStatements.org statements")).toBeTruthy();
  expect(screen.getByText("Creative Commons licenses and tools")).toBeTruthy();
  await user.click(
    screen.getByRole("option", {
      name: "Creative Commons Attribution 4.0 International",
    }),
  );
  expect(onValueChange).toHaveBeenLastCalledWith(
    "https://creativecommons.org/licenses/by/4.0/",
  );

  await user.click(trigger());
  await user.click(
    screen.getByRole("option", {
      name: "Organization default (In Copyright)",
    }),
  );
  expect(onValueChange).toHaveBeenLastCalledWith(undefined);
});

test("a picker that sets the default itself names its empty choice as told", async () => {
  await renderOnPage(
    <>
      <label htmlFor="rights">Rights statement</label>
      <RightsStatementSelect
        id="rights"
        value={undefined}
        onValueChange={() => {}}
        organizationDefault={null}
        emptyLabel="No default"
      />
    </>,
  );
  expect(trigger().textContent).toBe("No default");
});
