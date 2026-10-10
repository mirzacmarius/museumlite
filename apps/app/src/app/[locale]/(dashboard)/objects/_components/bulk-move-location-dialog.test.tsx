// @vitest-environment jsdom
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import {
  capabilityUnavailable,
  permissionMissingMessage,
} from "@v1/backend/convex/utils/capabilities";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRef } from "react";
import { beforeEach, expect, test, vi } from "vitest";
import { renderOnPage } from "@/testing/render-on-page";
import { BulkMoveLocationDialog } from "./bulk-move-location-dialog";

const bulkUpdateLocation = vi.fn();
vi.mock("convex/react", () => ({
  useQuery: () => [
    {
      _id: "loc-b",
      status: "active",
      path: [{ name: "Store" }, { name: "Room B" }],
    },
  ],
  useMutation: () => bulkUpdateLocation,
}));

beforeEach(() => {
  bulkUpdateLocation.mockReset();
});

function MoveSelected({ onSuccess = () => {} }: { onSuccess?: () => void }) {
  const listRef = useRef<HTMLElement>(null);
  return (
    <>
      <section ref={listRef} tabIndex={-1} aria-label="Object Catalog" />
      <BulkMoveLocationDialog
        open
        onOpenChange={() => {}}
        selectedIds={["o1", "o2"] as Id<"collections">[]}
        organizationId={"org" as Id<"organizations">}
        onSuccess={onSuccess}
        returnFocusRef={listRef}
      />
    </>
  );
}

async function chooseRoomBAndMove() {
  const user = userEvent.setup();
  await user.click(screen.getByRole("combobox", { name: "New Location" }));
  await user.click(
    await screen.findByRole("option", { name: "Store > Room B" }),
  );
  await user.click(screen.getByRole("button", { name: "Move Items" }));
}

test("a move the server refuses is explained in the dialog, which keeps the choice", async () => {
  bulkUpdateLocation.mockRejectedValue(
    capabilityUnavailable({
      reason: "permission_missing",
      message: permissionMissingMessage("collections.update"),
    }),
  );
  const onSuccess = vi.fn();
  await renderOnPage(<MoveSelected onSuccess={onSuccess} />);

  await chooseRoomBAndMove();

  const refusal = await screen.findByRole("alert");
  expect(refusal.textContent).toBe(
    "Your role does not include access to this. Ask an administrator to update your role.",
  );
  expect(document.activeElement).toBe(refusal);
  const location = screen.getByRole("combobox", { name: "New Location" });
  expect(location.textContent).toContain("Store > Room B");
  expect(location.getAttribute("aria-describedby")).toContain(refusal.id);
  expect(onSuccess).not.toHaveBeenCalled();
});
