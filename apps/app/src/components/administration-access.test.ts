import { describe, expect, test } from "vitest";

import {
  getAdministrationAccess,
  isOrganizationSettingsPath,
} from "./administration-access";

describe("getAdministrationAccess", () => {
  test("stays unknown while permissions are loading", () => {
    expect(
      getAdministrationAccess({ isLoading: true, isAdministrator: false }),
    ).toBe("unknown");
    expect(
      getAdministrationAccess({ isLoading: true, isAdministrator: true }),
    ).toBe("unknown");
  });

  test("resolves to admin or member after permissions load", () => {
    expect(
      getAdministrationAccess({ isLoading: false, isAdministrator: true }),
    ).toBe("admin");
    expect(
      getAdministrationAccess({ isLoading: false, isAdministrator: false }),
    ).toBe("member");
  });
});

describe("isOrganizationSettingsPath", () => {
  test("matches nested /settings/* routes and ignores personal /settings", () => {
    expect(isOrganizationSettingsPath("/settings/organization")).toBe(true);
    expect(isOrganizationSettingsPath("/settings/users")).toBe(true);
    expect(isOrganizationSettingsPath("/settings/billing")).toBe(true);
    expect(isOrganizationSettingsPath("/settings")).toBe(false);
    expect(isOrganizationSettingsPath("/accounts")).toBe(false);
    expect(isOrganizationSettingsPath(null)).toBe(false);
  });
});
