// @vitest-environment jsdom
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { objectMoveError } from "@v1/backend/convex/utils/objectMoveErrors";
import { getFunctionName } from "convex/server";
import { beforeEach, expect, test, vi } from "vitest";
import { renderOnPage } from "@/testing/render-on-page";
import { DeaccessionDialog } from "./deaccession-dialog";

const state = vi.hoisted(() => ({
  eligibility: undefined as unknown,
  createRequest: vi.fn(),
}));

vi.mock("convex/react", () => ({
  useQuery: (query: never, args: unknown) => {
    if (args === "skip") return undefined;
    return getFunctionName(query) === "objectMoves:getEligibility"
      ? state.eligibility
      : undefined;
  },
  useMutation: (mutation: never) =>
    getFunctionName(mutation) === "objectMoves:createRequest"
      ? state.createRequest
      : vi.fn(),
}));
vi.mock("./transfer-destination-picker", () => ({
  TransferDestinationPicker: ({
    onValueChange,
  }: {
    onValueChange: (id: string) => void;
  }) => (
    <button type="button" onClick={() => onValueChange("museum-nord")}>
      Museum Nord
    </button>
  ),
}));

async function openMoveDialog() {
  await renderOnPage(
    <DeaccessionDialog
      open
      onOpenChange={vi.fn()}
      collectionId={"object-1" as Id<"collections">}
      collectionTitle="Viking brooch"
      organizationId={"museum-sor" as Id<"organizations">}
      initialRemovalType="move"
    />,
    "/en/objects/object-1",
    { id: "object-1" },
  );
  await userEvent.click(screen.getByRole("button", { name: "Museum Nord" }));
}

beforeEach(() => {
  state.eligibility = undefined;
  state.createRequest = vi.fn();
});

test("a transfer request refused before eligibility has loaded says why in the app's language", async () => {
  state.createRequest.mockRejectedValue(
    objectMoveError(
      "HIERARCHY_PLAN_REQUIRED",
      "Hierarchical transfers require a Pro or Enterprise plan.",
    ),
  );
  await openMoveDialog();

  await userEvent.type(
    screen.getByLabelText("Reason for Move *"),
    "Rotation to the northern branch",
  );
  await userEvent.click(
    screen.getByRole("button", { name: "Submit move request" }),
  );

  expect(state.createRequest).toHaveBeenCalledTimes(1);
  expect(
    await screen.findByText(
      "Transfers between organizations in the same hierarchy need the Pro or Enterprise plan.",
    ),
  ).toBeTruthy();
  expect(
    screen.queryByText("Failed to process object removal or transfer"),
  ).toBeNull();
});

test("what stops a transfer to the chosen organization is listed in the app's language", async () => {
  state.eligibility = {
    isEligible: false,
    blockers: [
      {
        code: "hierarchy_plan_required",
        message: "Hierarchical transfers require a Pro or Enterprise plan.",
      },
      {
        code: "target_create_permission_required",
        message:
          "You need collection creation permission in the destination organization.",
      },
    ],
  };
  await openMoveDialog();

  const reasons = within(
    screen.getByText("This object cannot be moved yet").parentElement ??
      document.body,
  )
    .getAllByRole("listitem")
    .map((item) => item.textContent);
  expect(reasons).toEqual([
    "Transfers between organizations in the same hierarchy need the Pro or Enterprise plan.",
    "You need permission to create objects in the destination organization.",
  ]);
});
