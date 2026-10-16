// @vitest-environment jsdom
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { getFunctionName } from "convex/server";
import { beforeEach, expect, test, vi } from "vitest";
import { renderOnPage } from "@/testing/render-on-page";
import ModulesSettingsPage from "./page";

const setModuleEnabled = vi.fn();
const ENABLED_INTEGRATIONS: string[] = [];
let organization: {
  settings: { enabledModules: string[]; disabledModules?: string[] };
};

vi.mock("convex/react", () => ({
  useQuery: (reference: unknown) => {
    const name = getFunctionName(reference as never);
    if (name === "organizations:get") return organization;
    if (name === "integrations:getEnabled") return ENABLED_INTEGRATIONS;
    return undefined;
  },
  useMutation: () => setModuleEnabled,
}));
vi.mock("@/components/organization-provider", () => ({
  useOrganization: () => ({ currentOrganizationId: "org-1" }),
}));
vi.mock("@/components/permission-gate", () => ({
  usePermission: () => true,
}));

beforeEach(() => {
  organization = { settings: { enabledModules: ["accounts"] } };
  setModuleEnabled.mockReset();
  setModuleEnabled.mockResolvedValue(null);
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
  expect(setModuleEnabled).not.toHaveBeenCalled();
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
  expect(setModuleEnabled).not.toHaveBeenCalled();
  expect(fineArt.getAttribute("aria-checked")).toBe("false");

  await user.click(fineArt);
  await user.click(screen.getByRole("button", { name: "Enable" }));

  expect(setModuleEnabled).toHaveBeenCalledExactlyOnceWith({
    organizationId: "org-1",
    moduleId: "fine_art",
    enabled: true,
  });
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

  expect(setModuleEnabled).toHaveBeenCalledExactlyOnceWith({
    organizationId: "org-1",
    moduleId: "accounts",
    enabled: false,
  });
});

test("Comments is on until an administrator turns it off, and turning it off says comments are kept", async () => {
  const user = userEvent.setup();
  await renderOnPage(<ModulesSettingsPage />, "/en/settings/modules");
  const comments = screen.getByRole("switch", { name: "Comments" });
  expect(comments.getAttribute("aria-checked")).toBe("true");

  await user.click(comments);
  const dialog = screen.getByRole("alertdialog");
  within(dialog).getByText("Setting: Comments");
  within(dialog).getByText(
    "The Comments tab is hidden on every object. Existing comments are kept and show again when Comments is turned back on.",
  );
  await user.click(within(dialog).getByRole("button", { name: "Disable" }));

  expect(setModuleEnabled).toHaveBeenCalledExactlyOnceWith({
    organizationId: "org-1",
    moduleId: "comments",
    enabled: false,
  });
});

test("Comments shows as off once it is turned off", async () => {
  organization = {
    settings: { enabledModules: ["accounts"], disabledModules: ["comments"] },
  };
  await renderOnPage(<ModulesSettingsPage />, "/en/settings/modules");

  expect(
    screen
      .getByRole("switch", { name: "Comments" })
      .getAttribute("aria-checked"),
  ).toBe("false");
  expect(
    screen
      .getByRole("switch", { name: "Accounts & CRM" })
      .getAttribute("aria-checked"),
  ).toBe("true");
});
