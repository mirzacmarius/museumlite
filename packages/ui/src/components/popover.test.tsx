// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
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
