// @vitest-environment jsdom
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { identifierError } from "@v1/backend/convex/utils/identifierErrors";
import { objectMoveError } from "@v1/backend/convex/utils/objectMoveErrors";
import { getFunctionName } from "convex/server";
import { beforeEach, expect, test, vi } from "vitest";
import { renderOnPage } from "@/testing/render-on-page";
import { MoveRequestDetailPageClient } from "./move-request-detail-page-client";

const SOURCE = "source-org";
const TARGET = "target-org";

type ViewerAction = {
  action: "approve" | "accept" | "decline" | "cancel";
  organizationId: string;
  takesNotes: boolean;
};

/** What the backend offers each side's administrators. */
const SENDER_ADMIN: ViewerAction[] = [
  { action: "approve", organizationId: SOURCE, takesNotes: true },
  { action: "cancel", organizationId: SOURCE, takesNotes: true },
];
const RECEIVER_ADMIN: ViewerAction[] = [
  { action: "accept", organizationId: TARGET, takesNotes: true },
  { action: "decline", organizationId: TARGET, takesNotes: true },
];

const state = vi.hoisted(() => ({
  request: null as Record<string, unknown> | null,
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

function moveRequest(stage: string) {
  return {
    _id: "move-1",
    stage,
    awaitsSenderReapproval: false,
    approvedBySender: stage === "waiting_for_receiver" || stage === "received",
    actions: [] as ViewerAction[],
    receiverTracksLocations: true,
    collectionId: "object-1",
    collection: {
      _id: "object-1",
      organizationId: SOURCE,
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

/**
 * Opens the transfer at `stage` for a viewer who selected
 * `viewer.organizationId`, offered `options.actions` as the backend decides.
 */
async function openRequest(
  stage: string,
  viewer: { organizationId: string; canManage: boolean },
  options: {
    actions?: ViewerAction[];
    url?: string;
    request?: Record<string, unknown>;
  } = {},
) {
  state.request = {
    ...moveRequest(stage),
    actions: options.actions ?? [],
    ...options.request,
  };
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

function onBehalfOf(organization: string) {
  return within(
    screen.getByRole("group", { name: `On behalf of ${organization}` }),
  );
}

beforeEach(() => {
  state.mutations = {};
  toasts.success.mockReset();
  toasts.error.mockReset();
});

const SENDER = { organizationId: SOURCE, canManage: true };
const RECEIVER = { organizationId: TARGET, canManage: true };

test("before approval a source administrator approves or cancels, with Cancel in red and no separate Reject", async () => {
  await openRequest("waiting_for_sender", SENDER, { actions: SENDER_ADMIN });

  const sender = onBehalfOf("Museum Sør");
  expect(
    sender.getByRole("button", { name: "Approve for transfer" }),
  ).toBeTruthy();
  expect(button("Reject request")).toBeNull();
  const cancel = sender.getByRole("button", { name: "Cancel request" });
  expect(cancel.getAttribute("data-variant")).toBe("destructive");

  const notes = screen.getByLabelText("Review notes");
  await userEvent.type(notes, " Duplicate of an earlier request ");
  await userEvent.click(cancel);
  expect(state.mutations["objectMoves:cancel"]).toHaveBeenCalledWith({
    requestId: "move-1",
    reviewNotes: "Duplicate of an earlier request",
  });
  expect((notes as HTMLTextAreaElement).value).toBe("");
});

test("the requester who cannot approve still cancels with the red Cancel, without review notes", async () => {
  await openRequest(
    "waiting_for_sender",
    { organizationId: SOURCE, canManage: false },
    {
      actions: [
        { action: "cancel", organizationId: SOURCE, takesNotes: false },
      ],
    },
  );

  expect(button("Approve for transfer")).toBeNull();
  expect(button("Reject request")).toBeNull();
  expect(button("Cancel request")?.getAttribute("data-variant")).toBe(
    "destructive",
  );
  expect(screen.queryByLabelText("Review notes")).toBeNull();
});

test("the receiving organization accepts or declines an incoming transfer", async () => {
  await openRequest("waiting_for_receiver", RECEIVER, {
    actions: RECEIVER_ADMIN,
  });

  const receiver = onBehalfOf("Museum Nord");
  expect(
    receiver.getByRole("button", { name: "Accept and complete transfer" }),
  ).toBeTruthy();
  expect(
    receiver
      .getByRole("button", { name: "Reject request" })
      .getAttribute("data-variant"),
  ).toBe("destructive");
  expect(button("Cancel request")).toBeNull();
});

test("an administrator of both organizations sees each side's actions, each on behalf of its organization", async () => {
  await openRequest("waiting_for_receiver", RECEIVER, {
    actions: [
      ...RECEIVER_ADMIN,
      { action: "cancel", organizationId: SOURCE, takesNotes: true },
    ],
  });

  const receiver = onBehalfOf("Museum Nord");
  expect(
    receiver.getByRole("button", { name: "Accept and complete transfer" }),
  ).toBeTruthy();
  expect(receiver.getByRole("button", { name: "Reject request" })).toBeTruthy();
  expect(receiver.queryByRole("button", { name: "Cancel request" })).toBeNull();

  const sender = onBehalfOf("Museum Sør");
  expect(
    sender.queryByRole("button", { name: "Approve for transfer" }),
  ).toBeNull();
  await userEvent.click(sender.getByRole("button", { name: "Cancel request" }));
  expect(state.mutations["objectMoves:cancel"]).toHaveBeenCalledWith({
    requestId: "move-1",
    reviewNotes: undefined,
  });
});

test("the sending organization cancels an approved transfer while the receiver decides", async () => {
  await openRequest("waiting_for_receiver", SENDER, {
    actions: [{ action: "cancel", organizationId: SOURCE, takesNotes: true }],
  });

  expect(button("Accept and complete transfer")).toBeNull();
  expect(button("Reject request")).toBeNull();
  await userEvent.type(
    screen.getByLabelText("Review notes"),
    "The object is needed for an exhibition",
  );
  await userEvent.click(button("Cancel request") as HTMLElement);

  expect(state.mutations["objectMoves:cancel"]).toHaveBeenCalledWith({
    requestId: "move-1",
    reviewNotes: "The object is needed for an exhibition",
  });
  expect(toasts.success).toHaveBeenCalledWith("Move request cancelled.");
});

test("a transfer the sender must approve again waits for the sender, with a note", async () => {
  await openRequest("waiting_for_sender", RECEIVER, {
    request: {
      awaitsSenderReapproval: true,
      approvedBySender: true,
      sourceReviewedAt: Date.UTC(2026, 9, 2),
    },
  });

  expect(screen.getByText("Pending transfer approval")).toBeTruthy();
  expect(
    screen.getByText(
      "Approved under an earlier version of transfers, so the sending organization has to approve it again before the receiving organization decides.",
    ),
  ).toBeTruthy();
  expect(screen.getByText("Source approved at")).toBeTruthy();
  expect(button("Accept and complete transfer")).toBeNull();
  expect(screen.queryByRole("group")).toBeNull();
});

test("an acceptance that reaches a transfer waiting for the sender says so", async () => {
  await openRequest("waiting_for_receiver", RECEIVER, {
    actions: RECEIVER_ADMIN,
  });
  state.mutations["objectMoves:accept"]?.mockRejectedValueOnce(
    objectMoveError(
      "TRANSFER_AWAITS_SENDER",
      "The sending organization has to approve this transfer before the receiving organization can decide it.",
    ),
  );

  await userEvent.click(button("Accept and complete transfer") as HTMLElement);

  expect(toasts.error).toHaveBeenLastCalledWith(
    "The sending organization has to approve this transfer before you can accept or decline it.",
  );
});

test("a refused acceptance tells the receiving organization in its own terms", async () => {
  await openRequest("waiting_for_receiver", RECEIVER, {
    actions: RECEIVER_ADMIN,
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
  await openRequest("waiting_for_sender", SENDER, { actions: SENDER_ADMIN });
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

const APPROVED = Date.UTC(2026, 9, 2);
const DECIDED = Date.UTC(2026, 9, 5);

test.each([
  {
    name: "a request cancelled before approval",
    stage: "cancelled",
    request: {
      approvedBySender: false,
      sourceReviewedAt: DECIDED,
      decision: { decidedAt: DECIDED, decidedBy: "sender" },
    },
    shown: ["Source cancelled at"],
    hidden: ["Source approved at", "Source declined at"],
  },
  {
    name: "a transfer waiting for the receiver",
    stage: "waiting_for_receiver",
    request: { approvedBySender: true, sourceReviewedAt: APPROVED },
    shown: ["Source approved at"],
    hidden: ["Source cancelled at", "Source declined at"],
  },
  {
    name: "a request the sender declined",
    stage: "declined",
    request: {
      approvedBySender: false,
      sourceReviewedAt: DECIDED,
      decision: { decidedAt: DECIDED, decidedBy: "sender" },
    },
    shown: ["Source declined at"],
    hidden: ["Source approved at", "Source cancelled at"],
  },
  {
    name: "a transfer the sender cancelled after approving it",
    stage: "cancelled",
    request: {
      approvedBySender: true,
      sourceReviewedAt: APPROVED,
      decision: { decidedAt: DECIDED, decidedBy: "sender" },
    },
    shown: ["Source approved at", "Source cancelled at"],
    hidden: ["Source declined at"],
  },
])("$name names the source decisions it records", async ({
  stage,
  request,
  shown,
  hidden,
}) => {
  await openRequest(stage, SENDER, { request });

  for (const label of shown) expect(screen.getByText(label)).toBeTruthy();
  for (const label of hidden) expect(screen.queryByText(label)).toBeNull();
});

test("the sender's cancel notes are the transfer's review notes", async () => {
  await openRequest("cancelled", SENDER, {
    request: {
      approvedBySender: true,
      sourceReviewedAt: APPROVED,
      sourceReviewNotes: "Approved for the exchange",
      reviewNotes: "Needed for an exhibition",
      decision: {
        decidedAt: DECIDED,
        decidedBy: "sender",
        notes: "Needed for an exhibition",
      },
    },
  });

  expect(screen.getByText("Needed for an exhibition")).toBeTruthy();
  expect(screen.queryByText("Approved for the exchange")).toBeNull();
});

test("the receiving organization declines without writing notes", async () => {
  await openRequest("waiting_for_receiver", RECEIVER, {
    actions: RECEIVER_ADMIN,
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
  await openRequest("waiting_for_receiver", RECEIVER, {
    actions: RECEIVER_ADMIN,
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
  await openRequest("waiting_for_receiver", RECEIVER, {
    actions: RECEIVER_ADMIN,
  });
  state.mutations["objectMoves:accept"]?.mockRejectedValueOnce(
    identifierError(
      "IDENTIFIER_IN_USE",
      "Identifier 'A-1' already exists in the catalog register.",
      { register: "catalog", identifier: "A-1" },
    ),
  );

  await userEvent.click(button("North store") as HTMLElement);
  await userEvent.click(button("Accept and complete transfer") as HTMLElement);

  expect(toasts.error).toHaveBeenLastCalledWith(
    "A-1 is already used in your organization. Generate or enter a new number.",
  );
});

test("a receiver that cannot generate or index numbers is told what to set up", async () => {
  await openRequest("waiting_for_receiver", RECEIVER, {
    actions: RECEIVER_ADMIN,
  });
  const accept = state.mutations["objectMoves:accept"];
  accept?.mockRejectedValueOnce(
    identifierError(
      "NUMBERING_NOT_CONFIGURED",
      "Number generation is not configured.",
      { register: "catalog" },
    ),
  );
  accept?.mockRejectedValueOnce(
    identifierError(
      "IDENTIFIER_REVIEW_REQUIRED",
      "Identifier review required.",
      { register: "catalog" },
    ),
  );

  await userEvent.click(button("Accept and complete transfer") as HTMLElement);
  expect(toasts.error).toHaveBeenLastCalledWith(
    "Automatic accession numbers are not set up for your organization. Enter a new number, or turn them on in Preferences.",
  );
  await userEvent.click(button("Accept and complete transfer") as HTMLElement);
  expect(toasts.error).toHaveBeenLastCalledWith(
    "Complete the identifier review for the catalog register in Settings › Preferences before assigning new numbers.",
  );
});

test("the receiving organization accepts without choosing a location", async () => {
  await openRequest("waiting_for_receiver", RECEIVER, {
    actions: RECEIVER_ADMIN,
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

test("a receiver that turned off locations is not asked for one, whichever organization the viewer selected", async () => {
  await openRequest(
    "waiting_for_receiver",
    { organizationId: SOURCE, canManage: true },
    { actions: RECEIVER_ADMIN, request: { receiverTracksLocations: false } },
  );

  expect(screen.queryByText("Receiving location")).toBeNull();
  expect(button("North store")).toBeNull();
  expect(button("Accept and complete transfer")).toBeTruthy();
});

test("the back link returns to the Transfers board", async () => {
  await openRequest("waiting_for_receiver", RECEIVER, {
    actions: RECEIVER_ADMIN,
  });

  expect(
    screen
      .getByRole("link", { name: "Back to transfers" })
      .getAttribute("href"),
  ).toMatch(/\/accessions\/transfers$/);
});

test("staff who cannot open the Transfers board go back to the object", async () => {
  await openRequest("waiting_for_receiver", {
    organizationId: SOURCE,
    canManage: false,
  });

  expect(screen.queryByRole("link", { name: "Back to transfers" })).toBeNull();
  expect(
    screen.getByRole("link", { name: "Back to object" }).getAttribute("href"),
  ).toMatch(/\/objects\/object-1$/);
});

test("once the object has left, staff who cannot open the Transfers board go back to the Object Catalog", async () => {
  await openRequest(
    "received",
    { organizationId: SOURCE, canManage: false },
    {
      request: {
        collection: {
          ...moveRequest("received").collection,
          organizationId: TARGET,
        },
      },
    },
  );

  expect(screen.queryByRole("link", { name: "Back to object" })).toBeNull();
  expect(
    screen
      .getByRole("link", { name: "Back to Object Catalog" })
      .getAttribute("href"),
  ).toMatch(/\/objects$/);
});

test("only the organization holding the object is offered to open it", async () => {
  await openRequest("waiting_for_receiver", RECEIVER, {
    actions: RECEIVER_ADMIN,
  });
  expect(screen.queryByRole("link", { name: "Open object" })).toBeNull();
});

test("the sending organization opens the object while it still holds it", async () => {
  await openRequest("waiting_for_receiver", SENDER);
  expect(
    screen.getByRole("link", { name: "Open object" }).getAttribute("href"),
  ).toMatch(/\/objects\/object-1$/);
});

test("opened from a list, the back link returns to it", async () => {
  await openRequest(
    "declined",
    { organizationId: SOURCE, canManage: false },
    { url: "/en/objects/move-requests/move-1?from=%2Fdeaccessions" },
  );

  expect(
    screen.getByRole("link", { name: "Back to results" }).getAttribute("href"),
  ).toBe("/deaccessions");
});

test("a receiver without automatic numbering starts from the current number", async () => {
  await openRequest("waiting_for_receiver", RECEIVER, {
    actions: RECEIVER_ADMIN,
    request: { receiverGeneratesAccessionNumbers: false },
  });

  expect(
    screen.getByRole("combobox", { name: "Accession number" }).textContent,
  ).toBe("Keep the current number (A-1)");
  await userEvent.click(button("Accept and complete transfer") as HTMLElement);
  expect(state.mutations["objectMoves:accept"]).toHaveBeenCalledWith(
    expect.objectContaining({ accessionMode: "keep" }),
  );
});
