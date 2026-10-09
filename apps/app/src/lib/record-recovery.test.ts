import { ConvexError } from "convex/values";
import { describe, expect, test } from "vitest";
import { recordErrorKind, recordViewState } from "./record-recovery";

describe("recordErrorKind", () => {
  test("a coded forbidden read is a permission problem, not a crash", () => {
    expect(
      recordErrorKind(
        new ConvexError({ code: "RECORD_FORBIDDEN", message: "denied" }),
      ),
    ).toBe("forbidden");
  });

  test("clients that receive the error payload as JSON read the same code", () => {
    expect(
      recordErrorKind(
        new ConvexError(
          JSON.stringify({ code: "RECORD_FORBIDDEN", message: "denied" }),
        ),
      ),
    ).toBe("forbidden");
  });

  test("a feature outside the organization's plan is unavailable", () => {
    expect(
      recordErrorKind(
        new ConvexError({ code: "CAPABILITY_UNAVAILABLE", message: "plan" }),
      ),
    ).toBe("unavailable");
    expect(
      recordErrorKind(
        new Error("[CONVEX Q(loans:get)] Feature requires pro tier"),
      ),
    ).toBe("unavailable");
  });

  test("a link whose identifier fails validation reads as missing", () => {
    expect(
      recordErrorKind(
        new Error(
          'ArgumentValidationError: Value does not match validator.\nPath: .loanId\nValue: "abc"\nValidator: v.id("loans")',
        ),
      ),
    ).toBe("missing");
  });

  test("anything else is an unexpected error that can be retried", () => {
    expect(recordErrorKind(new Error("Server Error"))).toBe("error");
    expect(recordErrorKind("boom")).toBe("error");
    expect(
      recordErrorKind(new ConvexError({ code: "SOURCE_CHANGED", message: "" })),
    ).toBe("error");
  });
});

describe("recordViewState", () => {
  test("a record still loading is neither missing nor ready", () => {
    expect(recordViewState(undefined, false)).toBe("loading");
  });

  test("a record that never loaded is missing", () => {
    expect(recordViewState(null, false)).toBe("missing");
  });

  test("a record that disappears while open is reported as removed, not missing", () => {
    expect(recordViewState(null, true)).toBe("removed");
  });

  test("a loaded record is ready", () => {
    expect(recordViewState({ _id: "abc" }, false)).toBe("ready");
  });
});
