// @vitest-environment jsdom

import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { bulkEditError } from "@v1/backend/convex/utils/bulkFieldEditErrors";
import { getFunctionName } from "convex/server";
import type { ReactNode } from "react";
import { beforeEach, expect, test, vi } from "vitest";
import { renderOnPage } from "@/testing/render-on-page";
import { BulkEditFieldDialog } from "./bulk-edit-field-dialog";

const state = vi.hoisted(() => ({
  preview: undefined as unknown,
  job: undefined as unknown,
  previewAsked: false,
  start: vi.fn(),
}));

vi.mock("convex/react", () => ({
  useQuery: (query: never, args: unknown) => {
    if (args === "skip") return undefined;
    switch (getFunctionName(query)) {
      case "bulkFieldEdits:preview":
        state.previewAsked = true;
        return state.preview;
      case "bulkFieldEdits:get":
        return state.job;
      default:
        return undefined;
    }
  },
  useMutation: (mutation: never) =>
    getFunctionName(mutation) === "bulkFieldEdits:start"
      ? state.start
      : vi.fn(),
}));
vi.mock("@/components/permission-gate", () => ({
  PermissionGate: ({ children }: { children: ReactNode }) => children,
}));

beforeEach(() => {
  state.preview = undefined;
  state.job = undefined;
  state.previewAsked = false;
  state.start = vi.fn();
});

const organizationId = "org" as Id<"organizations">;

function selection(count: number) {
  return Array.from(
    { length: count },
    (_, index) => `object-${index}` as Id<"collections">,
  );
}

async function openForSelection(
  collectionIds: Id<"collections">[],
  onStarted = vi.fn(),
) {
  await renderOnPage(
    <BulkEditFieldDialog
      open
      onOpenChange={() => {}}
      organizationId={organizationId}
      scope={{ kind: "selection", collectionIds }}
      onStarted={onStarted}
    />,
    "/en/objects",
  );
}

test("the preview counts what changes and warns before recorded values are replaced", async () => {
  state.preview = { matching: 3, changing: 2, overwriting: 1, capped: false };
  const onStarted = vi.fn();
  state.start.mockResolvedValue("job-1");
  const collectionIds = selection(3);
  await openForSelection(collectionIds, onStarted);
  const user = userEvent.setup();

  expect(
    screen.getByRole("button", { name: "Apply edit" }).hasAttribute("disabled"),
  ).toBe(true);
  await user.type(screen.getByLabelText("New value"), "Norse");

  expect(
    await screen.findByText("Matching objects: 3. Objects that change: 2."),
  ).toBeTruthy();
  expect(
    screen.getByText("Objects whose recorded value is replaced: 1"),
  ).toBeTruthy();

  state.job = {
    _id: "job-1",
    status: "running",
    edit: { field: "culture", operation: "set", value: "Norse" },
    checked: 1,
    changed: 1,
    skipped: 0,
  };
  await user.click(screen.getByRole("button", { name: "Apply edit" }));

  expect(state.start).toHaveBeenCalledWith({
    organizationId,
    scope: { kind: "selection", collectionIds },
    edit: { field: "culture", operation: "set", value: "Norse" },
  });
  expect(onStarted).toHaveBeenCalledTimes(1);
  expect(
    await screen.findByText("Editing Culture: 1 checked, 1 changed"),
  ).toBeTruthy();
  expect(screen.getByRole("button", { name: "Stop" })).toBeTruthy();
});

test("titles can be set or replaced, never cleared", async () => {
  await openForSelection(selection(2));
  const user = userEvent.setup();

  await user.click(screen.getByRole("radio", { name: "Clear the field" }));
  await user.click(screen.getByRole("combobox", { name: "Field" }));
  await user.click(await screen.findByRole("option", { name: "Title" }));

  const clear = screen.getByRole("radio", { name: "Clear the field" });
  expect(clear.hasAttribute("disabled")).toBe(true);
  expect(
    screen
      .getByRole("radio", { name: "Set a new value" })
      .getAttribute("aria-checked"),
  ).toBe("true");
});

test("a selection over the limit is refused before anything is counted", async () => {
  await openForSelection(selection(501));
  const user = userEvent.setup();

  await user.type(screen.getByLabelText("New value"), "Norse");

  expect(
    screen.getByText(
      "Select at most 500 objects, or edit all objects that match the search and filters instead.",
    ),
  ).toBeTruthy();
  expect(state.previewAsked).toBe(false);
  expect(
    screen.getByRole("button", { name: "Apply edit" }).hasAttribute("disabled"),
  ).toBe(true);
});

test("an edit the server refuses is explained in the dialog", async () => {
  state.preview = { matching: 2, changing: 2, overwriting: 0, capped: false };
  state.start.mockRejectedValue(
    bulkEditError("EDIT_RUNNING", "Another bulk edit is running"),
  );
  const onStarted = vi.fn();
  await openForSelection(selection(2), onStarted);
  const user = userEvent.setup();

  await user.type(screen.getByLabelText("New value"), "Norse");
  await user.click(await screen.findByRole("button", { name: "Apply edit" }));

  const refusal = await screen.findByRole("alert");
  expect(refusal.textContent).toBe(
    "Another field edit is running in this organization. Wait for it to finish or stop it first.",
  );
  expect(onStarted).not.toHaveBeenCalled();
  expect((screen.getByLabelText("New value") as HTMLInputElement).value).toBe(
    "Norse",
  );
});
