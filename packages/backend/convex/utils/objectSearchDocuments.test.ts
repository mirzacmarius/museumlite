import { describe, expect, test } from "vitest";
import type { Doc, Id } from "../_generated/dataModel";
import {
  composeObjectSearchDocument,
  matchedObjectSearchField,
  OBJECT_SEARCH_DOCUMENT_VERSION,
  searchQueryTerms,
  searchTokens,
} from "./objectSearchDocuments";
import { UNDATED_SORT_EARLIEST, UNDATED_SORT_LATEST } from "./productionDates";

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

  test("a subject term is searched and reported as the subject, ahead of tags", () => {
    const portrait = {
      accessionNumber: "P-2",
      title: "Portrait",
      subjects: ["Harbour pilots"],
      tags: ["Harbour"],
    } as Doc<"collections">;

    expect(matchedObjectSearchField(portrait, "pilots")).toBe("subjects");
    expect(matchedObjectSearchField(portrait, "harbour")).toBe("subjects");
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

describe("date made sort keys", () => {
  function documentOf(fields: Partial<Doc<"collections">>) {
    return composeObjectSearchDocument(
      {
        _id: "collection" as Id<"collections">,
        _creationTime: 1,
        organizationId: "organization" as Id<"organizations">,
        accessionNumber: "1",
        title: "Jug",
        status: "active",
        catalogedBy: "user" as Id<"users">,
        catalogedAt: 1,
        ...fields,
      },
      false,
    );
  }

  test("a document holds the years of the date in effect, written at version 4", () => {
    expect(OBJECT_SEARCH_DOCUMENT_VERSION).toBe(4);
    expect(documentOf({ dateCreated: "c. 1850" })).toMatchObject({
      madeSortEarliest: 1845,
      madeSortLatest: 1855,
      version: 4,
    });
    expect(documentOf({ dateCreated: "500 BC" })).toMatchObject({
      madeSortEarliest: -499,
      madeSortLatest: -499,
    });
    // The structured date wins; an open start sorts by its end both ways.
    expect(
      documentOf({ dateCreated: "1850", dateCreatedEdtf: "../1900" }),
    ).toMatchObject({ madeSortEarliest: 1900, madeSortLatest: 1900 });
  });

  test("an undated Object sorts last both ways", () => {
    for (const fields of [{}, { dateCreated: "Ming dynasty" }]) {
      expect(documentOf(fields)).toMatchObject({
        madeSortEarliest: UNDATED_SORT_EARLIEST,
        madeSortLatest: UNDATED_SORT_LATEST,
      });
    }
  });
});
