// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { getFunctionName } from "convex/server";
import { ConvexError } from "convex/values";
import { beforeEach, expect, test, vi } from "vitest";
import { renderOnPage } from "@/testing/render-on-page";
import OrganizationSettingsPage from "./page";

const updateOrganization = vi.fn();
let canManageSettings = true;
let organization: {
  _id: string;
  name: string;
  slug: string;
  type: "museum";
  address?: Record<string, string>;
  phone?: string;
};

vi.mock("convex/react", () => ({
  useQuery: (reference: unknown, args: unknown) => {
    if (args === "skip") return undefined;
    return getFunctionName(reference as never) === "organizations:get"
      ? organization
      : undefined;
  },
  useMutation: (reference: unknown) =>
    getFunctionName(reference as never) === "organizations:update"
      ? updateOrganization
      : vi.fn(),
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
});

test("staff edit the address and phone and Save Changes sends every line", async () => {
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
  await user.click(screen.getByRole("button", { name: "Save Changes" }));

  expect(updateOrganization).toHaveBeenCalledWith({
    organizationId: "org-1",
    name: "112 St. Magnus",
    address: {
      street: "Strandgata 12",
      street2: "",
      postalCode: "6413",
      city: "Molde",
      region: "",
      country: "Norway",
    },
    phone: "+47 71 20 00 00",
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

  await user.click(screen.getByRole("button", { name: "Save Changes" }));

  expect(
    await screen.findByText("City can be at most 200 characters long."),
  ).toBeTruthy();
});
