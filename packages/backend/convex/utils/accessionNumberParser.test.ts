import { describe, expect, test } from "vitest";
import {
  AccessionNumberParser,
  accessionFormatError,
  accessionFormatErrorFromError,
} from "./accessionNumberParser";

describe("AccessionNumberParser", () => {
  const parser = new AccessionNumberParser();
  const thisYear = new Date().getFullYear();

  test("parse substitutes year and padded counter", () => {
    expect(
      parser.parse("{YYYY}.{####}", {
        organizationSlug: "met",
        currentDate: new Date("2026-03-05T12:00:00Z"),
        counterValue: 7,
      }),
    ).toBe("2026.0007");
  });

  test("parse reads a stored format written with bare YYYY and ### tokens", () => {
    expect(
      parser.parse("NAT-YYYY-###", {
        organizationSlug: "natural-history-museum",
        currentDate: new Date("2026-03-05T12:00:00Z"),
        counterValue: 7,
      }),
    ).toBe("NAT-2026-007");
  });

  test("parse keeps a literal # in a format that uses braced variables", () => {
    expect(
      parser.parse("{YYYY}#{###}", {
        organizationSlug: "met",
        currentDate: new Date("2026-03-05T12:00:00Z"),
        counterValue: 7,
      }),
    ).toBe("2026#007");
  });

  test("a bare-token format resets its counter yearly like its braced form", () => {
    expect(parser.getCounterScopeFromTemplate("NAT-YYYY-###")).toBe("year");
    expect(parser.getCounterScopeFromTemplate("NAT-###")).toBe("global");
  });

  test("validate rejects an empty template", () => {
    const result = parser.validate("", "met");

    expect(result.isValid).toBe(false);
    expect(result.error).toBe("Template cannot be empty");
    expect(result.issues).toEqual([{ code: "FORMAT_EMPTY" }]);
  });

  test("validate requires a counter token", () => {
    const result = parser.validate("{YYYY}", "met");

    expect(result.isValid).toBe(false);
    expect(result.error).toMatch(/counter/i);
    expect(result.issues).toEqual([{ code: "COUNTER_MISSING" }]);
  });

  test.each([
    "OBJ-0001",
    "NAT-YYYY",
  ])("validate rejects %s, which has no counter in either syntax", (template) => {
    for (const stored of [false, true]) {
      const result = parser.validate(template, "met", { stored });

      expect(result.isValid).toBe(false);
      expect(result.issues).toEqual([{ code: "COUNTER_MISSING" }]);
    }
  });

  test.each([
    "NAT-YYYY-###",
    "MUS-YYYY-MM-####",
    "Inv#YYYY-####",
    "ORG-YY-###",
  ])("validate refuses a new format written with bare tokens, %s", (template) => {
    const result = parser.validate(template, "met");

    expect(result.isValid).toBe(false);
    expect(result.issues).toEqual([{ code: "COUNTER_MISSING" }]);
    expect(result.examples).toEqual([]);
  });

  test("validate names a variable the parser does not support", () => {
    const result = parser.validate("{YYYY}-{XYZ}-{####}", "met");

    expect(result.isValid).toBe(false);
    expect(result.issues).toEqual([
      { code: "UNKNOWN_VARIABLE", variable: "{XYZ}" },
    ]);
  });

  test("validate accepts year and counter and returns three examples", () => {
    const result = parser.validate("{YYYY}.{####}", "met");

    expect(result.isValid).toBe(true);
    expect(result.issues).toEqual([]);
    expect(result.examples).toHaveLength(3);
  });

  test("validate accepts a stored bare-token format and previews what it generates", () => {
    const result = parser.validate("NAT-YYYY-###", "natural-history-museum", {
      stored: true,
    });

    expect(result.isValid).toBe(true);
    expect(result.issues).toEqual([]);
    expect(result.preview).toBe(`NAT-${thisYear}-001`);
    expect(result.examples).toEqual([
      `NAT-${thisYear}-001`,
      `NAT-${thisYear}-002`,
      `NAT-${thisYear}-003`,
    ]);
  });

  test("every preset is valid", () => {
    for (const preset of AccessionNumberParser.getPresets()) {
      expect(parser.validate(preset.template, "met").issues).toEqual([]);
    }
  });
});

describe("accession format errors", () => {
  test("a refused format crosses to the client as coded issues", () => {
    const parser = new AccessionNumberParser();
    const refusal = accessionFormatError(parser.validate("NAT-YYYY", "nat"));

    expect(accessionFormatErrorFromError(refusal)).toEqual({
      code: "ACCESSION_FORMAT_INVALID",
      message: refusal.data.message,
      issues: [{ code: "COUNTER_MISSING" }],
    });
    expect(
      accessionFormatErrorFromError({
        name: "ConvexError",
        data: JSON.stringify(refusal.data),
      })?.issues,
    ).toEqual([{ code: "COUNTER_MISSING" }]);
  });

  test("other failures are not read as a format refusal", () => {
    expect(accessionFormatErrorFromError(new Error("boom"))).toBeNull();
    expect(
      accessionFormatErrorFromError({
        name: "ConvexError",
        data: { code: "IDENTIFIER_IN_USE" },
      }),
    ).toBeNull();
  });
});
