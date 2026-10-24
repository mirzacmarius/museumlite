import { narrowsCatalog } from "@v1/backend/convex/utils/catalogFilterValidators";
import { afterEach, expect, test, vi } from "vitest";
import {
  catalogFilters,
  localDayBound,
  madeYearBound,
} from "./use-collection-catalog-list";

type UrlFilters = Parameters<typeof catalogFilters>[0];

const NO_FILTERS: UrlFilters = {
  search: "",
  status: "any",
  inventoryScope: "",
  objectType: "",
  displayStatus: "",
  culture: "",
  period: "",
  materials: "",
  condition: "",
  photograph: "",
  collectionGroupId: "",
  locationIds: [],
  catalogedFrom: "",
  catalogedTo: "",
  madeFrom: "",
  madeTo: "",
  advancedFilters: [],
  filterCombinations: "AND",
};

afterEach(() => {
  vi.unstubAllEnvs();
});

test("a cataloguing range covers the whole local days picked, west of UTC too", () => {
  vi.stubEnv("TZ", "America/New_York");

  expect(
    new Date(localDayBound("2026-03-01", "start") ?? 0).toString(),
  ).toMatch(/^Sun Mar 01 2026 00:00:00/);
  expect(localDayBound("2026-03-01", "end")).toBe(
    Date.parse("2026-03-02T04:59:59.999Z"),
  );
});

test("an empty or partial date sets no bound", () => {
  expect(localDayBound("", "start")).toBeUndefined();
  expect(localDayBound("2026-03", "end")).toBeUndefined();
});

test("a date made bound turns a year as written into the astronomical year", () => {
  expect(madeYearBound("1850")).toBe(1850);
  expect(madeYearBound("1")).toBe(1);
  expect(madeYearBound("-1")).toBe(0);
  expect(madeYearBound("-500")).toBe(-499);
  expect(madeYearBound("-9999")).toBe(-9998);
});

test("a date made bound is unset unless the URL holds a year from 1 to 9999 either side", () => {
  for (const value of ["", "0", "-0", "10000", "1850.5", "c. 1850", "+5"]) {
    expect(madeYearBound(value), value).toBeUndefined();
  }
});

test("Edit all matching objects needs a search or filter, not just a Dashboard link or All statuses", () => {
  const offersEditAll = (filters: Partial<UrlFilters>) =>
    narrowsCatalog(catalogFilters({ ...NO_FILTERS, ...filters }));

  const everyObject: Partial<UrlFilters>[] = [
    {},
    { inventoryScope: "owned" },
    { status: "all" },
    { status: "deaccessioned" },
    { search: "   " },
    { culture: " " },
    { advancedFilters: [{ operator: "AND", filters: [] }] },
    {
      advancedFilters: [
        {
          operator: "AND",
          filters: [{ field: "title", operator: "ne", value: " " }],
        },
      ],
    },
  ];
  for (const filters of everyObject) {
    expect(offersEditAll(filters), JSON.stringify(filters)).toBe(false);
  }

  const narrowed: Partial<UrlFilters>[] = [
    { search: "bowl" },
    { status: "active" },
    { objectType: "Painting" },
    { inventoryScope: "owned", displayStatus: "not_on_display" },
    { culture: "Roman" },
    { photograph: "without" },
    { collectionGroupId: "group" },
    { locationIds: ["location"] },
    { catalogedFrom: "2026-03-01" },
    { madeTo: "-500" },
    {
      advancedFilters: [
        {
          operator: "AND",
          filters: [{ field: "title", operator: "contains", value: "bowl" }],
        },
      ],
    },
  ];
  for (const filters of narrowed) {
    expect(offersEditAll(filters), JSON.stringify(filters)).toBe(true);
  }
});
