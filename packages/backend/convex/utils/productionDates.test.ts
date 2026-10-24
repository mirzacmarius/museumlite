import { describe, expect, test } from "vitest";
import {
  effectiveProductionDate,
  formatEdtf,
  overlapsYears,
  parseEdtf,
  productionDateSummary,
  productionSortKeys,
  productionYears,
  readDateText,
  UNDATED_SORT_EARLIEST,
  UNDATED_SORT_LATEST,
} from "./productionDates";

function edtfOf(text: string) {
  const date = readDateText(text);
  return date ? formatEdtf(date) : null;
}

describe("EDTF", () => {
  test.each([
    "1850",
    "1850-05",
    "1850-05-12",
    "185X",
    "18XX",
    "-0499",
    "-04XX",
    "0000",
    "0079",
    "1850~",
    "1850?",
    "1850%",
    "1850-05-12~",
    "1850/1860",
    "1850~/1860?",
    "../1900",
    "1850/..",
    "18XX/19XX",
  ])("%s reads and writes back unchanged", (text) => {
    const date = parseEdtf(text);
    expect(date).not.toBeNull();
    if (date) expect(formatEdtf(date)).toBe(text);
  });

  test("an empty open side is the same as ..", () => {
    expect(formatEdtf(parseEdtf("/1900") ?? fail())).toBe("../1900");
    expect(formatEdtf(parseEdtf("1850/") ?? fail())).toBe("1850/..");
  });

  test.each([
    ["1850-XX", "1850"],
    ["1850-XX-XX", "1850"],
    ["1850-05-XX", "1850-05"],
    ["1850-XX?", "1850?"],
    ["1850-XX-XX%", "1850%"],
    ["1850-05-XX~", "1850-05~"],
    ["-1850-XX", "-1850"],
  ])("an unspecified month or day: %s states %s", (text, edtf) => {
    expect(formatEdtf(parseEdtf(text) ?? fail())).toBe(edtf);
  });

  test.each([
    "185X/1850",
    "1855/185X",
    "18XX/1850",
    "1850/1850-05",
  ])("%s has sides that overlap, which is still an interval", (text) => {
    expect(formatEdtf(parseEdtf(text) ?? fail())).toBe(text);
  });

  test.each([
    "",
    "1850-13",
    "1850-02-30",
    "1900-02-29",
    "185X-05",
    "1850-1860",
    "1850/1840",
    // Ends before it starts, to the day and without the circa margin.
    "1850-06/1850-05",
    "1850-05-12/1850-05-01",
    "1850-05/1850-03",
    "1860~/1858",
    "1850~/1849",
    "../..",
    "1850/1860/1870",
    "18",
    // EDTF left out: a fully unspecified year, other unspecified digits,
    // seasons and times.
    "XXXX",
    "185X-XX",
    "1850-XX-12",
    "2001-21",
    "1985-04-12T10:00:00",
    "Ming dynasty",
    `1850${"~".repeat(64)}`,
  ])("%j is not EDTF", (text) => {
    expect(parseEdtf(text)).toBeNull();
  });

  test("a leap day is a real date only in a leap year", () => {
    expect(parseEdtf("2000-02-29")).not.toBeNull();
    expect(parseEdtf("1904-02-29")).not.toBeNull();
    expect(parseEdtf("1900-02-29")).toBeNull();
  });
});

describe("years a date spans", () => {
  test.each([
    ["1850", 1850, 1850],
    ["1850-05-12", 1850, 1850],
    ["185X", 1850, 1859],
    ["18XX", 1800, 1899],
    ["-0499", -499, -499],
    ["-185X", -1859, -1850],
    ["-04XX", -499, -400],
    ["1850~", 1845, 1855],
    ["185X~", 1840, 1869],
    ["18XX~", 1775, 1924],
    ["1850?", 1850, 1850],
    ["1850/1860", 1850, 1860],
    ["185X/18XX", 1850, 1899],
  ])("%s spans %i to %i", (text, earliest, latest) => {
    expect(productionYears(parseEdtf(text) ?? fail())).toEqual({
      earliestYear: earliest,
      latestYear: latest,
    });
  });

  test("an open side has no year", () => {
    expect(productionYears(parseEdtf("../1900") ?? fail())).toEqual({
      earliestYear: undefined,
      latestYear: 1900,
    });
    expect(productionYears(parseEdtf("1850/..") ?? fail())).toEqual({
      earliestYear: 1850,
      latestYear: undefined,
    });
  });

  test("sort keys put undated Objects last and use the other side of an open date", () => {
    expect(
      productionSortKeys({ earliestYear: 1850, latestYear: 1860 }),
    ).toEqual({ sortEarliest: 1850, sortLatest: 1860 });
    expect(productionSortKeys({ latestYear: 1900 })).toEqual({
      sortEarliest: 1900,
      sortLatest: 1900,
    });
    expect(productionSortKeys(null)).toEqual({
      sortEarliest: UNDATED_SORT_EARLIEST,
      sortLatest: UNDATED_SORT_LATEST,
    });
  });

  test("a range filter keeps dates whose years meet it, open sides always meeting", () => {
    const years = { earliestYear: 1850, latestYear: 1860 };
    expect(overlapsYears(years, 1855, 1900)).toBe(true);
    expect(overlapsYears(years, 1860, undefined)).toBe(true);
    expect(overlapsYears(years, undefined, 1850)).toBe(true);
    expect(overlapsYears(years, 1861, undefined)).toBe(false);
    expect(overlapsYears(years, undefined, 1849)).toBe(false);
    expect(overlapsYears({ latestYear: 1900 }, 1000, 1100)).toBe(true);
    expect(overlapsYears({ latestYear: 1900 }, 1901, undefined)).toBe(false);
  });
});

describe("dates written as text", () => {
  test.each([
    // English
    ["1850", "1850"],
    ["c. 1850", "1850~"],
    ["ca 1850", "1850~"],
    ["circa 1850?", "1850%"],
    ["1850?", "1850?"],
    ["[1850]", "1850"],
    ["1850s", "185X"],
    ["the 1850s", "185X"],
    ["1850-1860", "1850/1860"],
    ["1850 – 1860", "1850/1860"],
    ["1850-60", "1850/1860"],
    ["1850 to 1860", "1850/1860"],
    ["between 1850 and 1860", "1850/1860"],
    ["from 1850 to 1860", "1850/1860"],
    ["c. 1850-1860", "1850~/1860~"],
    ["19th century", "18XX"],
    ["late 19th century", "1866/1899"],
    ["mid-19th century", "1833/1866"],
    ["early 20th century", "1900/1933"],
    ["before 1900", "../1900"],
    ["after 1850", "1850/.."],
    ["500 BC", "-0499"],
    ["500-400 BC", "-0499/-0399"],
    ["5th century BC", "-04XX"],
    ["AD 79", "0079"],
    ["12 May 1850", "1850-05-12"],
    ["May 12, 1850", "1850-05-12"],
    ["May 1850", "1850-05"],
    ["12.05.1850", "1850-05-12"],
    ["1850/05/12", "1850-05-12"],
    ["1850-05-12", "1850-05-12"],
    // Spanish
    ["hacia 1850", "1850~"],
    ["siglo XIX", "18XX"],
    ["finales del siglo XIX", "1866/1899"],
    ["década de 1850", "185X"],
    ["entre 1850 y 1860", "1850/1860"],
    ["antes de 1900", "../1900"],
    ["12 de mayo de 1850", "1850-05-12"],
    ["500 a. C.", "-0499"],
    // French
    ["vers 1850", "1850~"],
    ["XIXe siècle", "18XX"],
    ["fin du XIXe siècle", "1866/1899"],
    ["années 1850", "185X"],
    ["avant 1900", "../1900"],
    ["12 mai 1850", "1850-05-12"],
    ["500 av. J.-C.", "-0499"],
    // Norwegian
    ["ca. 1850", "1850~"],
    ["1800-tallet", "18XX"],
    ["1900-tallet", "19XX"],
    ["slutten av 1800-tallet", "1866/1899"],
    ["1850-årene", "185X"],
    ["1850-tallet", "185X"],
    ["før 1900", "../1900"],
    ["12. mai 1850", "1850-05-12"],
    ["500 f.Kr.", "-0499"],
    // Romanian
    ["cca 1850", "1850~"],
    ["secolul al XIX-lea", "18XX"],
    ["sfârșitul secolului al XIX-lea", "1866/1899"],
    ["anii 1850", "185X"],
    ["înainte de 1900", "../1900"],
    ["500 î.Hr.", "-0499"],
  ])("%j reads as %s", (text, edtf) => {
    expect(edtfOf(text)).toBe(edtf);
  });

  test.each([
    "",
    "Ming dynasty",
    "unknown",
    "1850-1840",
    "30 February 1850",
    "May 1850 - March 1850",
    "sometime",
    "constructor 1850",
    "12 constructor 1850",
    // There is no year 0.
    "0 BC",
    "0",
    "00",
    "0 AD",
    "AD 0",
    "0 CE",
    "c. 0",
  ])("%j is not read as a date", (text) => {
    expect(edtfOf(text)).toBeNull();
  });

  test.each([
    ["1800s", "18XX"],
    ["the 1900s", "19XX"],
    ["1900's", "19XX"],
    ["c. 1800s", "18XX~"],
    ["1800s?", "18XX?"],
    ["1800s-1900s", "18XX/19XX"],
    ["1800-årene", "18XX"],
    ["800s", "08XX"],
    ["the 900s", "09XX"],
    ["1810s", "181X"],
    ["2000s", "200X"],
    ["the 2000s", "200X"],
    ["2000-årene", "200X"],
    ["années 1900", "190X"],
    ["década de 1900", "190X"],
    ["anii 1900", "190X"],
  ])('%j reads as %s: "1800s" is a century, "2000s" and "années 1900" a decade', (text, edtf) => {
    expect(edtfOf(text)).toBe(edtf);
  });

  test.each([
    ["before 19th century", "../1799"],
    ["before the 1850s", "../1849"],
    ["after 18th century", "1800/.."],
    ["after the 1850s", "1860/.."],
    ["after 5th century BC", "-0399/.."],
    ["before 5th century BC", "../-0500"],
    ["antes de siglo XIX", "../1799"],
    ["avant XIXe siècle", "../1799"],
    ["før 1800-tallet", "../1799"],
    ["etter 1850-årene", "1860/.."],
    ["înainte de secolul al XIX-lea", "../1799"],
    ["după secolul al XVIII-lea", "1800/.."],
    ["c. after the 1850s", "1860~/.."],
    // By and not before keep the span they name.
    ["by 19th century", "../18XX"],
    ["not after the 1850s", "../185X"],
    ["innen 1900", "../1900"],
    ["not before the 1850s", "185X/.."],
  ])("%j reads as %s: before and after leave out the decade or century, by and not before keep it", (text, edtf) => {
    expect(edtfOf(text)).toBe(edtf);
  });

  test("after the last decade there is no year to start from", () => {
    expect(edtfOf("after 9990s")).toBeNull();
  });

  test.each([
    ["1910-11", "1910/1911"],
    ["1905-10", "1905/1910"],
    ["1900-01", "1900/1901"],
    ["1910-11?", "1910?/1911?"],
    ["1850-05", "1850-05"],
    ["1850-05?", "1850-05?"],
    ["1912-12", "1912-12"],
  ])("%j reads as %s: a range when its end can be a later year, otherwise a month", (text, edtf) => {
    expect(edtfOf(text)).toBe(edtf);
    // As EDTF it stays a month.
    expect(formatEdtf(parseEdtf(text) ?? fail())).toBe(text);
  });

  test.each([
    ["100-50 BC", "-0099/-0049"],
    ["50-25 BC", "-0049/-0024"],
    ["500-400 BC", "-0499/-0399"],
    ["480-70 BC", null],
    ["450-25 BC", null],
    ["250-25 BC", null],
    ["1860-50 BC", null],
    ["c. 480-70 BC", null],
    ["480-70 a.C.", null],
    ["480-70 av. J.-C.", null],
  ])("%j reads as %s: a BC range that could be shorthand for a shorter one is not read", (text, edtf) => {
    expect(edtfOf(text)).toBe(edtf);
  });
});

describe("an Object's date in effect", () => {
  test("the EDTF staff entered wins over what the text reads as", () => {
    expect(
      effectiveProductionDate({
        dateCreated: "about 1850",
        dateCreatedEdtf: "1848/1852",
      }),
    ).toEqual(parseEdtf("1848/1852"));
  });

  test("without EDTF, or with EDTF that does not read, the text is read", () => {
    expect(productionDateSummary({ dateCreated: "1850s" })).toEqual({
      edtf: "185X",
      earliestYear: 1850,
      latestYear: 1859,
    });
    expect(
      productionDateSummary({ dateCreated: "1850", dateCreatedEdtf: "nope" }),
    ).toEqual({ edtf: "1850", earliestYear: 1850, latestYear: 1850 });
  });

  test("text that states no date leaves the Object undated", () => {
    expect(productionDateSummary({ dateCreated: "Ming dynasty" })).toBeNull();
    expect(productionDateSummary({})).toBeNull();
  });
});

function fail(): never {
  throw new Error("Expected a date");
}
