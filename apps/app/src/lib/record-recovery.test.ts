import { ConvexError } from "convex/values";
import { describe, expect, test } from "vitest";
import { recordErrorKind, recordViewState } from "./record-recovery";

const refusal = (reason: string) =>
  new ConvexError({
    code: "CAPABILITY_UNAVAILABLE",
    reason,
    message: "refused",
  });

describe("recordErrorKind", () => {
  test("a role without the read permission is a permission problem, not a crash", () => {
    expect(recordErrorKind(refusal("permission_missing"))).toBe("forbidden");
  });

  test("clients that receive the error payload as JSON read the same reason", () => {
    expect(
      recordErrorKind(
        new ConvexError(
          JSON.stringify({
            code: "CAPABILITY_UNAVAILABLE",
            reason: "permission_missing",
            message: "refused",
          }),
        ),
      ),
    ).toBe("forbidden");
  });

  test("a module that is off or a plan without the feature is unavailable", () => {
    expect(recordErrorKind(refusal("tier_required"))).toBe("unavailable");
    expect(recordErrorKind(refusal("module_disabled"))).toBe("unavailable");
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
