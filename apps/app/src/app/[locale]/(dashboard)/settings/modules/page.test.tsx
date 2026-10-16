// @vitest-environment jsdom
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { getFunctionName } from "convex/server";
import { beforeEach, expect, test, vi } from "vitest";
import { renderOnPage } from "@/testing/render-on-page";
import ModulesSettingsPage from "./page";

const updateOrganization = vi.fn();
// Stable results, as Convex returns between renders.
const ORGANIZATION = { settings: { enabledModules: ["accounts"] } };
const ENABLED_INTEGRATIONS: string[] = [];

vi.mock("convex/react", () => ({
  useQuery: (reference: unknown) => {
    const name = getFunctionName(reference as never);
    if (name === "organizations:get") return ORGANIZATION;
    if (name === "integrations:getEnabled") return ENABLED_INTEGRATIONS;
    return undefined;
  },
  useMutation: () => updateOrganization,
}));
vi.mock("@/components/organization-provider", () => ({
  useOrganization: () => ({ currentOrganizationId: "org-1" }),
}));
vi.mock("@/components/permission-gate", () => ({
  usePermission: () => true,
}));

beforeEach(() => {
  updateOrganization.mockReset();
  updateOrganization.mockResolvedValue(null);
});

test("clicking a module's name or description does not toggle it", async () => {
  const user = userEvent.setup();
  await renderOnPage(<ModulesSettingsPage />, "/en/settings/modules");

  await user.click(screen.getByRole("heading", { name: "Fine Art" }));
  await user.click(
    screen.getByText(
      "Fine art cataloging with provenance tracking and curation workflows.",
    ),
  );

  expect(screen.queryByRole("alertdialog")).toBeNull();
  expect(updateOrganization).not.toHaveBeenCalled();
  expect(
    screen
      .getByRole("switch", { name: "Fine Art" })
      .getAttribute("aria-checked"),
  ).toBe("false");
});

test("a module is enabled only after the confirmation, and Cancel saves nothing", async () => {
  const user = userEvent.setup();
  await renderOnPage(<ModulesSettingsPage />, "/en/settings/modules");
  const fineArt = screen.getByRole("switch", { name: "Fine Art" });

  await user.click(fineArt);
  const dialog = screen.getByRole("alertdialog");
  within(dialog).getByRole("heading", {
    name: "Are you sure you want to enable this function?",
  });
  within(dialog).getByText("Setting: Fine Art");
  await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
  expect(updateOrganization).not.toHaveBeenCalled();
  expect(fineArt.getAttribute("aria-checked")).toBe("false");

  await user.click(fineArt);
  await user.click(screen.getByRole("button", { name: "Enable" }));

  expect(updateOrganization).toHaveBeenCalledExactlyOnceWith({
    organizationId: "org-1",
    settings: { enabledModules: ["accounts", "fine_art"] },
  });
  await waitFor(() =>
    expect(fineArt.getAttribute("aria-checked")).toBe("true"),
  );
});

test("disabling a module asks to disable it and saves without it", async () => {
  const user = userEvent.setup();
  await renderOnPage(<ModulesSettingsPage />, "/en/settings/modules");

  await user.click(screen.getByRole("switch", { name: "Accounts & CRM" }));
  screen.getByRole("heading", {
    name: "Are you sure you want to disable this function?",
  });
  screen.getByText("Setting: Accounts & CRM");
  await user.click(screen.getByRole("button", { name: "Disable" }));

  expect(updateOrganization).toHaveBeenCalledExactlyOnceWith({
    organizationId: "org-1",
    settings: { enabledModules: [] },
  });
});
