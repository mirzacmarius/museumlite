// @vitest-environment jsdom
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { getFunctionName } from "convex/server";
import { beforeEach, expect, test, vi } from "vitest";
import { renderOnPage } from "@/testing/render-on-page";
import IntegrationsSettingsPage from "./page";

const enableIntegration = vi.fn();
const disableIntegration = vi.fn();
// Stable results, as Convex returns between renders.
const AVAILABLE = [
  {
    id: "library",
    name: "Library",
    description: "Circulation, patrons and cataloging.",
    features: [],
    requiresSubscription: false,
  },
];
let enabled: string[] = [];

vi.mock("convex/react", () => ({
  useQuery: (reference: unknown) => {
    const name = getFunctionName(reference as never);
    if (name === "integrations:listAvailable") return AVAILABLE;
    if (name === "integrations:getEnabled") return enabled;
    return undefined;
  },
  useMutation: (reference: unknown) =>
    getFunctionName(reference as never) === "integrations:enable"
      ? enableIntegration
      : disableIntegration,
}));
vi.mock("@/components/organization-provider", () => ({
  useOrganization: () => ({ currentOrganizationId: "org-1" }),
}));
const { toastError } = vi.hoisted(() => ({ toastError: vi.fn() }));
vi.mock("sonner", () => ({
  toast: { success: () => {}, info: () => {}, error: toastError },
}));

beforeEach(() => {
  toastError.mockReset();
  enableIntegration.mockReset();
  enableIntegration.mockResolvedValue({ ok: true });
  disableIntegration.mockReset();
  disableIntegration.mockResolvedValue(null);
});

test("enabling an integration asks first and Cancel enables nothing", async () => {
  enabled = [];
  const user = userEvent.setup();
  await renderOnPage(<IntegrationsSettingsPage />, "/en/settings/integrations");
  const library = screen.getByRole("switch", { name: "Library" });

  await user.click(screen.getByRole("heading", { name: "Library" }));
  expect(screen.queryByRole("alertdialog")).toBeNull();

  await user.click(library);
  screen.getByText("Setting: Library");
  await user.click(screen.getByRole("button", { name: "Cancel" }));
  expect(enableIntegration).not.toHaveBeenCalled();

  await user.click(library);
  await user.click(screen.getByRole("button", { name: "Enable" }));
  expect(enableIntegration).toHaveBeenCalledExactlyOnceWith({
    organizationId: "org-1",
    integrationId: "library",
  });
});

test("disabling an integration explains that its data is kept", async () => {
  enabled = ["library"];
  const user = userEvent.setup();
  await renderOnPage(<IntegrationsSettingsPage />, "/en/settings/integrations");

  await user.click(screen.getByRole("switch", { name: "Library" }));
  const dialog = screen.getByRole("alertdialog");
  within(dialog).getByRole("heading", {
    name: "Are you sure you want to disable this function?",
  });
  within(dialog).getByText("Setting: Library");
  within(dialog).getByText(
    "The data will be preserved, but the features will no longer be accessible until re-enabled.",
  );
  await user.click(within(dialog).getByRole("button", { name: "Disable" }));

  expect(disableIntegration).toHaveBeenCalledExactlyOnceWith({
    organizationId: "org-1",
    integrationId: "library",
  });
  expect(enableIntegration).not.toHaveBeenCalled();
});

test("a failed disable says so and leaves the integration on", async () => {
  enabled = ["library"];
  disableIntegration.mockRejectedValue(new Error("offline"));
  vi.spyOn(console, "error").mockImplementation(() => {});
  const user = userEvent.setup();
  await renderOnPage(<IntegrationsSettingsPage />, "/en/settings/integrations");
  const library = screen.getByRole("switch", { name: "Library" });

  await user.click(library);
  await user.click(screen.getByRole("button", { name: "Disable" }));

  await waitFor(() =>
    expect(toastError).toHaveBeenCalledWith("Failed to disable integration"),
  );
  expect(library.getAttribute("aria-checked")).toBe("true");
  await waitFor(() => expect(library.getAttribute("aria-busy")).toBeNull());
});
