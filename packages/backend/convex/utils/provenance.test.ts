import { describe, expect, test } from "vitest";
import {
  historicalDateEdtf,
  historicalDateSpan,
  provenanceClaimSortKey,
} from "./provenance";

describe("partial dates", () => {
  test("map to EDTF without adding precision the source does not give", () => {
    expect(
      historicalDateEdtf({ precision: "day", year: 1925, month: 5, day: 12 }),
    ).toBe("1925-05-12");
    expect(
      historicalDateEdtf({ precision: "month", year: 1925, month: 5 }),
    ).toBe("1925-05");
    expect(
      historicalDateEdtf({ precision: "year", year: 1925, qualifier: "circa" }),
    ).toBe("1925~");
    expect(
      historicalDateEdtf({ precision: "year", year: 1925, uncertain: true }),
    ).toBe("1925?");
    expect(
      historicalDateEdtf({
        precision: "year",
        year: 1925,
        qualifier: "circa",
        uncertain: true,
      }),
    ).toBe("1925%");
    expect(historicalDateEdtf({ precision: "decade", year: 1920 })).toBe(
      "192X",
    );
    expect(
      historicalDateEdtf({
        precision: "year",
        year: 1937,
        qualifier: "notAfter",
      }),
    ).toBe("[..1937]");
    expect(
      historicalDateEdtf({
        precision: "year",
        year: 805,
        qualifier: "notBefore",
      }),
    ).toBe("[0805..]");
  });

  test("cover the calendar days their precision implies", () => {
    expect(
      historicalDateSpan({ precision: "month", year: 1924, month: 2 }),
    ).toEqual({
      earliest: 19240201,
      latest: 19240229,
    });
    expect(historicalDateSpan({ precision: "decade", year: 1920 })).toEqual({
      earliest: 19200101,
      latest: 19291231,
    });
  });

  test("order claims by start, then end, with undated claims last", () => {
    expect(
      provenanceClaimSortKey({ startDate: { precision: "year", year: 1930 } }),
    ).toBeLessThan(
      provenanceClaimSortKey({ endDate: { precision: "year", year: 1931 } }),
    );
    expect(provenanceClaimSortKey({})).toBe(Number.POSITIVE_INFINITY);
  });
});
