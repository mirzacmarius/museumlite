// @vitest-environment jsdom

import { act, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { CapabilityState } from "@v1/backend/convex/utils/capabilities";
import { TooltipProvider } from "@v1/ui/tooltip";
import { useRef } from "react";
import { beforeEach, expect, test, vi } from "vitest";
import { renderOnPage } from "@/testing/render-on-page";
import { BulkActionsBar } from "./bulk-actions-bar";

let initiation: CapabilityState | null | undefined;
vi.mock("convex/react", () => ({
  useQuery: () => initiation,
}));
vi.mock("@/components/organization-provider", () => ({
  useOrganization: () => ({ currentOrganizationId: "org" }),
}));
vi.mock("@/components/permission-gate", () => ({
  PermissionGate: () => null,
}));
const toastInfo = vi.fn();
vi.mock("sonner", () => ({
  toast: { info: (text: string) => toastInfo(text) },
}));

beforeEach(() => {
  toastInfo.mockReset();
});

const REASON =
  "Your role does not include access to this. Ask an administrator to update your role.";

function SelectedObjects({ onDeaccession }: { onDeaccession: () => void }) {
  const listRef = useRef<HTMLElement>(null);
  return (
    <TooltipProvider delayDuration={0}>
      <section ref={listRef} tabIndex={-1} aria-label="Object Catalog" />
      <BulkActionsBar
        selectedCount={2}
        onClearSelection={() => {}}
        onMoveLocation={() => {}}
        onAddToGroup={() => {}}
        onPrintLabels={() => {}}
        onDeaccession={onDeaccession}
        onEditField={() => {}}
        returnFocusRef={listRef}
      />
    </TooltipProvider>
  );
}

test("a member who may start a deaccession opens the bulk dialog", async () => {
  initiation = { capability: "deaccession", listed: true, status: "available" };
  const onDeaccession = vi.fn();
  await renderOnPage(<SelectedObjects onDeaccession={onDeaccession} />);

  const action = screen.getByRole("button", { name: "Deaccession" });
  expect(action.getAttribute("aria-disabled")).toBeNull();
  await userEvent.setup().click(action);

  expect(onDeaccession).toHaveBeenCalledOnce();
});

test("a member who may not start one sees it unavailable, with the reason", async () => {
  initiation = {
    capability: "deaccession",
    listed: true,
    status: "permission_missing",
  };
  const onDeaccession = vi.fn();
  await renderOnPage(<SelectedObjects onDeaccession={onDeaccession} />);

  const action = screen.getByRole("button", { name: "Deaccession" });
  expect(action.getAttribute("aria-disabled")).toBe("true");
  const user = userEvent.setup();
  act(() => action.focus());
  expect((await screen.findByRole("tooltip")).textContent).toBe(REASON);

  await user.click(action);
  expect(onDeaccession).not.toHaveBeenCalled();
  expect(toastInfo).toHaveBeenCalledWith(REASON);
});

test("the action waits for the member's state instead of guessing", async () => {
  initiation = undefined;
  await renderOnPage(<SelectedObjects onDeaccession={() => {}} />);

  expect(screen.queryByRole("button", { name: "Deaccession" })).toBeNull();
});
