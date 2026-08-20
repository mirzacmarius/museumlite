import { describe, expect, test } from "vitest";
import { AccessionNumberParser } from "./accessionNumberParser";

describe("AccessionNumberParser", () => {
  const parser = new AccessionNumberParser();

  test("parse substitutes year and padded counter", () => {
    expect(
      parser.parse("{YYYY}.{####}", {
        organizationSlug: "met",
        currentDate: new Date("2026-03-05T12:00:00Z"),
        counterValue: 7,
      }),
    ).toBe("2026.0007");
  });

  test("validate rejects an empty template", () => {
    const result = parser.validate("", "met");

    expect(result.isValid).toBe(false);
    expect(result.error).toBe("Template cannot be empty");
  });

  test("validate requires a counter token", () => {
    const result = parser.validate("{YYYY}", "met");

    expect(result.isValid).toBe(false);
    expect(result.error).toMatch(/counter/i);
  });

  test("validate accepts year and counter and returns three examples", () => {
    const result = parser.validate("{YYYY}.{####}", "met");

    expect(result.isValid).toBe(true);
    expect(result.examples).toHaveLength(3);
  });
});
