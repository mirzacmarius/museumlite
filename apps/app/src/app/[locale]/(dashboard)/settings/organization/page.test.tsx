// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { getFunctionName } from "convex/server";
import { ConvexError } from "convex/values";
import { beforeEach, expect, test, vi } from "vitest";
import { renderOnPage } from "@/testing/render-on-page";
import OrganizationSettingsPage from "./page";

const updateOrganization = vi.fn();
const updateWatermarkSettings = vi.fn();
let canManageSettings = true;
let organization: {
  _id: string;
  name: string;
  slug: string;
  type: "museum";
  address?: Record<string, string>;
  phone?: string;
  settings?: {
    watermarkSettings: {
      isEnabled: boolean;
      text: string;
      opacity: number;
      position: "bottom-right";
    };
  };
};

vi.mock("convex/react", () => ({
  useQuery: (reference: unknown, args: unknown) => {
    if (args === "skip") return undefined;
    return getFunctionName(reference as never) === "organizations:get"
      ? organization
      : undefined;
  },
  useMutation: (reference: unknown) => {
    switch (getFunctionName(reference as never)) {
      case "organizations:update":
        return updateOrganization;
      case "organizations:updateWatermarkSettings":
        return updateWatermarkSettings;
      default:
        return vi.fn();
    }
  },
}));
vi.mock("@/components/organization-provider", () => ({
  useOrganization: () => ({ currentOrganizationId: "org-1" }),
}));
vi.mock("@/components/permission-gate", () => ({
  PermissionGate: ({
    children,
    fallback = null,
  }: {
    children: React.ReactNode;
    fallback?: React.ReactNode;
  }) => (canManageSettings ? children : fallback),
  usePermissions: () => ({
    hasPermission: (permission: string) =>
      canManageSettings && permission === "organization.manage_settings",
  }),
}));
vi.mock("./organization-deletion-zone", () => ({
  OrganizationDeletionZone: () => null,
}));

beforeEach(() => {
  canManageSettings = true;
  organization = {
    _id: "org-1",
    name: "112 St. Magnus",
    slug: "112stmagnus",
    type: "museum",
    address: { street: "Strandgata 12", city: "Molde" },
    phone: "+47 71 20 00 00",
  };
  updateOrganization.mockReset();
  updateOrganization.mockResolvedValue(null);
  updateWatermarkSettings.mockReset();
  updateWatermarkSettings.mockResolvedValue(null);
});

test("staff edit the address and phone and Save Changes sends the whole address", async () => {
  const user = userEvent.setup();
  await renderOnPage(<OrganizationSettingsPage />, "/en/settings/organization");

  expect(screen.getByLabelText("Street address")).toHaveProperty(
    "value",
    "Strandgata 12",
  );
  expect(screen.getByLabelText("City")).toHaveProperty("value", "Molde");
  expect(screen.getByLabelText("Phone")).toHaveProperty(
    "value",
    "+47 71 20 00 00",
  );

  await user.type(screen.getByLabelText("Postal code"), "6413");
  await user.type(screen.getByLabelText("Country"), "Norway");
  await user.clear(screen.getByLabelText("Phone"));
  await user.type(screen.getByLabelText("Phone"), "+47 71 20 00 01");
  await user.click(screen.getByRole("button", { name: "Save Changes" }));

  expect(updateOrganization).toHaveBeenCalledWith({
    organizationId: "org-1",
    address: {
      street: "Strandgata 12",
      street2: "",
      postalCode: "6413",
      city: "Molde",
      region: "",
      country: "Norway",
    },
    phone: "+47 71 20 00 01",
  });
});

test("fields left alone show a change made elsewhere, and Save Changes leaves it in place", async () => {
  const user = userEvent.setup();
  const { rerender } = await renderOnPage(
    <OrganizationSettingsPage />,
    "/en/settings/organization",
  );

  await user.type(screen.getByLabelText("Postal code"), "6413");
  // Another administrator renames the Organization and changes its phone.
  organization = {
    ...organization,
    name: "Romsdal Museum",
    phone: "+47 99 99 99 99",
  };
  rerender(<OrganizationSettingsPage />);

  expect(screen.getByLabelText("Organization Name *")).toHaveProperty(
    "value",
    "Romsdal Museum",
  );
  expect(screen.getByLabelText("Phone")).toHaveProperty(
    "value",
    "+47 99 99 99 99",
  );
  expect(screen.getByLabelText("Postal code")).toHaveProperty("value", "6413");

  await user.click(screen.getByRole("button", { name: "Save Changes" }));

  expect(updateOrganization).toHaveBeenCalledWith({
    organizationId: "org-1",
    address: {
      street: "Strandgata 12",
      street2: "",
      postalCode: "6413",
      city: "Molde",
      region: "",
      country: "",
    },
  });
});

test("members who cannot manage settings see the address and phone read-only", async () => {
  canManageSettings = false;
  await renderOnPage(<OrganizationSettingsPage />, "/en/settings/organization");

  expect(screen.getByLabelText("Street address")).toHaveProperty(
    "disabled",
    true,
  );
  expect(screen.getByLabelText("Phone")).toHaveProperty("disabled", true);
  expect(screen.queryByRole("button", { name: "Save Changes" })).toBeNull();
});

test("a refused line says which field to shorten", async () => {
  updateOrganization.mockRejectedValue(
    new ConvexError({
      code: "CONTACT_FIELD_TOO_LONG",
      message: "The city field is longer than 200 characters",
      field: "city",
      limit: 200,
    }),
  );
  const user = userEvent.setup();
  await renderOnPage(<OrganizationSettingsPage />, "/en/settings/organization");

  await user.type(screen.getByLabelText("City"), " sentrum");
  await user.click(screen.getByRole("button", { name: "Save Changes" }));

  expect(
    await screen.findByText("City can be at most 200 characters long."),
  ).toBeTruthy();
});

test("saving the watermark keeps address edits that are not saved yet", async () => {
  organization.settings = {
    watermarkSettings: {
      isEnabled: true,
      text: "© Romsdal Museum",
      opacity: 0.5,
      position: "bottom-right",
    },
  };
  // The saved watermark comes back as a new Organization document.
  updateWatermarkSettings.mockImplementation(async () => {
    organization = { ...organization, name: "112 St. Magnus" };
    return null;
  });
  const user = userEvent.setup();
  await renderOnPage(<OrganizationSettingsPage />, "/en/settings/organization");

  const street = screen.getByLabelText("Street address");
  await user.clear(street);
  await user.type(street, "Storgata 1");
  await user.click(
    screen.getByRole("button", { name: "Save Watermark Settings" }),
  );

  expect(updateWatermarkSettings).toHaveBeenCalledOnce();
  expect(screen.getByLabelText("Street address")).toHaveProperty(
    "value",
    "Storgata 1",
  );
});
