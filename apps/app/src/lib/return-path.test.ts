import { describe, expect, test } from "vitest";
import {
  backToResultsHref,
  listReturnPath,
  withReturnPath,
} from "./return-path";

describe("listReturnPath", () => {
  test("keeps the list path and its query without the locale segment", () => {
    expect(
      listReturnPath("/en/loans", new URLSearchParams("status=pending&q=map")),
    ).toBe("/loans?status=pending&q=map");
    expect(listReturnPath("/objects", new URLSearchParams())).toBe("/objects");
  });
});

describe("withReturnPath", () => {
  test("records the originating list on a detail link", () => {
    expect(withReturnPath("/loans/abc", "/loans?status=pending&q=map")).toBe(
      "/loans/abc?from=%2Floans%3Fstatus%3Dpending%26q%3Dmap",
    );
  });

  test("keeps existing detail query parameters", () => {
    expect(withReturnPath("/objects/abc?tab=media", "/objects")).toBe(
      "/objects/abc?tab=media&from=%2Fobjects",
    );
  });

  test("leaves the link unchanged without a list to return to", () => {
    expect(withReturnPath("/loans/abc", null)).toBe("/loans/abc");
  });
});

describe("backToResultsHref", () => {
  test("returns to the exact originating list", () => {
    const detailLink = withReturnPath(
      "/loans/abc",
      "/loans?status=pending&q=map",
    );
    const from = new URL(detailLink, "https://app.test").searchParams.get(
      "from",
    );

    expect(backToResultsHref(from, "/loans")).toEqual({
      href: "/loans?status=pending&q=map",
      fromResults: true,
    });
  });

  test("falls back to the list when the detail was opened directly", () => {
    expect(backToResultsHref(null, "/loans")).toEqual({
      href: "/loans",
      fromResults: false,
    });
  });

  test.each([
    "https://evil.example/loans",
    "//evil.example/loans",
    "/\\evil.example",
    "\\\\evil.example",
    "javascript:alert(1)",
    "loans?status=pending",
    "/loans\n?x=1",
    `/${"a".repeat(2100)}`,
  ])("ignores an unsafe return path %j", (from) => {
    expect(backToResultsHref(from, "/loans")).toEqual({
      href: "/loans",
      fromResults: false,
    });
  });
});
