import { parseEdtf } from "@v1/backend/convex/utils/productionDates";
import { expect, test } from "vitest";
import {
  formatDateMade,
  formatProductionDate,
  formatProductionYear,
  type ProductionDateLabels,
} from "./production-date-format";

const labels: ProductionDateLabels = {
  decade: (year) => `${year}s`,
  circa: (date) => `c. ${date}`,
  notAfter: (date) => `by ${date}`,
  notBefore: (date) => `after ${date}`,
  uncertain: (date) => `${date}?`,
  range: (start, end) => `${start} – ${end}`,
};

function formatted(edtf: string, locale: "en" | "es" | "no" = "en") {
  const date = parseEdtf(edtf);
  if (!date) throw new Error(`${edtf} is not EDTF`);
  return formatProductionDate(date, locale, labels);
}

test("years before 1 AD name their era in the app language", () => {
  expect(formatProductionYear(1850, "en")).toBe("1850");
  expect(formatProductionYear(-499, "en")).toBe("500 BC");
  expect(formatProductionYear(0, "en")).toBe("1 BC");
  expect(formatProductionYear(-499, "es")).toBe("500 a. C.");
  expect(formatProductionYear(-499, "no")).toBe("500 f.Kr.");
});

test("a structured date shows only the precision it states", () => {
  expect(formatted("1850-05-12")).toBe("May 12, 1850");
  expect(formatted("1850-05")).toBe("May 1850");
  expect(formatted("1850")).toBe("1850");
  expect(formatted("185X")).toBe("1850s");
  expect(formatted("18XX")).toBe("1800 – 1899");
  expect(formatted("-0499")).toBe("500 BC");
  expect(formatted("-0499-03-15")).toBe("March 15, 500 BC");
  expect(formatted("-04XX")).toBe("500 BC – 401 BC");
});

test("qualified and open dates read as staff write them", () => {
  expect(formatted("1850~")).toBe("c. 1850");
  expect(formatted("1850%")).toBe("c. 1850?");
  expect(formatted("1850/1860")).toBe("1850 – 1860");
  expect(formatted("../1900")).toBe("by 1900");
  expect(formatted("1850/..")).toBe("after 1850");
});

test("the date made is the text as written, else the structured date", () => {
  expect(
    formatDateMade(
      { dateCreated: "Ming dynasty", dateCreatedEdtf: "1368/1644" },
      "en",
      labels,
    ),
  ).toBe("Ming dynasty");
  expect(
    formatDateMade(
      { dateCreated: " ", dateCreatedEdtf: "1850~" },
      "en",
      labels,
    ),
  ).toBe("c. 1850");
  expect(formatDateMade({}, "en", labels)).toBeUndefined();
  expect(
    formatDateMade({ dateCreatedEdtf: "not a date" }, "en", labels),
  ).toBeUndefined();
});
