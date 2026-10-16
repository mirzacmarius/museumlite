// @vitest-environment jsdom

import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { imageDeletionError } from "@v1/backend/convex/utils/imageDeletionErrors";
import { getFunctionName } from "convex/server";
import { useState } from "react";
import { beforeEach, expect, test, vi } from "vitest";
import { renderOnPage } from "@/testing/render-on-page";
import { ImageDeletionDialogs } from "./image-deletion-dialogs";

const mutations = vi.hoisted(() => ({
  requestImageDeletion: vi.fn(),
  deleteImage: vi.fn(),
}));
const toasts = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));

vi.mock("convex/react", () => ({
  useMutation: (mutation: never) =>
    getFunctionName(mutation) === "mediaDeletions:requestImageDeletion"
      ? mutations.requestImageDeletion
      : mutations.deleteImage,
}));
vi.mock("sonner", () => ({ toast: toasts }));

beforeEach(() => {
  mutations.requestImageDeletion.mockReset().mockResolvedValue("request-1");
  mutations.deleteImage.mockReset().mockResolvedValue(null);
  toasts.success.mockReset();
  toasts.error.mockReset();
});

const MEDIA_ID = "media-1" as Id<"mediaFiles">;

function DeleteFromEditor({
  requiresApproval,
  onDone,
}: {
  requiresApproval: boolean;
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Delete image
      </button>
      <ImageDeletionDialogs
        mediaId={MEDIA_ID}
        fileName="front.jpg"
        requiresApproval={requiresApproval}
        open={open}
        onOpenChange={setOpen}
        onDone={onDone}
      />
    </>
  );
}

test("without approval, a second warning says the deletion cannot be reversed before deleting", async () => {
  const user = userEvent.setup();
  const onDone = vi.fn();
  await renderOnPage(
    <DeleteFromEditor requiresApproval={false} onDone={onDone} />,
  );

  await user.click(screen.getByRole("button", { name: "Delete image" }));
  const first = screen.getByRole("alertdialog", {
    name: "Are you sure you want to delete this image?",
  });
  expect(first.textContent).toContain("front.jpg");
  await user.click(screen.getByRole("button", { name: "Delete" }));

  const second = await screen.findByRole("alertdialog", {
    name: "This will delete the image.",
  });
  expect(second.textContent).toContain("This action cannot be reversed.");
  expect(mutations.deleteImage).not.toHaveBeenCalled();
  await user.click(
    screen
      .getAllByRole("button", { name: "Delete image" })
      .at(-1) as HTMLElement,
  );

  await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
  expect(mutations.deleteImage).toHaveBeenCalledWith({ mediaId: MEDIA_ID });
  expect(mutations.requestImageDeletion).not.toHaveBeenCalled();
  expect(toasts.success).toHaveBeenCalledWith("Image deleted");
});

test("cancelling the second warning keeps the image", async () => {
  const user = userEvent.setup();
  const onDone = vi.fn();
  await renderOnPage(
    <DeleteFromEditor requiresApproval={false} onDone={onDone} />,
  );

  await user.click(screen.getByRole("button", { name: "Delete image" }));
  await user.click(screen.getByRole("button", { name: "Delete" }));
  await screen.findByRole("alertdialog", {
    name: "This will delete the image.",
  });
  await user.click(screen.getByRole("button", { name: "Cancel" }));

  await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
  expect(mutations.deleteImage).not.toHaveBeenCalled();
  expect(onDone).not.toHaveBeenCalled();
});

test("with approval on, confirming sends the deletion for approval", async () => {
  const user = userEvent.setup();
  const onDone = vi.fn();
  await renderOnPage(<DeleteFromEditor requiresApproval onDone={onDone} />);

  await user.click(screen.getByRole("button", { name: "Delete image" }));
  const dialog = screen.getByRole("alertdialog", {
    name: "Are you sure you want to delete this image?",
  });
  expect(dialog.textContent).toContain(
    "An approver reviews the deletion first.",
  );
  await user.click(screen.getByRole("button", { name: "Delete" }));

  await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
  expect(mutations.requestImageDeletion).toHaveBeenCalledWith({
    mediaId: MEDIA_ID,
  });
  expect(mutations.deleteImage).not.toHaveBeenCalled();
  expect(toasts.success).toHaveBeenCalledWith(
    "Image deletion sent for approval",
  );
});

test("a refusal is explained in the app's words and the image stays", async () => {
  mutations.requestImageDeletion.mockRejectedValue(
    imageDeletionError("IMAGE_CITED_AS_EVIDENCE", "cited"),
  );
  const user = userEvent.setup();
  const onDone = vi.fn();
  await renderOnPage(<DeleteFromEditor requiresApproval onDone={onDone} />);

  await user.click(screen.getByRole("button", { name: "Delete image" }));
  await user.click(screen.getByRole("button", { name: "Delete" }));

  await waitFor(() =>
    expect(toasts.error).toHaveBeenCalledWith(
      "This image is cited as evidence by a condition assessment, provenance claim, incident, task or reproduction request, so it cannot be deleted.",
    ),
  );
  expect(onDone).not.toHaveBeenCalled();
  expect(
    screen.getByRole("alertdialog", {
      name: "Are you sure you want to delete this image?",
    }),
  ).toBeTruthy();
});
