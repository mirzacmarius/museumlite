import { describe, expect, test } from "vitest";
import type { Doc } from "../_generated/dataModel";
import {
  matchedObjectSearchField,
  searchQueryTerms,
  searchTokens,
} from "./objectSearchDocuments";

describe("search words", () => {
  test("words are split and lower-cased as the search index splits them", () => {
    expect(searchQueryTerms("Fishing-boat, Oslo")).toEqual([
      "fishing",
      "boat",
      "oslo",
    ]);
  });

  test("words of 32 UTF-8 bytes or more are left out, as the index leaves them out", () => {
    expect(searchTokens(`amphora ${"a".repeat(32)}`)).toEqual(["amphora"]);
    expect(searchTokens("a".repeat(31))).toEqual(["a".repeat(31)]);
    // 32 characters, 33 bytes.
    expect(searchTokens("sølvsmedarbeidsverkstedsutstyret amfora")).toEqual([
      "amfora",
    ]);
    // 12 characters, 36 bytes.
    expect(searchTokens("東京国立博物館所蔵品目録 vase")).toEqual(["vase"]);
    // 10 characters, 30 bytes.
    expect(searchTokens("東京国立博物館所蔵品")).toEqual([
      "東京国立博物館所蔵品",
    ]);
  });

  test("only the first 16 words of a search count, so the 16th is the one matched as a prefix", () => {
    const words = Array.from({ length: 18 }, (_, index) => `w${index + 1}`);
    expect(searchQueryTerms(words.join(" "))).toEqual(words.slice(0, 16));
  });

  test("a word too long to index is not found by its beginning", () => {
    const poster = {
      accessionNumber: "P-1",
      title: "Poster",
      description: "Plakat der Donaudampfschifffahrtsgesellschaft",
    } as Doc<"collections">;

    expect(matchedObjectSearchField(poster, "donau")).toBeUndefined();
    expect(matchedObjectSearchField(poster, "plak")).toBe("description");
  });
});
