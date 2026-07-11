import { describe, expect, test } from "vitest";

import {
  buildSidebarNavigation,
  type NavigationGroup,
  type NavigationItem,
} from "./app-sidebar-navigation";

function buildNavigation({
  enabledFeatures = new Set<string>([
    "conservation",
    "exhibitions",
    "installations",
    "loans",
    "public_portal",
    "reporting",
  ]),
  isLibraryModuleEnabled = true,
}: {
  enabledFeatures?: Set<string>;
  isLibraryModuleEnabled?: boolean;
} = {}) {
  return buildSidebarNavigation({
    hasFeature: (featureId) => enabledFeatures.has(featureId),
    isLibraryModuleEnabled,
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

describe("buildSidebarNavigation", () => {
  test("adds Patron Management to Exhibitions & Loans and Library", () => {
    const { navigationGroups } = buildNavigation();

    const exhibitionsLoansPatrons = findItem(
      findGroup(navigationGroups, "Exhibitions & Loans").items,
      "Patron Management",
    );
    const libraryPatrons = findItem(
      findGroup(navigationGroups, "Library").items,
      "Patron Management",
    );

    expect(exhibitionsLoansPatrons.url).toBe("/accounts?type=patron");
    expect(libraryPatrons.url).toBe("/accounts?type=patron");
  });

  test("locks the Exhibitions & Loans patron link with the loans feature", () => {
    const { navigationGroups } = buildNavigation({
      enabledFeatures: new Set(["exhibitions", "installations"]),
    });

    const patrons = findItem(
      findGroup(navigationGroups, "Exhibitions & Loans").items,
      "Patron Management",
    );

    expect(patrons.locked).toBe(true);
  });

  test("keeps the Library patron link unlocked when the library module is enabled", () => {
    const { navigationGroups } = buildNavigation({
      enabledFeatures: new Set(),
      isLibraryModuleEnabled: true,
    });

    const patrons = findItem(
      findGroup(navigationGroups, "Library").items,
      "Patron Management",
    );

    expect(patrons.locked).toBe(false);
  });

  test("locks the Library patron link with the library module", () => {
    const { navigationGroups } = buildNavigation({
      isLibraryModuleEnabled: false,
    });

    const patrons = findItem(
      findGroup(navigationGroups, "Library").items,
      "Patron Management",
    );

    expect(patrons.locked).toBe(true);
  });
});
