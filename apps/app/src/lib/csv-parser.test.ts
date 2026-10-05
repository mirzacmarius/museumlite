import { describe, expect, test } from "vitest";
import { parseCsvRecords, parseCsvTable, sha256Hex } from "./csv-parser";

describe("parseCsvRecords", () => {
  test("keeps quoted commas, doubled quotes and line breaks in one field", () => {
    const text =
      'number,notes\r\n"A-1","Gift, with ""provenance"" note"\n"A-2","Line one\nline two"\n';
    expect(parseCsvRecords(text)).toEqual([
      { rowNumber: 1, values: ["number", "notes"] },
      { rowNumber: 2, values: ["A-1", 'Gift, with "provenance" note'] },
      { rowNumber: 3, values: ["A-2", "Line one\nline two"] },
    ]);
  });

  test("reports source line numbers across blank lines and multi-line fields", () => {
    const text = 'h\n"multi\nline"\n\nlast';
    expect(parseCsvRecords(text).map((record) => record.rowNumber)).toEqual([
      1, 2, 5,
    ]);
  });

  test("strips a byte-order mark and rejects an unclosed quote", () => {
    expect(parseCsvRecords("﻿a,b")[0]?.values).toEqual(["a", "b"]);
    expect(() => parseCsvRecords('a\n"open')).toThrow("line 2");
  });
});

describe("parseCsvTable", () => {
  test("trims headers and values and rejects an empty file", () => {
    expect(parseCsvTable(" a , b \n 1 , 2 ")).toEqual({
      headers: ["a", "b"],
      records: [{ rowNumber: 2, values: ["1", "2"] }],
    });
    expect(() => parseCsvTable("\n\n")).toThrow("empty");
  });
});

test("sha256Hex returns a stable hex digest", async () => {
  expect(await sha256Hex("abc")).toBe(
    "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
  );
});
