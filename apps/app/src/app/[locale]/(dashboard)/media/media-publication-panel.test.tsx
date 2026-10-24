// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { getFunctionName } from "convex/server";
import type { ComponentProps } from "react";
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
const IN_COPYRIGHT = "http://rightsstatements.org/vocab/InC/1.0/";
const CC_BY = "https://creativecommons.org/licenses/by/4.0/";
const organization = {
  _id: "org-1",
  settings: { rightsDefaults: { mediaRightsStatement: IN_COPYRIGHT } },
};
const setHiddenFromPortal = vi.fn();
const updateRights = vi.fn();
vi.mock("convex/react", () => ({
  useQuery: (reference: unknown) => {
    switch (getFunctionName(reference as never)) {
      case "mediaPublications:getReview":
        return review;
      case "organizations:get":
        return organization;
      default:
        return undefined;
    }
  },
  useMutation: (reference: unknown) => {
    switch (getFunctionName(reference as never)) {
      case "mediaPublications:setHiddenFromPortal":
        return setHiddenFromPortal;
      case "media:updateRights":
        return updateRights;
      default:
        return vi.fn();
    }
  },
}));

beforeEach(() => {
  setHiddenFromPortal.mockReset();
  setHiddenFromPortal.mockResolvedValue(null);
  updateRights.mockReset();
  updateRights.mockResolvedValue(null);
  review.portal = "shown";
});

const mediaId = "media-1" as Id<"mediaFiles">;
const organizationId = "org-1" as Id<"organizations">;

async function renderPanel(
  item: ComponentProps<typeof MediaPublicationPanel>["item"] = {},
) {
  await renderOnPage(
    <MediaPublicationPanel
      mediaId={mediaId}
      organizationId={organizationId}
      item={item}
    />,
    "/en/media",
  );
  return userEvent.setup();
}

function statementSelect() {
  return screen.getByRole("combobox", { name: "Rights statement" });
}

function saveRightsButton() {
  return screen.getByRole("button", { name: "Save rights" });
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

test("a statement chosen alone is saved without the recorded rights, so the approval stays", async () => {
  const user = await renderPanel({ rightsStatus: "owned" });

  expect(statementSelect().textContent).toBe(
    "Organization default (In Copyright)",
  );
  expect(saveRightsButton()).toHaveProperty("disabled", true);
  await user.click(statementSelect());
  await user.click(
    screen.getByRole("option", {
      name: "Creative Commons Attribution 4.0 International",
    }),
  );
  await user.click(saveRightsButton());

  expect(updateRights).toHaveBeenCalledWith({
    mediaId,
    rightsStatement: CC_BY,
  });
});

test("changed recorded rights are saved and the file's statement is left alone", async () => {
  const user = await renderPanel({ rightsStatement: CC_BY });

  expect(statementSelect().textContent).toBe(
    "Creative Commons Attribution 4.0 International",
  );
  await user.selectOptions(
    screen.getByRole("combobox", { name: "Rights status" }),
    "licensed",
  );
  await user.click(saveRightsButton());

  expect(updateRights).toHaveBeenCalledWith({
    mediaId,
    rightsStatus: "licensed",
    licenseType: null,
    licenseExpiry: null,
    usageRestrictions: null,
    requiresAcknowledgment: false,
  });
});

test("choosing the organization default clears the file's own statement", async () => {
  const user = await renderPanel({ rightsStatement: CC_BY });

  await user.click(statementSelect());
  await user.click(
    screen.getByRole("option", { name: "Organization default (In Copyright)" }),
  );
  await user.click(saveRightsButton());

  expect(updateRights).toHaveBeenCalledWith({
    mediaId,
    rightsStatement: null,
  });
});
