// @vitest-environment jsdom

import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { getFunctionName } from "convex/server";
import { expect, test, vi } from "vitest";
import { renderOnPage } from "@/testing/render-on-page";
import { ObjectActionsMenu } from "./object-grid-view";

/** What api.organizations.get serves; undefined while it loads. */
let organization: unknown;
vi.mock("convex/react", () => ({
  useQuery: (reference: unknown, args: unknown) => {
    if (args === "skip") return undefined;
    const name = getFunctionName(reference as never);
    if (name === "collections:getObjectDetail") {
      return {
        collection: { _id: "object-1", organizationId: "org", title: "Vase" },
        heroImage: null,
        locationPath: [],
      };
    }
    return name === "organizations:get" ? organization : undefined;
  },
  useMutation: () => vi.fn(),
}));
vi.mock("@/components/permission-gate", () => ({
  PermissionGate: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock("@/components/deaccession-dialog", () => ({
  DeaccessionDialog: () => null,
}));

/** Whether the print preview, when shown, was told to print on opening. */
let printOnOpen: boolean | undefined;
vi.mock("next/dynamic", () => ({
  default: () => (props: { printOnOpen?: boolean }) => {
    printOnOpen = props.printOnOpen;
    return null;
  },
}));

const menu = (
  <ObjectActionsMenu
    item={{
      _id: "object-1" as Id<"collections">,
      title: "Vase",
      status: "active",
    }}
    organizationId={"org" as Id<"organizations">}
  />
);

test("Export to PDF prints once the Organization's default rights statement has loaded", async () => {
  const { rerender } = await renderOnPage(menu);
  const user = userEvent.setup();

  await user.click(screen.getByRole("button", { name: "Actions" }));
  await user.click(screen.getByRole("menuitem", { name: "Export to PDF" }));

  expect(printOnOpen).toBe(false);

  organization = { _id: "org", settings: {} };
  rerender(menu);

  expect(printOnOpen).toBe(true);
});
