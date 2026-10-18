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
  };
}

async function openRequest(
  status: string,
  viewer: { userId: string; organizationId: string; canManage: boolean },
) {
  state.request = moveRequest(status);
  state.currentUserId = viewer.userId;
  state.currentOrganizationId = viewer.organizationId;
  state.permissions = new Set(
    viewer.canManage ? ["organization.manage_settings"] : [],
  );
  await renderOnPage(
    <MoveRequestDetailPageClient />,
    "/en/objects/move-requests/move-1",
    { id: "move-1" },
  );
}

function button(name: string) {
  return screen.queryByRole("button", { name });
}

beforeEach(() => {
  state.mutations = {};
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
