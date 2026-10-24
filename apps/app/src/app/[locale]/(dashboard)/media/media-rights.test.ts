import { expect, test } from "vitest";
import {
  isLicenseExpiryValid,
  mediaRightsUpdate,
  mediaRightsValuesOf,
} from "./media-rights";

const CC0 = "https://creativecommons.org/publicdomain/zero/1.0/";

const stored = mediaRightsValuesOf({
  rightsStatus: "licensed",
  licenseType: "creative_commons_zero",
  licenseExpiry: Date.parse("2030-06-30T23:59:59.999Z"),
  usageRestrictions: "No cropping",
  requiresAcknowledgment: false,
});

test("a file's stored rights read back as entered", () => {
  expect(stored).toEqual({
    rightsStatus: "licensed",
    licenseType: "creative_commons_zero",
    licenseExpiry: "2030-06-30",
    usageRestrictions: "No cropping",
    requiresAcknowledgment: false,
    rightsStatement: undefined,
  });
  expect(mediaRightsValuesOf({})).toMatchObject({
    rightsStatus: "unknown",
    licenseType: "",
    licenseExpiry: "",
  });
});

test("nothing is sent when nothing changed, spaces around restrictions included", () => {
  expect(mediaRightsUpdate(stored, stored)).toEqual({});
  expect(
    mediaRightsUpdate(
      { ...stored, usageRestrictions: " No cropping " },
      stored,
    ),
  ).toEqual({});
});

test("a changed statement is sent alone, and clearing it sends null", () => {
  expect(
    mediaRightsUpdate({ ...stored, rightsStatement: CC0 }, stored),
  ).toEqual({ rightsStatement: CC0 });
  expect(
    mediaRightsUpdate(stored, { ...stored, rightsStatement: CC0 }),
  ).toEqual({ rightsStatement: null });
});

test("any changed recorded right sends all of them, with the expiry at the end of its day", () => {
  expect(
    mediaRightsUpdate({ ...stored, licenseExpiry: "2031-01-15" }, stored),
  ).toEqual({
    rightsStatus: "licensed",
    licenseType: "creative_commons_zero",
    licenseExpiry: Date.parse("2031-01-15T23:59:59.999Z"),
    usageRestrictions: "No cropping",
    requiresAcknowledgment: false,
  });
});

test("a license expiry is a calendar date or empty", () => {
  expect(isLicenseExpiryValid("")).toBe(true);
  expect(isLicenseExpiryValid("2030-06-30")).toBe(true);
  expect(isLicenseExpiryValid("2030-13-45")).toBe(false);
  expect(isLicenseExpiryValid("30/06/2030")).toBe(false);
});
