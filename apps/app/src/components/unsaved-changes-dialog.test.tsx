// @vitest-environment jsdom
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { expect, test, vi } from "vitest";
import { renderOnPage } from "@/testing/render-on-page";
import { UnsavedChangesDialog } from "./unsaved-changes-dialog";

/** A form's Cancel, which asks first when there is unsaved input. */
function DirtyForm({ onDiscard }: { onDiscard: () => void }) {
  const [asking, setAsking] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setAsking(true)}>
        Cancel
      </button>
      <UnsavedChangesDialog
        open={asking}
        onOpenChange={setAsking}
        onDiscard={onDiscard}
        onSave={async () => true}
      />
    </>
  );
}

test("asking to leave starts on keeping the input, and keeping it returns to the form", async () => {
  const user = userEvent.setup();
  const onDiscard = vi.fn();
  await renderOnPage(<DirtyForm onDiscard={onDiscard} />);
  const cancel = screen.getByRole("button", { name: "Cancel" });

  await user.click(cancel);
  await waitFor(() =>
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Keep editing" }),
    ),
  );
  await user.keyboard("{Enter}");

  expect(screen.queryByRole("alertdialog")).toBeNull();
  await waitFor(() => expect(document.activeElement).toBe(cancel));
  expect(onDiscard).not.toHaveBeenCalled();
});

test("discarding is a choice of its own", async () => {
  const user = userEvent.setup();
  const onDiscard = vi.fn();
  await renderOnPage(<DirtyForm onDiscard={onDiscard} />);

  await user.click(screen.getByRole("button", { name: "Cancel" }));
  await user.click(screen.getByRole("button", { name: "Discard changes" }));

  expect(onDiscard).toHaveBeenCalledOnce();
});
