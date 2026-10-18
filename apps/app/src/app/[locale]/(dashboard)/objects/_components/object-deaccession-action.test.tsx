// @vitest-environment jsdom

import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { beforeEach, expect, test, vi } from "vitest";
import type { ObjectActions } from "@/components/deaccession-dialog-types";
import { renderOnPage } from "@/testing/render-on-page";
import { ObjectDeaccessionAction } from "./object-deaccession-action";

let actions: ObjectActions | null | undefined;

vi.mock("convex/react", () => ({
  useQuery: () => actions,
}));
vi.mock("@/components/deaccession-dialog", () => ({
  DeaccessionDialog: ({ open }: { open: boolean }) =>
    open ? <div role="dialog">Deaccession dialog</div> : null,
}));

function withDeaccession(
  deaccession: ObjectActions["deaccession"],
): ObjectActions {
  return { deaccession, remove: { state: "available" } };
}

async function renderAction() {
  await renderOnPage(
    <ObjectDeaccessionAction
      collectionId={"object-1" as Id<"collections">}
      collectionTitle="Harbour at Dawn"
      organizationId={"org-1" as Id<"organizations">}
    />,
    "/en/objects/object-1",
    { id: "object-1" },
  );
}

beforeEach(() => {
  actions = withDeaccession({ state: "available", approvalSteps: 0 });
});

test("an object that allows deaccession opens the dialog", async () => {
  await renderAction();

  await userEvent.click(screen.getByRole("button", { name: "Deaccession" }));

  expect(screen.getByRole("dialog")).toBeTruthy();
});

test("with approval steps the action requests a deaccession", async () => {
  actions = withDeaccession({ state: "available", approvalSteps: 2 });
  await renderAction();

  expect(
    screen.getByRole("button", { name: "Request deaccession" }),
  ).toBeTruthy();
});

test("staff without access to either action see none", async () => {
  actions = { deaccession: { state: "hidden" }, remove: { state: "hidden" } };
  await renderAction();

  expect(screen.queryByRole("button")).toBeNull();
});

test("staff who may only remove the object still reach the dialog", async () => {
  actions = withDeaccession({ state: "hidden" });
  await renderAction();

  await userEvent.click(screen.getByRole("button", { name: "Deaccession" }));

  expect(screen.getByRole("dialog")).toBeTruthy();
});

test("an object on loan shows the action disabled with the reason", async () => {
  actions = withDeaccession({ state: "blocked", reason: "on_loan" });
  await renderAction();

  const button = screen.getByRole("button", { name: /Deaccession/ });
  expect(button.hasAttribute("disabled")).toBe(true);
  expect(button.getAttribute("title")).toBe("On loan");
});

test("an unaccessioned object shows the action disabled with the reason", async () => {
  actions = withDeaccession({ state: "blocked", reason: "not_accessioned" });
  await renderAction();

  expect(
    screen.getByRole("button", { name: /Deaccession/ }).getAttribute("title"),
  ).toBe("Not yet accessioned");
});

test("an open Deaccession links to its Case", async () => {
  actions = withDeaccession({
    state: "in_progress",
    deaccessionId: "deaccession-1" as Id<"deaccessions">,
  });
  await renderAction();

  expect(
    screen
      .getByRole("link", { name: "Deaccession in progress" })
      .getAttribute("href"),
  ).toBe("/deaccessions/deaccession-1");
});
