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
    "",
    "1850-13",
    "1850-02-30",
    "1900-02-29",
    "185X-05",
    "1850-1860",
    "1850/1840",
    "../..",
    "1850/1860/1870",
    "18",
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
    "0 BC",
    "sometime",
  ])("%j is not read as a date", (text) => {
    expect(edtfOf(text)).toBeNull();
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
