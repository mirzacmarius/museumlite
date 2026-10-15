// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { getFunctionName } from "convex/server";
import { beforeEach, expect, test, vi } from "vitest";
import { renderOnPage } from "@/testing/render-on-page";
import { MediaPublicationPanel } from "./media-publication-panel";

const review = {
  canManage: true,
  blocker: "Rights must be owned, public domain, or licensed for public use",
  status: "private",
  portal: "shown",
  publicRenditionUrl: null,
  originalDownloadAllowed: false,
};
const setHiddenFromPortal = vi.fn();
vi.mock("convex/react", () => ({
  useQuery: (reference: unknown) =>
    getFunctionName(reference as never) === "mediaPublications:getReview"
      ? review
      : undefined,
  useMutation: (reference: unknown) =>
    getFunctionName(reference as never) ===
    "mediaPublications:setHiddenFromPortal"
      ? setHiddenFromPortal
      : vi.fn(),
}));

beforeEach(() => {
  setHiddenFromPortal.mockReset();
  setHiddenFromPortal.mockResolvedValue(null);
  review.portal = "shown";
});

const mediaId = "media-1" as Id<"mediaFiles">;

async function renderPanel() {
  await renderOnPage(
    <MediaPublicationPanel mediaId={mediaId} item={{}} />,
    "/en/media",
  );
  return userEvent.setup();
}

test("an image shown in the portal says so and staff can hide it", async () => {
  const user = await renderPanel();

  expect(
    screen.getByText(
      "Shown in the public portal when its object is published there.",
    ),
  ).toBeDefined();
  expect(screen.getByText("Not approved for original download")).toBeDefined();
  await user.click(
    screen.getByRole("button", { name: "Hide from public portal" }),
  );

  expect(setHiddenFromPortal).toHaveBeenCalledWith({ mediaId, hidden: true });
});

test("a hidden image can be shown in the portal again", async () => {
  review.portal = "hidden";
  const user = await renderPanel();

  expect(screen.getByText("Hidden from the public portal.")).toBeDefined();
  await user.click(
    screen.getByRole("button", { name: "Show in public portal" }),
  );

  expect(setHiddenFromPortal).toHaveBeenCalledWith({ mediaId, hidden: false });
});
