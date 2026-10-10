// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRef, useState } from "react";
import { expect, test } from "vitest";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "./dialog";

/** A dialog opened from a toolbar button, as bulk actions open theirs. */
function MoveDialog() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Move location
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogTitle>Move objects</DialogTitle>
          <DialogDescription>Choose where 2 objects are now.</DialogDescription>
          <button type="button" onClick={() => setOpen(false)}>
            Cancel
          </button>
        </DialogContent>
      </Dialog>
    </>
  );
}

test("dismissing with Escape returns focus to the control that opened the dialog", async () => {
  const user = userEvent.setup();
  render(<MoveDialog />);
  const opener = screen.getByRole("button", { name: "Move location" });

  await user.click(opener);
  expect(screen.getByRole("dialog", { name: "Move objects" })).toBeTruthy();
  await user.keyboard("{Escape}");

  await waitFor(() => expect(document.activeElement).toBe(opener));
});

/** A bulk action whose bar, and so the dialog's opener, goes once it succeeds. */
function BulkMoveDialog() {
  const [selected, setSelected] = useState(2);
  const [open, setOpen] = useState(false);
  const listRef = useRef<HTMLElement>(null);
  return (
    <>
      <section ref={listRef} tabIndex={-1} aria-label="Objects" />
      {selected > 0 ? (
        <button type="button" onClick={() => setOpen(true)}>
          Move location
        </button>
      ) : null}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent fallbackFocusRef={listRef}>
          <DialogTitle>Move objects</DialogTitle>
          <DialogDescription>Choose where 2 objects are now.</DialogDescription>
          <button
            type="button"
            onClick={() => {
              setSelected(0);
              setOpen(false);
            }}
          >
            Move items
          </button>
        </DialogContent>
      </Dialog>
    </>
  );
}

test("when the control that opened the dialog is gone, focus goes to the fallback", async () => {
  const user = userEvent.setup();
  render(<BulkMoveDialog />);

  await user.click(screen.getByRole("button", { name: "Move location" }));
  await user.click(screen.getByRole("button", { name: "Move items" }));

  await waitFor(() =>
    expect(document.activeElement).toBe(screen.getByLabelText("Objects")),
  );
});

test("closing from inside the dialog returns focus to the control that opened it", async () => {
  const user = userEvent.setup();
  render(<MoveDialog />);
  const opener = screen.getByRole("button", { name: "Move location" });

  await user.click(opener);
  await user.click(screen.getByRole("button", { name: "Close" }));
  await waitFor(() => expect(document.activeElement).toBe(opener));

  await user.click(opener);
  await user.click(screen.getByRole("button", { name: "Cancel" }));
  await waitFor(() => expect(document.activeElement).toBe(opener));
});
