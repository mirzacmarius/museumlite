// @vitest-environment jsdom
import { screen, waitForElementToBeRemoved } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  AccessionNumberParser,
  accessionFormatError,
  accessionParser,
} from "@v1/backend/convex/utils/accessionNumberParser";
import { getFunctionName } from "convex/server";
import { beforeEach, expect, test, vi } from "vitest";
import { renderOnPage } from "@/testing/render-on-page";
import PreferencesSettingsPage from "./page";

const updateOrganization = vi.fn();
const createTemplate = vi.fn();
const removeTemplate = vi.fn();
let customTemplates: { _id: string; name: string; template: string }[] = [];
let organization: {
  _id: string;
  slug: string;
  accountNumber: string;
  settings: { accessionNumberFormat: string; locationTrackingEnabled: boolean };
};
let validationLoaded = true;

vi.mock("convex/react", () => ({
  useQuery: (reference: unknown, args: unknown) => {
    if (args === "skip") return undefined;
    switch (getFunctionName(reference as never)) {
      case "organizations:get":
        return organization;
      case "organizations:validateAccessionFormat": {
        const { template, organizationSlug, stored } = args as {
          template: string;
          organizationSlug: string;
          stored?: boolean;
        };
        return validationLoaded
          ? accessionParser.validate(template, organizationSlug, { stored })
          : undefined;
      }
      case "organizations:getAccessionTemplatePresets":
        return AccessionNumberParser.getPresets();
      case "accessionTemplates:list":
        return customTemplates;
      default:
        return undefined;
    }
  },
  useMutation: (reference: unknown) => {
    switch (getFunctionName(reference as never)) {
      case "organizations:update":
        return updateOrganization;
      case "accessionTemplates:create":
        return createTemplate;
      case "accessionTemplates:remove":
        return removeTemplate;
      default:
        return vi.fn();
    }
  },
}));
vi.mock("@/components/organization-provider", () => ({
  useOrganization: () => ({ currentOrganizationId: "org-1" }),
}));
vi.mock("@/components/permission-gate", () => ({
  PermissionGate: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock("@/components/materials-combobox", () => ({
  MaterialsCombobox: () => null,
}));
vi.mock("@/components/type-combobox", () => ({ TypeCombobox: () => null }));
vi.mock("./identifier-review", () => ({ IdentifierReview: () => null }));

beforeEach(() => {
  organization = {
    _id: "org-1",
    slug: "natural-history-museum",
    accountNumber: "ORG-00001",
    settings: {
      accessionNumberFormat: "NAT-YYYY-###",
      locationTrackingEnabled: true,
    },
  };
  validationLoaded = true;
  updateOrganization.mockReset();
  updateOrganization.mockResolvedValue(null);
  createTemplate.mockReset();
  removeTemplate.mockReset();
  removeTemplate.mockResolvedValue(null);
  customTemplates = [];
});

/** The format template trigger shows the current format as its text. */
function formatTemplateTrigger() {
  const trigger = screen
    .getByText(organization.settings.accessionNumberFormat)
    .closest("button");
  if (!trigger) throw new Error("Format template trigger not found");
  return trigger;
}

async function changeFormat(format: string) {
  const user = userEvent.setup();
  await user.click(formatTemplateTrigger());
  const input = screen.getByPlaceholderText("{YYYY}-{####}");
  await user.clear(input);
  if (format) {
    await user.click(input);
    await user.paste(format);
  }
  await user.keyboard("{Escape}");
  // The popover animates closed before it leaves the page.
  await waitForElementToBeRemoved(input);
  return user;
}

const COUNTER_MISSING =
  "Add a counter such as {####} to the format template, so each number is unique.";

function savedSettings() {
  expect(updateOrganization).toHaveBeenCalledOnce();
  const [{ settings }] = updateOrganization.mock.calls[0] as [
    { settings: Record<string, unknown> },
  ];
  return settings;
}

test.each([
  "NAT-YYYY-###",
  "OBJ-0001",
])("saving with the stored format %s untouched saves the other settings and leaves the format alone", async (storedFormat) => {
  organization.settings.accessionNumberFormat = storedFormat;
  const user = userEvent.setup();
  await renderOnPage(<PreferencesSettingsPage />, "/en/settings/preferences");

  await user.click(screen.getByRole("button", { name: "Save Changes" }));

  expect(screen.queryByText(/Invalid accession format/)).toBeNull();
  const settings = savedSettings();
  expect(settings.accessionNumberFormat).toBeUndefined();
  expect(settings.locationTrackingEnabled).toBe(true);
});

test("a stored bare-token format reads as valid and previews the number it generates", async () => {
  const user = userEvent.setup();
  await renderOnPage(<PreferencesSettingsPage />, "/en/settings/preferences");

  await user.click(formatTemplateTrigger());

  screen.getByText("Valid format");
  screen.getByText(`NAT-${new Date().getFullYear()}-001`);
});

test.each([
  "NAT-{YYYY}",
  "MUS-YYYY-MM-####",
])("a new format without a braced counter, %s, is explained in translated copy and not saved", async (format) => {
  await renderOnPage(<PreferencesSettingsPage />, "/en/settings/preferences");

  const user = await changeFormat(format);
  await user.click(screen.getByRole("button", { name: "Save Changes" }));

  screen.getByText(COUNTER_MISSING);
  expect(screen.queryByText(/Template must contain/)).toBeNull();
  expect(updateOrganization).not.toHaveBeenCalled();
});

test("clearing the format template asks for one and saves nothing", async () => {
  await renderOnPage(<PreferencesSettingsPage />, "/en/settings/preferences");

  const user = await changeFormat("");
  await user.click(screen.getByRole("button", { name: "Save Changes" }));

  screen.getByText("Enter a format template.");
  expect(updateOrganization).not.toHaveBeenCalled();
});

test("a new format the server refuses is explained in translated copy", async () => {
  validationLoaded = false;
  updateOrganization.mockRejectedValue(
    accessionFormatError(accessionParser.validate("NAT-{YYYY}", "nat")),
  );
  await renderOnPage(<PreferencesSettingsPage />, "/en/settings/preferences");

  const user = await changeFormat("NAT-{YYYY}");
  await user.click(screen.getByRole("button", { name: "Save Changes" }));

  expect(savedSettings().accessionNumberFormat).toBe("NAT-{YYYY}");
  await screen.findByText(COUNTER_MISSING);
});

test("a new format the generator can use is saved", async () => {
  await renderOnPage(<PreferencesSettingsPage />, "/en/settings/preferences");

  const user = await changeFormat("NAT-{YYYY}-{####}");
  await user.click(screen.getByRole("button", { name: "Save Changes" }));

  expect(savedSettings().accessionNumberFormat).toBe("NAT-{YYYY}-{####}");
});

test("a template the library refuses is explained in translated copy", async () => {
  createTemplate.mockRejectedValue(
    accessionFormatError(accessionParser.validate("NAT-YYYY-###", "nat")),
  );
  const user = userEvent.setup();
  await renderOnPage(<PreferencesSettingsPage />, "/en/settings/preferences");

  await user.click(formatTemplateTrigger());
  await user.click(screen.getByRole("button", { name: "Save" }));
  await user.type(screen.getByLabelText("Template Name *"), "Yearly");
  await user.click(screen.getByRole("button", { name: "Save Template" }));

  expect(createTemplate).toHaveBeenCalledOnce();
  await screen.findByText(COUNTER_MISSING);
});

test("saving a stored bare-token format as a template stores its braced form", async () => {
  createTemplate.mockResolvedValue("template-1");
  const user = userEvent.setup();
  await renderOnPage(<PreferencesSettingsPage />, "/en/settings/preferences");

  await user.click(formatTemplateTrigger());
  await user.click(screen.getByRole("button", { name: "Save" }));
  await user.type(screen.getByLabelText("Template Name *"), "Yearly");
  await user.click(screen.getByRole("button", { name: "Save Template" }));

  expect(createTemplate).toHaveBeenCalledWith(
    expect.objectContaining({ template: "NAT-{YYYY}-{###}" }),
  );
});

test("deleting the library template of the saved format keeps that format", async () => {
  organization.settings.accessionNumberFormat = "HOUSE-{YYYY}-{####}";
  customTemplates = [
    { _id: "template-1", name: "House style", template: "HOUSE-{YYYY}-{####}" },
  ];
  const user = userEvent.setup();
  await renderOnPage(<PreferencesSettingsPage />, "/en/settings/preferences");

  const trigger = screen.getByText("House style").closest("button");
  if (!trigger) throw new Error("Format template trigger not found");
  await user.click(trigger);
  const option = screen
    .getAllByText("House style")
    .map((label) => label.closest("[cmdk-item]"))
    .find(Boolean);
  if (!(option instanceof HTMLElement)) throw new Error("Template not found");
  const buttons = option.querySelectorAll("button");
  const deleteButton = buttons[buttons.length - 1];
  if (!deleteButton) throw new Error("Delete button not found");
  await user.click(deleteButton);
  await user.click(await screen.findByRole("button", { name: "Delete" }));
  await user.click(screen.getByRole("button", { name: "Save Changes" }));

  expect(removeTemplate).toHaveBeenCalledWith({ templateId: "template-1" });
  expect(screen.queryByText("Enter a format template.")).toBeNull();
  expect(savedSettings().accessionNumberFormat).toBeUndefined();
});
