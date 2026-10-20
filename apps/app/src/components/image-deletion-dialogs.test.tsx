// @vitest-environment jsdom

import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { expect, test, vi } from "vitest";
import { renderOnPage } from "@/testing/render-on-page";
import { ImageDeletionDialogs } from "./image-deletion-dialogs";

function DeleteFromEditor({
  requiresApproval,
  onConfirm,
}: {
  requiresApproval: boolean;
  onConfirm: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Delete image
      </button>
      <ImageDeletionDialogs
        fileName="front.jpg"
        requiresApproval={requiresApproval}
        open={open}
        onOpenChange={setOpen}
        onConfirm={onConfirm}
      />
    </>
  );
}

test("without approval, a second warning says the deletion cannot be reversed before marking it", async () => {
  const user = userEvent.setup();
  const onConfirm = vi.fn();
  await renderOnPage(
    <DeleteFromEditor requiresApproval={false} onConfirm={onConfirm} />,
  );

  await user.click(screen.getByRole("button", { name: "Delete image" }));
  const first = screen.getByRole("alertdialog", {
    name: "Are you sure you want to delete this image?",
  });
  expect(first.textContent).toContain("front.jpg");
  expect(first.textContent).toContain(
    "Nothing is deleted until you select Update Object.",
  );
  await user.click(screen.getByRole("button", { name: "Delete" }));

  const second = await screen.findByRole("alertdialog", {
    name: "This will delete the image.",
  });
  expect(second.textContent).toContain("This action cannot be reversed.");
  expect(onConfirm).not.toHaveBeenCalled();
  await user.click(
    screen
      .getAllByRole("button", { name: "Delete image" })
      .at(-1) as HTMLElement,
  );

  expect(onConfirm).toHaveBeenCalledTimes(1);
  await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
});

test("cancelling the second warning keeps the image", async () => {
  const user = userEvent.setup();
  const onConfirm = vi.fn();
  await renderOnPage(
    <DeleteFromEditor requiresApproval={false} onConfirm={onConfirm} />,
  );

  await user.click(screen.getByRole("button", { name: "Delete image" }));
  await user.click(screen.getByRole("button", { name: "Delete" }));
  await screen.findByRole("alertdialog", {
    name: "This will delete the image.",
  });
  await user.click(screen.getByRole("button", { name: "Cancel" }));

  await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
  expect(onConfirm).not.toHaveBeenCalled();
});

test("with approval on, one confirmation marks the deletion for approval", async () => {
  const user = userEvent.setup();
  const onConfirm = vi.fn();
  await renderOnPage(
    <DeleteFromEditor requiresApproval onConfirm={onConfirm} />,
  );

  await user.click(screen.getByRole("button", { name: "Delete image" }));
  const dialog = screen.getByRole("alertdialog", {
    name: "Are you sure you want to delete this image?",
  });
  expect(dialog.textContent).toContain(
    "An approver reviews the deletion first.",
  );
  await user.click(screen.getByRole("button", { name: "Delete" }));

  expect(onConfirm).toHaveBeenCalledTimes(1);
  await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
});
