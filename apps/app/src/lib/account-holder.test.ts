import { describe, expect, test } from "vitest";
import { accountHolderFields, formatDateInputValue } from "./account-holder";

describe("accountHolderFields", () => {
  test("a private person is a person, not a business", () => {
    expect(accountHolderFields("privatePerson")).toEqual({
      kind: "privatePerson",
      showContactPerson: false,
      showOrganizationNumber: false,
      showDateOfBirth: true,
    });
  });

  test("an organization and a legacy account stay a business", () => {
    const organization = {
      kind: "organization",
      showContactPerson: true,
      showOrganizationNumber: true,
      showDateOfBirth: false,
    };

    expect(accountHolderFields("organization")).toEqual(organization);
    expect(accountHolderFields(undefined)).toEqual(organization);
  });
});

describe("formatDateInputValue", () => {
  test("formats a UTC timestamp for a date input", () => {
    expect(formatDateInputValue(Date.parse("1990-04-18T00:00:00Z"))).toBe(
      "1990-04-18",
    );
  });

  test("returns an empty string when there is no date", () => {
    expect(formatDateInputValue(undefined)).toBe("");
  });
});
