// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { expect, test } from "vitest";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "./sheet";

/** A side panel opened from a toolbar button, as the mobile sidebar is. */
function NavigationSheet() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Open navigation
      </button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent>
          <SheetTitle>Navigation</SheetTitle>
          <SheetDescription>Workspace pages</SheetDescription>
        </SheetContent>
      </Sheet>
    </>
  );
}

test("closing the sheet returns focus to the control that opened it", async () => {
  const user = userEvent.setup();
  render(<NavigationSheet />);
  const opener = screen.getByRole("button", { name: "Open navigation" });

  await user.click(opener);
  await user.click(screen.getByRole("button", { name: "Close" }));

  await waitFor(() => expect(document.activeElement).toBe(opener));
});
