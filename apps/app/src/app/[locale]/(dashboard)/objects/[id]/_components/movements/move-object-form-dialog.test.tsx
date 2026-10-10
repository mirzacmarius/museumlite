// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { custodyConflict } from "@v1/backend/convex/utils/custodyErrors";
import { getFunctionName } from "convex/server";
import { beforeEach, expect, test, vi } from "vitest";
import { renderOnPage } from "@/testing/render-on-page";
import { MoveObjectFormDialog } from "./move-object-form-dialog";

const LOCATIONS = [
  { _id: "store", name: "Store room B", type: "room", status: "active" },
  { _id: "gallery", name: "Gallery 2", type: "room", status: "active" },
  { _id: "quarantine", name: "Quarantine bay", type: "room", status: "active" },
].map((location) => ({
  ...location,
  path: [{ name: location.name, type: location.type }],
}));

const moveObject = vi.fn();
vi.mock("convex/react", () => ({
  useQuery: (reference: unknown, args: unknown) => {
    if (args === "skip") return undefined;
    switch (getFunctionName(reference as never)) {
      case "locations:listAllWithPaths":
        return LOCATIONS;
      case "locations:checkMoveAllowed":
        return { issues: [] };
      default:
        return undefined;
    }
  },
  useMutation: (reference: unknown) =>
    getFunctionName(reference as never) === "locations:moveObject"
      ? moveObject
      : vi.fn(),
}));

beforeEach(() => {
  moveObject.mockReset();
});

function dialogAt(location: { id: string; label: string }, onClose = vi.fn()) {
  return (
    <MoveObjectFormDialog
      mode="direct"
      collectionId={"object-1" as Id<"collections">}
      organizationId={"org" as Id<"organizations">}
      currentLocationId={location.id as Id<"locations">}
      currentLocationLabel={location.label}
      onClose={onClose}
    />
  );
}

test("a colleague's move while the dialog is open is refused, explained there, and the move goes through once confirmed again", async () => {
  const onClose = vi.fn();
  const { rerender } = await renderOnPage(
    dialogAt({ id: "store", label: "Store room B" }, onClose),
  );
  // A colleague moves the object to Gallery 2; the page updates live.
  rerender(dialogAt({ id: "gallery", label: "Gallery 2" }, onClose));
  const user = userEvent.setup();
  await user.click(screen.getByRole("combobox", { name: "Destination *" }));
  await user.click(
    await screen.findByRole("option", { name: "Quarantine bay (room)" }),
  );
  moveObject.mockRejectedValueOnce(
    custodyConflict("SOURCE_CHANGED", "Object moved", {
      currentLocationName: "Gallery 2",
    }),
  );

  await user.click(screen.getByRole("button", { name: "Move object" }));

  expect(moveObject.mock.calls[0]?.[0]).toMatchObject({
    expectedFromLocationId: "store",
    toLocationId: "quarantine",
  });
  const refusal = await screen.findByRole("alert");
  expect(refusal.textContent).toBe(
    "This object is now at Gallery 2. Refresh, confirm where it is, and record the handoff again.",
  );
  expect(document.activeElement).toBe(refusal);
  expect(screen.getByText("Gallery 2")).toBeTruthy();
  expect(onClose).not.toHaveBeenCalled();

  moveObject.mockResolvedValueOnce(null);
  await user.click(screen.getByRole("button", { name: "Move object" }));

  expect(moveObject.mock.calls[1]?.[0]).toMatchObject({
    expectedFromLocationId: "gallery",
    toLocationId: "quarantine",
  });
  expect(onClose).toHaveBeenCalled();
});

test("moving without a destination says so at the destination and focuses it", async () => {
  await renderOnPage(dialogAt({ id: "store", label: "Store room B" }));
  const user = userEvent.setup();

  await user.click(screen.getByRole("button", { name: "Move object" }));

  const destination = screen.getByRole("combobox", { name: "Destination *" });
  expect(destination.getAttribute("aria-invalid")).toBe("true");
  const described = destination.getAttribute("aria-describedby") ?? "";
  expect(document.getElementById(described)?.textContent).toBe(
    "Select a destination.",
  );
  expect(document.activeElement).toBe(destination);
  expect(moveObject).not.toHaveBeenCalled();
});
