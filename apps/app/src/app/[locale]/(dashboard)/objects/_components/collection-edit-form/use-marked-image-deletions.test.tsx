// @vitest-environment jsdom

import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { imageDeletionError } from "@v1/backend/convex/utils/imageDeletionErrors";
import { getFunctionName } from "convex/server";
import { useState } from "react";
import { beforeEach, expect, test, vi } from "vitest";
import { renderOnPage } from "@/testing/render-on-page";
import { useCollectionEditFormSubmit } from "./use-collection-edit-form-submit";
import { useMarkedImageDeletions } from "./use-marked-image-deletions";

const mutations = vi.hoisted(() => ({
  requestImageDeletion: vi.fn(),
  deleteImage: vi.fn(),
  update: vi.fn(),
}));
const push = vi.hoisted(() => vi.fn());

vi.mock("convex/react", () => ({
  useMutation: (mutation: never) => {
    switch (getFunctionName(mutation)) {
      case "mediaDeletions:requestImageDeletion":
        return mutations.requestImageDeletion;
      case "mediaDeletions:deleteImage":
        return mutations.deleteImage;
      default:
        return mutations.update;
    }
  },
}));
vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  useRouter: () => ({ push }),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const save = vi.fn();

beforeEach(() => {
  mutations.requestImageDeletion.mockReset().mockResolvedValue("request-1");
  mutations.deleteImage.mockReset().mockResolvedValue(null);
  push.mockReset();
  save.mockReset().mockImplementation(async (_run, afterSave) => {
    afterSave?.();
    return true;
  });
});

const FRONT = "image-front" as Id<"mediaFiles">;
const BACK = "image-back" as Id<"mediaFiles">;

/** The edit form's marking and Update Object, without its fields. */
function EditForm({ isDirty = false }: { isDirty?: boolean }) {
  const [error, setError] = useState<string | null>(null);
  const deletions = useMarkedImageDeletions({ setError });
  const { canUpdateObject, handleSubmit } = useCollectionEditFormSubmit({
    collectionId: "object-1",
    typedCollectionId: "object-1" as Id<"collections">,
    session: { isDirty, save },
    hasMediaChanges: false,
    hasMarkedImages: deletions.hasMarkedImages,
    sendImageDeletions: deletions.sendImageDeletions,
  });
  return (
    <form onSubmit={handleSubmit}>
      <button
        type="button"
        onClick={() => deletions.markImageForDeletion(FRONT, true)}
      >
        Delete front
      </button>
      <button
        type="button"
        onClick={() => deletions.markImageForDeletion(BACK, false)}
      >
        Delete back
      </button>
      <button type="button" onClick={() => deletions.keepImage(FRONT)}>
        Keep front
      </button>
      <button type="button" onClick={deletions.keepAllImages}>
        Discard
      </button>
      <button type="submit" disabled={!canUpdateObject}>
        Update Object
      </button>
      {error ? <p role="alert">{error}</p> : null}
    </form>
  );
}

function updateButton() {
  return screen.getByRole<HTMLButtonElement>("button", {
    name: "Update Object",
  });
}

test("a marked image is sent only with Update Object, for approval or deleted as the organization requires", async () => {
  const user = userEvent.setup();
  await renderOnPage(<EditForm />, "/en/objects/object-1/edit");
  expect(updateButton().disabled).toBe(true);

  await user.click(screen.getByRole("button", { name: "Delete front" }));
  await user.click(screen.getByRole("button", { name: "Delete back" }));
  expect(updateButton().disabled).toBe(false);
  expect(mutations.requestImageDeletion).not.toHaveBeenCalled();
  expect(mutations.deleteImage).not.toHaveBeenCalled();

  await user.click(updateButton());

  await waitFor(() => expect(push).toHaveBeenCalledWith("/objects/object-1"));
  expect(mutations.requestImageDeletion).toHaveBeenCalledWith({
    mediaId: FRONT,
  });
  expect(mutations.deleteImage).toHaveBeenCalledWith({ mediaId: BACK });
  expect(save).not.toHaveBeenCalled();
});

test("keeping a marked image, or leaving without updating, sends nothing", async () => {
  const user = userEvent.setup();
  await renderOnPage(<EditForm />, "/en/objects/object-1/edit");

  await user.click(screen.getByRole("button", { name: "Delete front" }));
  await user.click(screen.getByRole("button", { name: "Keep front" }));
  expect(updateButton().disabled).toBe(true);

  await user.click(screen.getByRole("button", { name: "Delete front" }));
  await user.click(screen.getByRole("button", { name: "Discard" }));
  expect(updateButton().disabled).toBe(true);
  expect(mutations.requestImageDeletion).not.toHaveBeenCalled();
});

test("marked images are sent once the field changes have saved", async () => {
  const user = userEvent.setup();
  await renderOnPage(<EditForm isDirty />, "/en/objects/object-1/edit");

  await user.click(screen.getByRole("button", { name: "Delete front" }));
  await user.click(updateButton());

  await waitFor(() => expect(push).toHaveBeenCalledWith("/objects/object-1"));
  expect(mutations.requestImageDeletion).toHaveBeenCalledWith({
    mediaId: FRONT,
  });
  expect(save).toHaveBeenCalledOnce();
  expect(save.mock.invocationCallOrder[0]).toBeLessThan(
    mutations.requestImageDeletion.mock.invocationCallOrder[0] as number,
  );
});

test("when the fields are refused, no image is deleted, so Cancel still keeps them all", async () => {
  save.mockResolvedValue(false);
  const user = userEvent.setup();
  await renderOnPage(<EditForm isDirty />, "/en/objects/object-1/edit");

  await user.click(screen.getByRole("button", { name: "Delete front" }));
  await user.click(screen.getByRole("button", { name: "Delete back" }));
  await user.click(updateButton());

  await waitFor(() => expect(save).toHaveBeenCalledOnce());
  expect(mutations.requestImageDeletion).not.toHaveBeenCalled();
  expect(mutations.deleteImage).not.toHaveBeenCalled();
  expect(push).not.toHaveBeenCalled();
});

test("a refused deletion keeps staff on the form with the reason and the image still marked", async () => {
  mutations.requestImageDeletion.mockRejectedValue(
    imageDeletionError("IMAGE_CITED_AS_EVIDENCE", "cited"),
  );
  const user = userEvent.setup();
  await renderOnPage(<EditForm isDirty />, "/en/objects/object-1/edit");

  await user.click(screen.getByRole("button", { name: "Delete front" }));
  await user.click(screen.getByRole("button", { name: "Delete back" }));
  await user.click(updateButton());

  expect((await screen.findByRole("alert")).textContent).toBe(
    "This image is cited as evidence by a condition assessment, provenance claim, incident, task or reproduction request, so it cannot be deleted.",
  );
  expect(mutations.deleteImage).toHaveBeenCalledWith({ mediaId: BACK });
  expect(save).toHaveBeenCalledOnce();
  expect(push).not.toHaveBeenCalled();
  expect(updateButton().disabled).toBe(false);
});
