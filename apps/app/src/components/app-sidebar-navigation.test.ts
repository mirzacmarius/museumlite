import type {
  CapabilityId,
  CapabilityState,
} from "@v1/backend/convex/utils/capabilities";
import { describe, expect, test } from "vitest";

import {
  buildSidebarNavigation,
  type NavigationGroup,
  type NavigationItem,
} from "./app-sidebar-navigation";

type StateOverrides = Partial<
  Record<CapabilityId, Omit<CapabilityState, "capability">>
>;

const navigationLabels: Record<string, string> = {
  "untranslatedComponents.navigation.patronManagement": "Patron Management",
  "untranslatedComponents.navigation.overview": "Overview",
  "untranslatedComponents.navigation.objectCatalog": "Object Catalog",
  "untranslatedComponents.navigation.locationTracking": "Location & Tracking",
  "untranslatedComponents.navigation.scan": "Scan",
  "untranslatedComponents.navigation.accessions": "Accessions",
  "untranslatedComponents.navigation.deaccessions": "Deaccessions",
  "untranslatedComponents.navigation.conservation": "Conservation",
  "untranslatedComponents.navigation.insurance": "Insurance",
  "untranslatedComponents.navigation.loansTransport": "Loans & Transport",
  "untranslatedComponents.navigation.transitLog": "Transit Log",
  "untranslatedComponents.navigation.exhibitions": "Exhibitions",
  "untranslatedComponents.navigation.installations": "Installations",
  "untranslatedComponents.navigation.libraryDashboard": "Library Dashboard",
  "untranslatedComponents.navigation.catalogSearch": "Catalog & Search",
  "untranslatedComponents.navigation.circulationDesk": "Circulation Desk",
  "untranslatedComponents.navigation.holds": "Holds",
  "untranslatedComponents.navigation.finesFees": "Fines & Fees",
  "untranslatedComponents.navigation.acquisitions": "Acquisitions",
  "untranslatedComponents.navigation.analyticsReports": "Analytics & Reports",
  "untranslatedComponents.navigation.accountsCrm": "Accounts & CRM",
  "untranslatedComponents.navigation.publicPortal": "Public Portal",
  "untranslatedComponents.navigation.digitalAssets": "Digital Assets",
  "untranslatedComponents.navigation.preferences": "Preferences",
  "untranslatedComponents.navigation.settings": "Settings",
  "untranslatedComponents.navigation.exhibitionsLoans": "Exhibitions & Loans",
  "untranslatedComponents.navigation.library": "Library",
  "untranslatedComponents.navigation.administration": "Administration",
};

function buildNavigation(
  overrides: StateOverrides = {},
  { capabilitiesLoaded = true } = {},
) {
  return buildSidebarNavigation({
    translate: (key) => navigationLabels[key] ?? key,
    capabilityState: (capability) => {
      if (!capabilitiesLoaded) return undefined;
      const override = overrides[capability];
      return override
        ? ({ capability, ...override } as CapabilityState)
        : { capability, status: "available" };
    },
    isLocationTrackingEnabled: true,
  });
}

function findGroup(groups: NavigationGroup[], title: string): NavigationGroup {
  const group = groups.find((item) => item.title === title);
  if (!group) throw new Error(`Expected ${title} navigation group`);
  return group;
}

function findItem(items: NavigationItem[], title: string): NavigationItem {
  const item = items.find((navigationItem) => navigationItem.title === title);
  if (!item) throw new Error(`Expected ${title} navigation item`);
  return item;
}

function allTitles(navigation: ReturnType<typeof buildNavigation>) {
  return [
    ...navigation.topLevelNavigation.map((item) => item.title),
    ...navigation.navigationGroups.flatMap((group) =>
      group.items.map((item) => item.title),
    ),
  ];
}

describe("buildSidebarNavigation", () => {
  test("lists Patron Management once, in the Library group", () => {
    const navigation = buildNavigation();

    expect(
      allTitles(navigation).filter((title) => title === "Patron Management"),
    ).toHaveLength(1);
    expect(
      findItem(
        findGroup(navigation.navigationGroups, "Library").items,
        "Patron Management",
      ).url,
    ).toBe("/accounts?type=patron");
  });

  test("locks Patron Management when the Accounts module is off, so the page can explain", () => {
    const { navigationGroups } = buildNavigation({
      patrons: { status: "module_disabled", module: "accounts" },
    });

    expect(
      findItem(
        findGroup(navigationGroups, "Library").items,
        "Patron Management",
      ).locked,
    ).toBe(true);
  });

  test("hides the Library group when the library module is off", () => {
    const { navigationGroups } = buildNavigation({
      library: { status: "module_disabled", module: "library" },
    });

    expect(navigationGroups.some((group) => group.title === "Library")).toBe(
      false,
    );
  });

  test("shows plan-gated workflows locked at their canonical routes", () => {
    const { navigationGroups, topLevelNavigation } = buildNavigation({
      loans: { status: "tier_required", requiredTier: "pro" },
      conservation: { status: "tier_required", requiredTier: "pro" },
    });

    const loans = findItem(
      findGroup(navigationGroups, "Exhibitions & Loans").items,
      "Loans & Transport",
    );
    const conservation = findItem(topLevelNavigation, "Conservation");

    expect(loans).toMatchObject({ url: "/loans", locked: true });
    expect(conservation).toMatchObject({ url: "/conservation", locked: true });
  });

  test("locks Insurance by the loans plan it is enforced with, not conservation", () => {
    const { topLevelNavigation } = buildNavigation({
      conservation: { status: "tier_required", requiredTier: "pro" },
    });

    expect(findItem(topLevelNavigation, "Insurance")).toMatchObject({
      url: "/insurance",
      locked: false,
    });
  });

  test("hides Insurance while the insurance module is off", () => {
    const navigation = buildNavigation({
      insurance: { status: "module_disabled", module: "insurance" },
    });

    expect(allTitles(navigation)).not.toContain("Insurance");
  });

  test("hides destinations the member's role cannot open", () => {
    const navigation = buildNavigation({
      loans: { status: "permission_missing" },
      transit: { status: "permission_missing" },
    });

    expect(allTitles(navigation)).not.toContain("Loans & Transport");
    expect(allTitles(navigation)).not.toContain("Transit Log");
    expect(allTitles(navigation)).toContain("Exhibitions");
  });

  test("hides Accounts & CRM while the accounts module is off", () => {
    const navigation = buildNavigation({
      accounts: { status: "module_disabled", module: "accounts" },
    });

    expect(allTitles(navigation)).not.toContain("Accounts & CRM");
    expect(allTitles(navigation)).toContain("Public Portal");
  });

  test("shows the Administration group only to administrators", () => {
    const { navigationGroups } = buildNavigation({
      administration: { status: "permission_missing" },
      reporting: { status: "permission_missing" },
      accounts: { status: "permission_missing" },
      public_portal: { status: "permission_missing" },
    });

    expect(
      navigationGroups.some((group) => group.title === "Administration"),
    ).toBe(false);
  });

  test("drops a group whose every destination is hidden", () => {
    const { navigationGroups } = buildNavigation({
      loans: { status: "permission_missing" },
      transit: { status: "permission_missing" },
      exhibitions: { status: "permission_missing" },
      installations: { status: "permission_missing" },
    });

    expect(
      navigationGroups.some((group) => group.title === "Exhibitions & Loans"),
    ).toBe(false);
  });

  test("keeps gated destinations out of the sidebar until capabilities load", () => {
    const navigation = buildNavigation({}, { capabilitiesLoaded: false });

    expect(allTitles(navigation)).toEqual([
      "Overview",
      "Object Catalog",
      "Location & Tracking",
      "Scan",
      "Accessions",
      "Deaccessions",
    ]);
  });
});
