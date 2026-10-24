import { describe, expect, test } from "vitest";
import { searchQueryTerms } from "./objectSearchDocuments";

describe("search query terms", () => {
  test("words are split and lower-cased as the search index splits them", () => {
    expect(searchQueryTerms("Fishing-boat, Oslo")).toEqual([
      "fishing",
      "boat",
      "oslo",
    ]);
  });

  test("words longer than the search index reads are left out", () => {
    expect(searchQueryTerms(`amphora ${"a".repeat(33)}`)).toEqual(["amphora"]);
    expect(searchQueryTerms("a".repeat(32))).toEqual(["a".repeat(32)]);
  });

  test("only the first 16 words count, so the 16th is the one matched as a prefix", () => {
    const words = Array.from({ length: 18 }, (_, index) => `w${index + 1}`);
    expect(searchQueryTerms(words.join(" "))).toEqual(words.slice(0, 16));
  });
});
