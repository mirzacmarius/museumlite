import {
  formatEdtf,
  parseEdtf,
  productionYears,
  readDateText,
} from "@v1/backend/convex/utils/productionDates";
import { describe, expect, test } from "vitest";
import {
  EMPTY_PARTIAL_DATE,
  type PartialDateDraft,
} from "@/components/provenance/historical-date";
import {
  comparableProductionDate,
  draftFromEdtf,
  draftFromProductionDate,
  EMPTY_PRODUCTION_DATE_DRAFT,
  edtfFromDraft,
  hasOpenQualifierInRange,
  type ProductionDateDraft,
  productionDateDraftSchema,
  productionDateFromDraft,
} from "./production-date-draft";

function year(
  value: string,
  patch: Partial<PartialDateDraft> = {},
): PartialDateDraft {
  return { ...EMPTY_PARTIAL_DATE, precision: "year", year: value, ...patch };
}

function draftOf(
  from: PartialDateDraft,
  to: PartialDateDraft = EMPTY_PARTIAL_DATE,
): ProductionDateDraft {
  return { from, to };
}

describe("dates read from text become From and To", () => {
  test.each([
    "1850",
    "c. 1850",
    "circa 1850?",
    "1850?",
    "1850s",
    "1850-1860",
    "c. 1850-1860",
    "before 1900",
    "after 1850",
    "500 BC",
    "500-400 BC",
    "AD 79",
    "12 May 1850",
    "May 1850",
    "late 19th century",
    "hacia 1850",
    "avant 1900",
    "1850-årene",
    "500 î.Hr.",
  ])("%j saves as the EDTF it reads as", (text) => {
    const reading = readDateText(text);
    if (!reading) throw new Error(`${text} is not read`);
    const draft = draftFromProductionDate(reading);
    expect(draft.fixedEdtf).toBeUndefined();
    expect(edtfFromDraft(draft)).toBe(formatEdtf(reading));
  });

  test.each([
    ["19th century", "1800/1899"],
    ["1800s", "1800/1899"],
    ["siglo XIX", "1800/1899"],
    ["5th century BC", "-0499/-0400"],
  ])("%j becomes the century's first and last year", (text, edtf) => {
    const reading = readDateText(text);
    if (!reading) throw new Error(`${text} is not read`);
    const draft = draftFromProductionDate(reading);
    expect(edtfFromDraft(draft)).toBe(edtf);
    const saved = parseEdtf(edtf);
    expect(saved && productionYears(saved)).toEqual(productionYears(reading));
  });
});

describe("From alone, To alone and a range", () => {
  test("From alone is one date, By and After leave a side open", () => {
    expect(edtfFromDraft(draftOf(year("1850")))).toBe("1850");
    expect(edtfFromDraft(draftOf(year("1850", { qualifier: "circa" })))).toBe(
      "1850~",
    );
    expect(
      edtfFromDraft(
        draftOf(year("1850", { qualifier: "circa", uncertain: true })),
      ),
    ).toBe("1850%");
    expect(
      edtfFromDraft(draftOf(year("1900", { qualifier: "notAfter" }))),
    ).toBe("../1900");
    expect(
      edtfFromDraft(draftOf(year("1850", { qualifier: "notBefore" }))),
    ).toBe("1850/..");
  });

  test("To alone has no start, and a range keeps each side's qualifier", () => {
    expect(edtfFromDraft(draftOf(EMPTY_PARTIAL_DATE, year("1900")))).toBe(
      "../1900",
    );
    expect(
      edtfFromDraft(
        draftOf(
          year("1850", { qualifier: "circa" }),
          year("1860", { uncertain: true }),
        ),
      ),
    ).toBe("1850~/1860?");
  });

  test("open dates read back as staff entered them", () => {
    expect(draftFromEdtf("../1900").from).toMatchObject({
      year: "1900",
      qualifier: "notAfter",
    });
    expect(draftFromEdtf("1850/..").from).toMatchObject({
      year: "1850",
      qualifier: "notBefore",
    });
    const circaEnd = draftFromEdtf("../1900~");
    expect(circaEnd.from.precision).toBe("none");
    expect(circaEnd.to).toMatchObject({ year: "1900", qualifier: "circa" });
    expect(edtfFromDraft(circaEnd)).toBe("../1900~");
  });

  test("By or After in a range is refused with its own reason", () => {
    const draft = draftOf(
      year("1850", { qualifier: "notAfter" }),
      year("1860"),
    );
    expect(edtfFromDraft(draft)).toBeNull();
    expect(hasOpenQualifierInRange(draft)).toBe(true);
    expect(hasOpenQualifierInRange(draftOf(year("1850"), year("1860")))).toBe(
      false,
    );
  });
});

describe("years before Christ", () => {
  test("a BC year saves astronomical and reads back with its era", () => {
    expect(edtfFromDraft(draftOf(year("500", { era: "bc" })))).toBe("-0499");
    expect(edtfFromDraft(draftOf(year("1", { era: "bc" })))).toBe("0000");
    expect(draftFromEdtf("-0499").from).toMatchObject({
      precision: "year",
      year: "500",
      era: "bc",
    });
  });

  test("the era applies only to a year", () => {
    expect(
      edtfFromDraft(
        draftOf({
          ...EMPTY_PARTIAL_DATE,
          precision: "decade",
          year: "1850",
          era: "bc",
        }),
      ),
    ).toBe("185X");
  });

  test("dates the fields cannot show stay fixed EDTF until cleared", () => {
    for (const edtf of ["-185X", "-0499-03-15", "18XX~", "1850~/.."]) {
      const draft = draftFromEdtf(edtf);
      expect(draft.fixedEdtf).toBe(edtf);
      expect(edtfFromDraft(draft)).toBe(edtf);
    }
  });
});

describe("incomplete and impossible dates", () => {
  test("a missing part, a day the calendar lacks or a reversed range is refused", () => {
    for (const draft of [
      draftOf(year("")),
      draftOf(year("18.5")),
      draftOf({
        ...EMPTY_PARTIAL_DATE,
        precision: "day",
        year: "1850",
        month: "2",
        day: "30",
      }),
      draftOf(year("1860"), year("1850")),
      { ...EMPTY_PRODUCTION_DATE_DRAFT, fixedEdtf: "not EDTF" },
    ]) {
      expect(edtfFromDraft(draft)).toBeNull();
    }
  });

  test("a range that ends before it starts within a month, or before a circa start, is refused", () => {
    const mayDay = (day: string): PartialDateDraft => ({
      ...EMPTY_PARTIAL_DATE,
      precision: "day",
      year: "1850",
      month: "5",
      day,
    });
    const reversed = draftOf(mayDay("12"), mayDay("1"));
    expect(productionDateFromDraft(reversed)).toBeNull();
    expect(edtfFromDraft(reversed)).toBeNull();
    expect(
      edtfFromDraft(
        draftOf(year("1850", { qualifier: "circa" }), year("1849")),
      ),
    ).toBeNull();
    expect(edtfFromDraft(draftOf(mayDay("1"), mayDay("12")))).toBe(
      "1850-05-01/1850-05-12",
    );
  });

  test("hidden parts are no date, and partial input is a change", () => {
    expect(edtfFromDraft(undefined)).toBeUndefined();
    const hidden = draftOf({
      ...EMPTY_PARTIAL_DATE,
      year: "1850",
      qualifier: "circa",
    });
    expect(comparableProductionDate(hidden)).toBe("");
    expect(comparableProductionDate(undefined)).toBe("");
    expect(comparableProductionDate(draftOf(year(" 1850 ")))).toBe("1850");
    const month = (value: string) =>
      draftOf({
        ...EMPTY_PARTIAL_DATE,
        precision: "month",
        year: "1850",
        month: value,
      });
    expect(comparableProductionDate(month(""))).not.toBe("");
    expect(comparableProductionDate(month(""))).not.toEqual(
      comparableProductionDate(month("13")),
    );
  });

  test("a structured date kept on a device reads back", () => {
    const draft = draftFromEdtf("1850~/1860");
    expect(productionDateDraftSchema.parse(draft)).toEqual(draft);
    expect(
      productionDateDraftSchema.safeParse({ from: "1850", to: "" }).success,
    ).toBe(false);
  });
});
