// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { expect, test } from "vitest";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from "./alert-dialog";

/** A confirmation a form opens from its own Cancel button. */
function LeaveConfirmation() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Cancel
      </button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogTitle>Unsaved changes</AlertDialogTitle>
          <AlertDialogDescription>Leave without saving?</AlertDialogDescription>
          <AlertDialogCancel>Keep editing</AlertDialogCancel>
          <AlertDialogAction>Discard changes</AlertDialogAction>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

test("dismissing returns focus to the control that asked for confirmation", async () => {
  const user = userEvent.setup();
  render(<LeaveConfirmation />);
  const opener = screen.getByRole("button", { name: "Cancel" });

  await user.click(opener);
  expect(
    screen.getByRole("alertdialog", { name: "Unsaved changes" }),
  ).toBeTruthy();
  await user.keyboard("{Escape}");
  await waitFor(() => expect(document.activeElement).toBe(opener));

  await user.click(opener);
  await user.click(screen.getByRole("button", { name: "Keep editing" }));
  await waitFor(() => expect(document.activeElement).toBe(opener));
});
