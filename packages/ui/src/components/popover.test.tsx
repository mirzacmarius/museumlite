// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test } from "vitest";
import { Dialog, DialogContent, DialogTitle } from "./dialog";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

/** A combobox-style picker opened from inside a dialog. */
function DialogWithPicker() {
  return (
    <Dialog defaultOpen>
      <DialogContent>
        <DialogTitle>Set condition</DialogTitle>
        <Popover>
          <PopoverTrigger>Condition</PopoverTrigger>
          <PopoverContent>
            <div role="listbox" aria-label="Conditions">
              Excellent
            </div>
          </PopoverContent>
        </Popover>
      </DialogContent>
    </Dialog>
  );
}

// jsdom has no layout, so the list reports the overflow a browser measures.
function makeScrollable(list: HTMLElement) {
  list.style.overflowY = "auto";
  Object.defineProperty(list, "scrollHeight", { value: 563 });
  Object.defineProperty(list, "clientHeight", { value: 300 });
}

test("the dialog's scroll lock lets a picker list inside it take the mouse wheel", async () => {
  const user = userEvent.setup();
  render(<DialogWithPicker />);
  await user.click(screen.getByRole("button", { name: "Condition" }));
  const list = screen.getByRole("listbox", { name: "Conditions" });
  makeScrollable(list);

  const wheel = new WheelEvent("wheel", {
    deltaY: 220,
    bubbles: true,
    cancelable: true,
  });
  list.dispatchEvent(wheel);

  expect(wheel.defaultPrevented).toBe(false);
});

test("a closed popover animates out, then leaves the page and hands focus back to its trigger", async () => {
  const user = userEvent.setup();
  render(
    <Popover>
      <PopoverTrigger>Filters</PopoverTrigger>
      <PopoverContent>Only on display</PopoverContent>
    </Popover>,
  );
  const trigger = screen.getByRole("button", { name: "Filters" });
  await user.click(trigger);
  // Closing before the first frame has nothing to animate back from.
  const popup = screen.getByText("Only on display");
  await waitFor(() => expect(Number(popup.style.opacity)).toBeGreaterThan(0));

  await user.keyboard("{Escape}");

  expect(screen.getByText("Only on display")).toBeTruthy();
  await waitFor(() => expect(screen.queryByText("Only on display")).toBeNull());
  expect(document.activeElement).toBe(trigger);
});

test("Escape in a picker inside a dialog closes the picker and keeps the dialog open", async () => {
  const user = userEvent.setup();
  render(<DialogWithPicker />);
  await user.click(screen.getByRole("button", { name: "Condition" }));
  screen.getByRole("listbox", { name: "Conditions" });

  await user.keyboard("{Escape}");

  await waitFor(() =>
    expect(screen.queryByRole("listbox", { name: "Conditions" })).toBeNull(),
  );
  screen.getByRole("dialog", { name: "Set condition" });
});
