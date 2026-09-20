import { describe, expect, test } from "vitest";
import { getLocationTypeIconKey } from "./location-type-icon";

describe("getLocationTypeIconKey", () => {
  test("maps standard location types", () => {
    expect(getLocationTypeIconKey("Building")).toBe("building");
    expect(getLocationTypeIconKey("gallery")).toBe("gallery");
    expect(getLocationTypeIconKey("Cabinet")).toBe("cabinet");
    expect(getLocationTypeIconKey("shelf")).toBe("shelf");
    expect(getLocationTypeIconKey("vault")).toBe("vault");
    expect(getLocationTypeIconKey("Storage")).toBe("storage");
    expect(getLocationTypeIconKey("room")).toBe("room");
  });

  test("prefers the more specific type in compound names", () => {
    expect(getLocationTypeIconKey("storage cabinet")).toBe("cabinet");
    expect(getLocationTypeIconKey("archive box")).toBe("archive");
    expect(getLocationTypeIconKey("display case")).toBe("vitrine");
  });

  test("falls back for unknown types", () => {
    expect(getLocationTypeIconKey("other")).toBe("other");
    expect(getLocationTypeIconKey("plaza")).toBe("other");
  });
});
