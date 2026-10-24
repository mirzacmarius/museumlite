import { expect, test } from "vitest";
import {
  EMPTY_MEASUREMENT_SET_ENTRY,
  filledMeasurementSetEntries,
  measurementSetEntry,
  measurementSetEntryProblem,
  measurementSetsFromEntries,
  measurementSetsProblem,
} from "./measurement-sets";

const row = EMPTY_MEASUREMENT_SET_ENTRY;

test("a stored set opens as text in its row", () => {
  expect(
    measurementSetEntry({
      part: "framed",
      height: 60,
      width: 40.5,
      unit: "cm",
    }),
  ).toEqual({
    ...row,
    part: "framed",
    height: "60",
    width: "40.5",
    unit: "cm",
  });
});

test("an added row left blank is not counted or saved", () => {
  const entries = [{ ...row, localId: "row-1" }];
  expect(filledMeasurementSetEntries(entries)).toEqual([]);
  expect(measurementSetEntryProblem(entries[0] ?? row)).toBeNull();
  expect(measurementSetsProblem(entries)).toBeNull();
  expect(measurementSetsFromEntries(entries)).toEqual([]);
});

test("a row saves with typed numbers, a decimal comma and trimmed text", () => {
  expect(
    measurementSetsFromEntries([
      {
        ...row,
        localId: "row-1",
        part: "other",
        partNote: " lid ",
        diameter: "8,5",
        unit: " cm ",
        weight: "200",
        weightUnit: "g",
      },
    ]),
  ).toEqual([
    {
      part: "other",
      partNote: "lid",
      diameter: 8.5,
      unit: "cm",
      weight: 200,
      weightUnit: "g",
    },
  ]);
});

test("a row needs a part, then at least one value above 0", () => {
  expect(measurementSetEntryProblem({ ...row, height: "10" })).toBe(
    "partRequired",
  );
  expect(measurementSetEntryProblem({ ...row, part: "base" })).toBe("invalid");
  expect(
    measurementSetEntryProblem({ ...row, part: "base", height: "0" }),
  ).toBe("invalid");
  expect(
    measurementSetEntryProblem({ ...row, part: "base", height: "ten" }),
  ).toBe("invalid");
  expect(
    measurementSetEntryProblem({
      ...row,
      part: "base",
      height: "10",
      partNote: "a".repeat(201),
    }),
  ).toBe("invalid");
  expect(
    measurementSetEntryProblem({ ...row, part: "base", height: "10" }),
  ).toBeNull();
});

test("the list names a missing part first and holds at most 20 parts", () => {
  expect(
    measurementSetsProblem([
      { ...row, part: "base", height: "0" },
      { ...row, width: "4" },
    ]),
  ).toBe("partRequired");
  const filled = { ...row, part: "base" as const, height: "1" };
  expect(measurementSetsProblem(Array.from({ length: 20 }, () => filled))).toBe(
    null,
  );
  expect(measurementSetsProblem(Array.from({ length: 21 }, () => filled))).toBe(
    "invalid",
  );
});
