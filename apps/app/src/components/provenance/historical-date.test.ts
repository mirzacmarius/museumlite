import { describe, expect, test } from "vitest";
import {
  draftFromHistoricalDate,
  EMPTY_PARTIAL_DATE,
  formatHistoricalDate,
  formatHistoricalPeriod,
  type HistoricalPeriodLabels,
  historicalDateFromDraft,
} from "./historical-date";

const labels: HistoricalPeriodLabels = {
  decade: (year) => `${year}s`,
  circa: (date) => `c. ${date}`,
  notAfter: (date) => `by ${date}`,
  notBefore: (date) => `after ${date}`,
  uncertain: (date) => `${date}?`,
  range: (start, end) => `${start} – ${end}`,
  from: (start) => `From ${start}`,
  until: (end) => `Until ${end}`,
  openStart: (end) => `… – ${end}`,
  undated: "Dates not stated",
};

describe("formatting partial dates", () => {
  test("shows only the precision that was recorded", () => {
    expect(
      formatHistoricalDate(
        { precision: "day", year: 1925, month: 5, day: 12 },
        "en",
        labels,
      ),
    ).toBe("May 12, 1925");
    expect(
      formatHistoricalDate(
        { precision: "month", year: 1925, month: 5 },
        "en",
        labels,
      ),
    ).toBe("May 1925");
    expect(
      formatHistoricalDate({ precision: "decade", year: 1920 }, "en", labels),
    ).toBe("1920s");
    expect(
      formatHistoricalDate(
        { precision: "year", year: 1937, qualifier: "circa", uncertain: true },
        "en",
        labels,
      ),
    ).toBe("c. 1937?");
    expect(
      formatHistoricalDate(
        { precision: "day", year: 45, month: 3, day: 15 },
        "fr",
        labels,
      ),
    ).toBe("15 mars 45");
  });

  test("reads a period without guessing a missing side", () => {
    const by1937 = {
      precision: "year" as const,
      year: 1937,
      qualifier: "notAfter" as const,
    };
    const year1945 = { precision: "year" as const, year: 1945 };
    expect(formatHistoricalPeriod(by1937, year1945, "en", labels)).toBe(
      "by 1937 – 1945",
    );
    expect(formatHistoricalPeriod(by1937, undefined, "en", labels)).toBe(
      "by 1937",
    );
    expect(formatHistoricalPeriod(year1945, undefined, "en", labels)).toBe(
      "From 1945",
    );
    expect(formatHistoricalPeriod(undefined, year1945, "en", labels)).toBe(
      "Until 1945",
    );
    expect(formatHistoricalPeriod(undefined, by1937, "en", labels)).toBe(
      "… – by 1937",
    );
    expect(formatHistoricalPeriod(undefined, undefined, "en", labels)).toBe(
      "Dates not stated",
    );
  });
});

describe("partial date drafts", () => {
  test("an unstated date stays absent and a stated one keeps only its parts", () => {
    expect(historicalDateFromDraft(EMPTY_PARTIAL_DATE)).toBeUndefined();
    expect(
      historicalDateFromDraft({
        ...EMPTY_PARTIAL_DATE,
        precision: "year",
        year: "1937",
        month: "5",
        qualifier: "notAfter",
      }),
    ).toEqual({
      precision: "year",
      year: 1937,
      month: undefined,
      day: undefined,
      qualifier: "notAfter",
      uncertain: undefined,
    });
  });

  test("incomplete or out-of-range parts are refused, not repaired", () => {
    for (const draft of [
      { ...EMPTY_PARTIAL_DATE, precision: "year" as const, year: "" },
      { ...EMPTY_PARTIAL_DATE, precision: "decade" as const, year: "1925" },
      {
        ...EMPTY_PARTIAL_DATE,
        precision: "month" as const,
        year: "1925",
        month: "13",
      },
      {
        ...EMPTY_PARTIAL_DATE,
        precision: "day" as const,
        year: "1925",
        month: "2",
        day: "",
      },
      { ...EMPTY_PARTIAL_DATE, precision: "year" as const, year: "19.5" },
    ]) {
      expect(historicalDateFromDraft(draft)).toBeNull();
    }
  });

  test("a year before Christ is refused: claims hold years from 1 AD", () => {
    expect(
      historicalDateFromDraft({
        ...EMPTY_PARTIAL_DATE,
        precision: "year",
        year: "500",
        era: "bc",
      }),
    ).toBeNull();
    expect(
      historicalDateFromDraft({
        ...EMPTY_PARTIAL_DATE,
        precision: "year",
        year: "500",
        era: "ad",
      }),
    ).toMatchObject({ year: 500 });
  });

  test("round-trips a recorded date", () => {
    const date = {
      precision: "day" as const,
      year: 1925,
      month: 5,
      day: 12,
      qualifier: "circa" as const,
      uncertain: true,
    };
    expect(historicalDateFromDraft(draftFromHistoricalDate(date))).toEqual(
      date,
    );
  });
});
