// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRef, useState } from "react";
import { expect, test } from "vitest";
import { SelectionActionBar } from "./selection-action-bar";

/** A list with two selected loans and an action that clears the selection. */
function SelectedLoans({ initial = 2 }: { initial?: number }) {
  const [count, setCount] = useState(initial);
  const listRef = useRef<HTMLElement>(null);
  return (
    <>
      <section ref={listRef} tabIndex={-1} aria-label="Loans">
        <button type="button" onClick={() => setCount(count + 1)}>
          Select another
        </button>
      </section>
      <SelectionActionBar
        label="Selected loans"
        count={count}
        countLabel={`${count} loans selected`}
        clearLabel="Clear selection"
        onClear={() => setCount(0)}
        returnFocusRef={listRef}
      >
        <button type="button" onClick={() => setCount(0)}>
          Approve selected
        </button>
      </SelectionActionBar>
    </>
  );
}

test("the selected count is announced as the selection changes", async () => {
  const user = userEvent.setup();
  render(<SelectedLoans initial={0} />);
  const status = screen.getByRole("status");
  expect(status.textContent).toBe("");
  expect(screen.queryByRole("region", { name: "Selected loans" })).toBeNull();

  await user.click(screen.getByRole("button", { name: "Select another" }));

  expect(status.textContent).toBe("1 loans selected");
  expect(screen.getByRole("region", { name: "Selected loans" })).toBeTruthy();
});

test("clearing the selection from the bar moves focus back to the list", async () => {
  const user = userEvent.setup();
  render(<SelectedLoans />);

  await user.click(screen.getByRole("button", { name: "Clear selection" }));

  expect(screen.queryByRole("region", { name: "Selected loans" })).toBeNull();
  expect(document.activeElement).toBe(screen.getByLabelText("Loans"));
});

test("an action that ends the selection moves focus back to the list", async () => {
  const user = userEvent.setup();
  render(<SelectedLoans />);

  await user.click(screen.getByRole("button", { name: "Approve selected" }));

  expect(document.activeElement).toBe(screen.getByLabelText("Loans"));
});
