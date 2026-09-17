import { describe, expect, test } from "vitest";
import {
  DEFAULT_ACCOUNT_HOLDER_TYPE,
  isAccountHolderType,
  parseDateInputValue,
} from "./account-holder";

describe("DEFAULT_ACCOUNT_HOLDER_TYPE", () => {
  test("defaults new accounts to a private person", () => {
    expect(DEFAULT_ACCOUNT_HOLDER_TYPE).toBe("privatePerson");
  });
});

describe("isAccountHolderType", () => {
  test("accepts known holder types", () => {
    expect(isAccountHolderType("privatePerson")).toBe(true);
    expect(isAccountHolderType("organization")).toBe(true);
  });

  test("rejects unknown values", () => {
    expect(isAccountHolderType("")).toBe(false);
    expect(isAccountHolderType("company")).toBe(false);
  });
});

describe("parseDateInputValue", () => {
  test("parses a date input as UTC midnight", () => {
    expect(parseDateInputValue("1990-04-18")).toBe(
      Date.parse("1990-04-18T00:00:00Z"),
    );
  });

  test("returns undefined for empty or invalid values", () => {
    expect(parseDateInputValue("")).toBeUndefined();
    expect(parseDateInputValue("not-a-date")).toBeUndefined();
  });
});
