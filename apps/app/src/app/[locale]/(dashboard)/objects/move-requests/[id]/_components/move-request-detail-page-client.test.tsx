// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { objectMoveError } from "@v1/backend/convex/utils/objectMoveErrors";
import { getFunctionName } from "convex/server";
import { beforeEach, expect, test, vi } from "vitest";
import { renderOnPage } from "@/testing/render-on-page";
import { MoveRequestDetailPageClient } from "./move-request-detail-page-client";

const SOURCE = "source-org";
const TARGET = "target-org";

const state = vi.hoisted(() => ({
  request: null as Record<string, unknown> | null,
  currentUserId: "admin",
  currentOrganizationId: "source-org",
  locationTrackingEnabled: true,
  permissions: new Set<string>(),
  mutations: {} as Record<string, ReturnType<typeof vi.fn>>,
}));
const toasts = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));

vi.mock("sonner", () => ({ toast: toasts }));
vi.mock("convex/react", () => ({
  useQuery: (query: never, args: unknown) => {
    if (args === "skip") return undefined;
    switch (getFunctionName(query)) {
      case "objectMoves:get":
        return state.request;
      case "users:getUser":
        return { _id: state.currentUserId };
      default:
        return undefined;
    }
  },
  useMutation: (mutation: never) => {
    const name = getFunctionName(mutation);
    state.mutations[name] ??= vi.fn().mockResolvedValue(null);
    return state.mutations[name];
  },
}));
vi.mock("@/components/organization-provider", () => ({
  useOrganization: () => ({
    currentOrganizationId: state.currentOrganizationId,
    currentOrganization: {
      _id: state.currentOrganizationId,
      settings: { locationTrackingEnabled: state.locationTrackingEnabled },
    },
  }),
}));
vi.mock("@/components/permission-gate", () => ({
  usePermissions: () => ({
    isLoading: false,
    hasPermission: (permission: string) => state.permissions.has(permission),
  }),
}));
vi.mock("@/components/location-selector", () => ({
  LocationSelector: ({
    onValueChange,
  }: {
    onValueChange: (id: string) => void;
  }) => (
    <button type="button" onClick={() => onValueChange("north-store")}>
      North store
    </button>
  ),
}));

function moveRequest(status: string) {
  return {
    _id: "move-1",
    status,
    collectionId: "object-1",
    collection: {
      _id: "object-1",
      title: "Viking brooch",
      accessionNumber: "A-1",
    },
    sourceAccessionNumber: "A-1",
    accessionMode: "keep",
    reason: "Rotation",
    requestedBy: "requester",
    requestedAt: Date.UTC(2026, 9, 1),
    sourceOrganizationId: SOURCE,
    targetOrganizationId: TARGET,
    sourceOrganization: { _id: SOURCE, name: "Museum Sør" },
    targetOrganization: { _id: TARGET, name: "Museum Nord" },
    requestedByUser: { name: "Ola Nordmann" },
    custodyEvents: [],
    receiverGeneratesAccessionNumbers: true,
  };
}

async function openRequest(
  status: string,
  viewer: { userId: string; organizationId: string; canManage: boolean },
  options: { url?: string; request?: Record<string, unknown> } = {},
) {
  state.request = { ...moveRequest(status), ...options.request };
  state.currentUserId = viewer.userId;
  state.currentOrganizationId = viewer.organizationId;
  state.permissions = new Set(
    viewer.canManage ? ["organization.manage_settings"] : [],
  );
  await renderOnPage(
    <MoveRequestDetailPageClient />,
    options.url ?? "/en/objects/move-requests/move-1",
    { id: "move-1" },
  );
}

function button(name: string) {
  return screen.queryByRole("button", { name });
}

beforeEach(() => {
  state.mutations = {};
  state.locationTrackingEnabled = true;
  toasts.success.mockReset();
  toasts.error.mockReset();
});

test("before approval a source administrator approves or cancels, with Cancel in red and no separate Reject", async () => {
  await openRequest("pending_source_approval", {
    userId: "admin",
    organizationId: SOURCE,
    canManage: true,
  });

  expect(button("Approve for transfer")).toBeTruthy();
  expect(button("Reject request")).toBeNull();
  const cancel = button("Cancel request");
  expect(cancel?.getAttribute("data-variant")).toBe("destructive");

  const notes = screen.getByLabelText("Review notes");
  await userEvent.type(notes, " Duplicate of an earlier request ");
  await userEvent.click(cancel as HTMLElement);
  expect(state.mutations["objectMoves:cancel"]).toHaveBeenCalledWith({
    requestId: "move-1",
    reviewNotes: "Duplicate of an earlier request",
  });
  expect((notes as HTMLTextAreaElement).value).toBe("");
});

test("the requester who cannot approve still cancels with the red Cancel", async () => {
  await openRequest("pending_source_approval", {
    userId: "requester",
    organizationId: SOURCE,
    canManage: false,
  });

  expect(button("Approve for transfer")).toBeNull();
  expect(button("Reject request")).toBeNull();
  expect(button("Cancel request")?.getAttribute("data-variant")).toBe(
    "destructive",
  );
});

test("the receiving organization accepts or declines an incoming transfer", async () => {
  await openRequest("awaiting_acceptance", {
    userId: "target-admin",
    organizationId: TARGET,
    canManage: true,
  });

  expect(button("Accept and complete transfer")).toBeTruthy();
  expect(button("Reject request")?.getAttribute("data-variant")).toBe(
    "destructive",
  );
  expect(button("Cancel request")).toBeNull();
});

test("a refused acceptance tells the receiving organization in its own terms", async () => {
  await openRequest("awaiting_acceptance", {
    userId: "target-admin",
    organizationId: TARGET,
    canManage: true,
  });
  const accept = state.mutations["objectMoves:accept"];
  if (!accept) throw new Error("The page did not set up acceptance");
  accept.mockRejectedValueOnce(
    objectMoveError(
      "DESTINATION_NOT_ACCEPTING",
      "Your organization does not accept incoming transfer requests and is outside the sending organization's hierarchy.",
    ),
  );

  await userEvent.click(button("North store") as HTMLElement);
  await userEvent.click(button("Accept and complete transfer") as HTMLElement);

  expect(accept).toHaveBeenCalledTimes(1);
  expect(toasts.error).toHaveBeenLastCalledWith(
    "Your organization does not accept incoming transfer requests and is outside the sending organization's hierarchy.",
  );
});

test("a refused approval says why in the app's language", async () => {
  await openRequest("pending_source_approval", {
    userId: "admin",
    organizationId: SOURCE,
    canManage: true,
  });
  const approve = state.mutations["objectMoves:approve"];
  if (!approve) throw new Error("The page did not set up approval");

  approve.mockRejectedValueOnce(
    objectMoveError(
      "DESTINATION_OUTSIDE_HIERARCHY",
      "Objects can only be transferred between organizations in the same hierarchy.",
    ),
  );
  await userEvent.click(button("Approve for transfer") as HTMLElement);
  expect(toasts.error).toHaveBeenLastCalledWith(
    "The destination organization is outside your organization's hierarchy and does not allow incoming transfer requests.",
  );

  approve.mockRejectedValueOnce(
    objectMoveError(
      "MOVE_BLOCKED",
      "This object is currently on loan and cannot be moved.",
      ["active_loan"],
    ),
  );
  await userEvent.click(button("Approve for transfer") as HTMLElement);
  expect(toasts.error).toHaveBeenLastCalledWith(
    "This object is currently on loan and cannot be moved.",
  );

  approve.mockRejectedValueOnce(new Error("Server Error"));
  await userEvent.click(button("Approve for transfer") as HTMLElement);
  expect(toasts.error).toHaveBeenLastCalledWith(
    "Failed to approve move request.",
  );
});

test.each([
  ["cancelled", "Source cancelled at", "Source approved at"],
  ["awaiting_acceptance", "Source approved at", "Source cancelled at"],
])("a %s request names the source review it records", async (status, shown, hidden) => {
  state.request = {
    ...moveRequest(status),
    sourceReviewedAt: Date.UTC(2026, 9, 2),
  };
  state.currentUserId = "admin";
  state.currentOrganizationId = SOURCE;
  state.permissions = new Set(["organization.manage_settings"]);
  await renderOnPage(
    <MoveRequestDetailPageClient />,
    "/en/objects/move-requests/move-1",
    { id: "move-1" },
  );

  expect(screen.getByText(shown)).toBeTruthy();
  expect(screen.queryByText(hidden)).toBeNull();
});

test("the receiving organization declines without writing notes", async () => {
  await openRequest("awaiting_acceptance", {
    userId: "target-admin",
    organizationId: TARGET,
    canManage: true,
  });

  await userEvent.click(button("Reject request") as HTMLElement);

  expect(state.mutations["objectMoves:reject"]).toHaveBeenCalledWith({
    requestId: "move-1",
    reviewNotes: undefined,
  });
  expect(toasts.error).not.toHaveBeenCalled();
  expect(toasts.success).toHaveBeenCalledWith("Move request rejected.");
});

test("the receiving organization chooses the accession number when it accepts", async () => {
  await openRequest("awaiting_acceptance", {
    userId: "target-admin",
    organizationId: TARGET,
    canManage: true,
  });
  expect(
    screen.getByText("Chosen by the receiving organization when it accepts"),
  ).toBeTruthy();
  const choice = screen.getByRole("combobox", { name: "Accession number" });
  expect(choice.textContent).toBe("Generate a new number");

  await userEvent.click(choice);
  await userEvent.click(
    await screen.findByRole("option", { name: "Enter a new number" }),
  );
  await userEvent.type(
    screen.getByLabelText("New accession number"),
    "NORD-2026-7",
  );
  await userEvent.click(button("North store") as HTMLElement);
  await userEvent.click(button("Accept and complete transfer") as HTMLElement);

  expect(state.mutations["objectMoves:accept"]).toHaveBeenCalledWith({
    requestId: "move-1",
    targetLocationId: "north-store",
    reviewNotes: undefined,
    accessionMode: "manual",
    requestedAccessionNumber: "NORD-2026-7",
  });
});

test("a taken accession number is named back to the receiving organization", async () => {
  await openRequest("awaiting_acceptance", {
    userId: "target-admin",
    organizationId: TARGET,
    canManage: true,
  });
  state.mutations["objectMoves:accept"]?.mockRejectedValueOnce(
    objectMoveError(
      "ACCESSION_NUMBER_TAKEN",
      'Accession number "A-1" already exists in the destination organization',
      undefined,
      "A-1",
    ),
  );

  await userEvent.click(button("North store") as HTMLElement);
  await userEvent.click(button("Accept and complete transfer") as HTMLElement);

  expect(toasts.error).toHaveBeenLastCalledWith(
    "A-1 is already used in your organization. Generate or enter a new number.",
  );
});

test("the receiving organization accepts without choosing a location", async () => {
  await openRequest("awaiting_acceptance", {
    userId: "target-admin",
    organizationId: TARGET,
    canManage: true,
  });
  expect(
    screen.getByText(/Optional\. Leave it empty if you don't track locations/),
  ).toBeTruthy();

  await userEvent.click(button("Accept and complete transfer") as HTMLElement);

  expect(toasts.error).not.toHaveBeenCalled();
  expect(state.mutations["objectMoves:accept"]).toHaveBeenCalledWith({
    requestId: "move-1",
    targetLocationId: undefined,
    reviewNotes: undefined,
    accessionMode: "auto",
    requestedAccessionNumber: undefined,
  });
});

test("a receiver that turned off locations is not asked for one", async () => {
  state.locationTrackingEnabled = false;
  await openRequest("awaiting_acceptance", {
    userId: "target-admin",
    organizationId: TARGET,
    canManage: true,
  });

  expect(screen.queryByText("Receiving location")).toBeNull();
  expect(button("North store")).toBeNull();
  expect(button("Accept and complete transfer")).toBeTruthy();
});

test("the back link returns to the Transfers board", async () => {
  await openRequest("awaiting_acceptance", {
    userId: "target-admin",
    organizationId: TARGET,
    canManage: true,
  });

  expect(
    screen
      .getByRole("link", { name: "Back to transfers" })
      .getAttribute("href"),
  ).toMatch(/\/accessions\/transfers$/);
});

test("staff who cannot open the Transfers board go back to the object", async () => {
  await openRequest("awaiting_acceptance", {
    userId: "requester",
    organizationId: SOURCE,
    canManage: false,
  });

  expect(screen.queryByRole("link", { name: "Back to transfers" })).toBeNull();
  expect(
    screen.getByRole("link", { name: "Back to object" }).getAttribute("href"),
  ).toMatch(/\/objects\/object-1$/);
});

test("opened from a list, the back link returns to it", async () => {
  await openRequest(
    "rejected",
    { userId: "requester", organizationId: SOURCE, canManage: false },
    { url: "/en/objects/move-requests/move-1?from=%2Fdeaccessions" },
  );

  expect(
    screen.getByRole("link", { name: "Back to results" }).getAttribute("href"),
  ).toBe("/deaccessions");
});

test("a receiver without automatic numbering starts from the current number", async () => {
  await openRequest(
    "awaiting_acceptance",
    { userId: "target-admin", organizationId: TARGET, canManage: true },
    { request: { receiverGeneratesAccessionNumbers: false } },
  );

  expect(
    screen.getByRole("combobox", { name: "Accession number" }).textContent,
  ).toBe("Keep the current number (A-1)");
  await userEvent.click(button("Accept and complete transfer") as HTMLElement);
  expect(state.mutations["objectMoves:accept"]).toHaveBeenCalledWith(
    expect.objectContaining({ accessionMode: "keep" }),
  );
});
