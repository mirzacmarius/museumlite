// @vitest-environment jsdom

import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { beforeEach, expect, test, vi } from "vitest";
import { renderOnPage } from "@/testing/render-on-page";
import type { ObjectDetailData } from "../types";
import { ObjectDeaccessionAction } from "./object-deaccession-action";

let loans: { status: string }[] | undefined;

vi.mock("convex/react", () => ({
  useQuery: () => loans,
}));
vi.mock("@/components/deaccession-dialog", () => ({
  DeaccessionDialog: ({ open }: { open: boolean }) =>
    open ? <div role="dialog">Deaccession dialog</div> : null,
}));

async function renderAction(status = "active") {
  const collection = {
    _id: "object-1",
    organizationId: "org-1",
    title: "Harbour at Dawn",
    status,
  } as unknown as NonNullable<ObjectDetailData["collection"]>;
  await renderOnPage(
    <ObjectDeaccessionAction
      collection={collection}
      collectionId={"object-1" as Id<"collections">}
    />,
    "/en/objects/object-1",
    { id: "object-1" },
  );
}

beforeEach(() => {
  loans = [];
});

test("an active object opens the deaccession dialog from its page", async () => {
  await renderAction();

  await userEvent.click(screen.getByRole("button", { name: "Deaccession" }));

  expect(screen.getByRole("dialog")).toBeTruthy();
});

test("an object on an active loan offers no deaccession", async () => {
  loans = [{ status: "active" }];
  await renderAction();

  expect(screen.queryByRole("button", { name: "Deaccession" })).toBeNull();
});

test("a withdrawn object offers no deaccession", async () => {
  await renderAction("archived");

  expect(screen.queryByRole("button", { name: "Deaccession" })).toBeNull();
});
