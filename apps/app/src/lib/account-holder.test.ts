import { expect, test } from "vitest";
import {
  defaultLoanAccountTypeForHolder,
  formatDateInputValue,
  formPatchForHolderType,
  holderScopedAccountFields,
  isAccountHolderType,
  isLoanAccountType,
  isOrganizationHolder,
  loanAccountTypesForHolder,
  parseDateInputValue,
  resolveAccountHolderType,
  resolveLoanAccountTypeForHolder,
} from "./account-holder";

test("private-person holders default to lender, not institution", () => {
  expect(defaultLoanAccountTypeForHolder("privatePerson")).toBe("lender");
  expect(defaultLoanAccountTypeForHolder("organization")).toBe("institution");
});

test("institution is not a valid loan role for private-person holders", () => {
  expect(loanAccountTypesForHolder("privatePerson")).toEqual([
    "lender",
    "borrower",
    "both",
  ]);
  expect(loanAccountTypesForHolder("organization")).toContain("institution");
});

test("switching to private person replaces institution with lender", () => {
  expect(resolveLoanAccountTypeForHolder("privatePerson", "institution")).toBe(
    "lender",
  );
  expect(resolveLoanAccountTypeForHolder("privatePerson", "borrower")).toBe(
    "borrower",
  );
  expect(resolveLoanAccountTypeForHolder("organization", "lender")).toBe(
    "lender",
  );
});

test("patron is not treated as a loan account type", () => {
  expect(isLoanAccountType("patron")).toBe(false);
  expect(isLoanAccountType("lender")).toBe(true);
  expect(isLoanAccountType(undefined)).toBe(false);
});

test("missing holder type is treated as a business account", () => {
  expect(isOrganizationHolder(undefined)).toBe(true);
  expect(isOrganizationHolder("organization")).toBe(true);
  expect(isOrganizationHolder("privatePerson")).toBe(false);
  expect(resolveAccountHolderType(undefined)).toBe("organization");
  expect(resolveAccountHolderType("privatePerson")).toBe("privatePerson");
});

test("holder type radio values are accepted, other strings are not", () => {
  expect(isAccountHolderType("privatePerson")).toBe(true);
  expect(isAccountHolderType("organization")).toBe(true);
  expect(isAccountHolderType("patron")).toBe(false);
});

test("changing holder type keeps a compatible loan role", () => {
  expect(formPatchForHolderType("privatePerson", "institution")).toEqual({
    holderType: "privatePerson",
    accountType: "lender",
  });
  expect(formPatchForHolderType("organization", "borrower")).toEqual({
    holderType: "organization",
    accountType: "borrower",
  });
});

test("holder-scoped fields clear values that belong to the other holder type", () => {
  expect(
    holderScopedAccountFields("privatePerson", {
      taxId: "123",
      dateOfBirth: "1990-04-18",
      contactPerson: "Ada",
      contactPhone: "1",
      contactEmail: "a@b.c",
    }),
  ).toEqual({
    taxId: undefined,
    dateOfBirth: Date.parse("1990-04-18T00:00:00Z"),
    contactPerson: undefined,
    contactPhone: undefined,
    contactEmail: undefined,
  });
  expect(
    holderScopedAccountFields("organization", {
      taxId: "123",
      dateOfBirth: "1990-04-18",
      contactPerson: "Ada",
      contactPhone: "1",
      contactEmail: "a@b.c",
    }),
  ).toEqual({
    taxId: "123",
    dateOfBirth: undefined,
    contactPerson: "Ada",
    contactPhone: "1",
    contactEmail: "a@b.c",
  });
});

test("date of birth round-trips through UTC date inputs", () => {
  const timestamp = parseDateInputValue("1990-04-18");
  expect(timestamp).toBe(Date.parse("1990-04-18T00:00:00Z"));
  expect(formatDateInputValue(timestamp)).toBe("1990-04-18");
  expect(formatDateInputValue(undefined)).toBe("");
});
