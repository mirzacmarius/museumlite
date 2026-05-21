/**
 * Test file for Dublin Core Mapper
 *
 * Tests Dublin Core metadata conversion utilities for collection objects.
 *
 * Run with: `bun test utils/dublinCore.test.ts` (from packages/backend)
 */

import { describe, expect, test } from "vitest";
import type { Doc } from "../../convex/_generated/dataModel";
import {
  collectionsToDublinCore,
  type DublinCoreMetadata,
  fromDublinCore,
  toDublinCore,
  toDublinCoreXML,
} from "../../convex/utils/dublinCore";

describe("toDublinCore", () => {
  test("should convert basic collection to Dublin Core", () => {
    const collection: Partial<Doc<"collections">> = {
      title: "Test Artwork",
      accessionNumber: "2024.1.1",
      creator: "John Artist",
      description: "A beautiful painting",
    };

    const dc = toDublinCore(collection);

    expect(dc.title).toBe("Test Artwork");
    expect(dc.identifier).toBe("2024.1.1");
    expect(dc.creator).toBe("John Artist");
    expect(dc.description).toBe("A beautiful painting");
  });

  test("should handle missing title with Untitled", () => {
    const collection: Partial<Doc<"collections">> = {
      accessionNumber: "2024.1.1",
    };

    const dc = toDublinCore(collection);

    expect(dc.title).toBe("Untitled");
    expect(dc.identifier).toBe("2024.1.1");
  });

  test("should convert tags to subject", () => {
    const collection: Partial<Doc<"collections">> = {
      title: "Test",
      accessionNumber: "2024.1.1",
      tags: ["painting", "modern art", "abstract"],
    };

    const dc = toDublinCore(collection);

    expect(Array.isArray(dc.subject)).toBe(true);
    expect(dc.subject).toEqual(["painting", "modern art", "abstract"]);
  });

  test("should convert single tag to string subject", () => {
    const collection: Partial<Doc<"collections">> = {
      title: "Test",
      accessionNumber: "2024.1.1",
      tags: ["painting"],
    };

    const dc = toDublinCore(collection);

    expect(dc.subject).toBe("painting");
  });

  test("should convert donated_by to contributor", () => {
    const collection: Partial<Doc<"collections">> = {
      title: "Test",
      accessionNumber: "2024.1.1",
      donated_by: ["John Doe", "Jane Smith"],
    };

    const dc = toDublinCore(collection);

    expect(Array.isArray(dc.contributor)).toBe(true);
    expect(dc.contributor).toEqual(["John Doe", "Jane Smith"]);
  });

  test("should convert single donor to string contributor", () => {
    const collection: Partial<Doc<"collections">> = {
      title: "Test",
      accessionNumber: "2024.1.1",
      donated_by: ["John Doe"],
    };

    const dc = toDublinCore(collection);

    expect(dc.contributor).toBe("John Doe");
  });

  test("should combine materials, technique, and dimensions into format", () => {
    const collection: Partial<Doc<"collections">> = {
      title: "Test",
      accessionNumber: "2024.1.1",
      materials: "Oil on canvas",
      technique: "Impressionist",
      dimensions: "100 x 80 cm",
    };

    const dc = toDublinCore(collection);

    expect(dc.format).toBe("Oil on canvas; Impressionist; 100 x 80 cm");
  });

  test("should handle partial format fields", () => {
    const collection: Partial<Doc<"collections">> = {
      title: "Test",
      accessionNumber: "2024.1.1",
      materials: "Bronze",
    };

    const dc = toDublinCore(collection);

    expect(dc.format).toBe("Bronze");
  });

  test("should combine culture and period into coverage", () => {
    const collection: Partial<Doc<"collections">> = {
      title: "Test",
      accessionNumber: "2024.1.1",
      culture: "Roman",
      period: "2nd Century CE",
    };

    const dc = toDublinCore(collection);

    expect(dc.coverage).toBe("Roman; 2nd Century CE");
  });

  test("should convert links to relation", () => {
    const collection: Partial<Doc<"collections">> = {
      title: "Test",
      accessionNumber: "2024.1.1",
      links: [
        { url: "http://example.com/1" },
        { url: "http://example.com/2", label: "Reference" },
      ],
    };

    const dc = toDublinCore(collection);

    expect(Array.isArray(dc.relation)).toBe(true);
    expect(dc.relation).toEqual([
      "http://example.com/1",
      "http://example.com/2",
    ]);
  });

  test("should convert single link to string relation", () => {
    const collection: Partial<Doc<"collections">> = {
      title: "Test",
      accessionNumber: "2024.1.1",
      links: [{ url: "http://example.com" }],
    };

    const dc = toDublinCore(collection);

    expect(dc.relation).toBe("http://example.com");
  });

  test("should combine creditLine and legalRestrictions into rights", () => {
    const collection: Partial<Doc<"collections">> = {
      title: "Test",
      accessionNumber: "2024.1.1",
      creditLine: "Gift of John Doe, 1990",
      legalRestrictions: true,
    };

    const dc = toDublinCore(collection);

    expect(dc.rights).toBe("Gift of John Doe, 1990; Legal restrictions apply");
  });

  test("should handle legal restrictions without credit line", () => {
    const collection: Partial<Doc<"collections">> = {
      title: "Test",
      accessionNumber: "2024.1.1",
      legalRestrictions: true,
    };

    const dc = toDublinCore(collection);

    expect(dc.rights).toBe("Legal restrictions apply");
  });

  test("should include organization name as publisher", () => {
    const collection: Partial<Doc<"collections">> = {
      title: "Test",
      accessionNumber: "2024.1.1",
    };

    const dc = toDublinCore(collection, {
      organizationName: "Test Museum",
    });

    expect(dc.publisher).toBe("Test Museum");
  });

  test("should include alternate identifiers when requested", () => {
    const collection: Partial<Doc<"collections">> = {
      title: "Test",
      accessionNumber: "2024.1.1",
      alternateAccessionNumbers: ["OLD-123", "REF-456"],
    };

    const dc = toDublinCore(collection, {
      includeAlternateIdentifiers: true,
    });

    expect(dc.identifier).toBe("2024.1.1; OLD-123; REF-456");
  });

  test("should include language when specified", () => {
    const collection: Partial<Doc<"collections">> = {
      title: "Test",
      accessionNumber: "2024.1.1",
    };

    const dc = toDublinCore(collection, {
      language: "en",
    });

    expect(dc.language).toBe("en");
  });

  test("should map objectType and objectName to type", () => {
    const collection1: Partial<Doc<"collections">> = {
      title: "Test",
      accessionNumber: "2024.1.1",
      objectType: "Painting",
    };

    const collection2: Partial<Doc<"collections">> = {
      title: "Test",
      accessionNumber: "2024.1.2",
      objectName: "Portrait",
    };

    const dc1 = toDublinCore(collection1);
    const dc2 = toDublinCore(collection2);

    expect(dc1.type).toBe("Painting");
    expect(dc2.type).toBe("Portrait");
  });

  test("should map dateCreated to date", () => {
    const collection: Partial<Doc<"collections">> = {
      title: "Test",
      accessionNumber: "2024.1.1",
      dateCreated: "1890",
    };

    const dc = toDublinCore(collection);

    expect(dc.date).toBe("1890");
  });

  test("should map provenance to source", () => {
    const collection: Partial<Doc<"collections">> = {
      title: "Test",
      accessionNumber: "2024.1.1",
      provenance: "Previously owned by Lord Carnarvon",
    };

    const dc = toDublinCore(collection);

    expect(dc.source).toBe("Previously owned by Lord Carnarvon");
  });
});

describe("fromDublinCore", () => {
  test("should convert basic Dublin Core to collection", () => {
    const metadata: DublinCoreMetadata = {
      title: "Test Artwork",
      identifier: "2024.1.1",
      creator: "John Artist",
      description: "A beautiful painting",
    };

    const collection = fromDublinCore(metadata);

    expect(collection.title).toBe("Test Artwork");
    expect(collection.accessionNumber).toBe("2024.1.1");
    expect(collection.creator).toBe("John Artist");
    expect(collection.description).toBe("A beautiful painting");
  });

  test("should convert subject array to tags", () => {
    const metadata: DublinCoreMetadata = {
      title: "Test",
      identifier: "2024.1.1",
      subject: ["painting", "modern art"],
    };

    const collection = fromDublinCore(metadata);

    expect(collection.tags).toEqual(["painting", "modern art"]);
  });

  test("should convert subject string to tags array", () => {
    const metadata: DublinCoreMetadata = {
      title: "Test",
      identifier: "2024.1.1",
      subject: "painting",
    };

    const collection = fromDublinCore(metadata);

    expect(collection.tags).toEqual(["painting"]);
  });

  test("should convert contributor array to donated_by", () => {
    const metadata: DublinCoreMetadata = {
      title: "Test",
      identifier: "2024.1.1",
      contributor: ["John Doe", "Jane Smith"],
    };

    const collection = fromDublinCore(metadata);

    expect(collection.donated_by).toEqual(["John Doe", "Jane Smith"]);
  });

  test("should convert contributor string to donated_by array", () => {
    const metadata: DublinCoreMetadata = {
      title: "Test",
      identifier: "2024.1.1",
      contributor: "John Doe",
    };

    const collection = fromDublinCore(metadata);

    expect(collection.donated_by).toEqual(["John Doe"]);
  });

  test("should split format into materials, technique, dimensions", () => {
    const metadata: DublinCoreMetadata = {
      title: "Test",
      identifier: "2024.1.1",
      format: "Oil on canvas; Impressionist; 100 x 80 cm",
    };

    const collection = fromDublinCore(metadata);

    expect(collection.materials).toBe("Oil on canvas");
    expect(collection.technique).toBe("Impressionist");
    expect(collection.dimensions).toBe("100 x 80 cm");
  });

  test("should handle partial format fields", () => {
    const metadata: DublinCoreMetadata = {
      title: "Test",
      identifier: "2024.1.1",
      format: "Bronze",
    };

    const collection = fromDublinCore(metadata);

    expect(collection.materials).toBe("Bronze");
    expect(collection.technique).toBeUndefined();
    expect(collection.dimensions).toBeUndefined();
  });

  test("should split coverage into culture and period", () => {
    const metadata: DublinCoreMetadata = {
      title: "Test",
      identifier: "2024.1.1",
      coverage: "Roman; 2nd Century CE",
    };

    const collection = fromDublinCore(metadata);

    expect(collection.culture).toBe("Roman");
    expect(collection.period).toBe("2nd Century CE");
  });

  test("should convert relation array to links", () => {
    const metadata: DublinCoreMetadata = {
      title: "Test",
      identifier: "2024.1.1",
      relation: ["http://example.com/1", "http://example.com/2"],
    };

    const collection = fromDublinCore(metadata);

    expect(collection.links).toEqual([
      { url: "http://example.com/1" },
      { url: "http://example.com/2" },
    ]);
  });

  test("should convert relation string to links array", () => {
    const metadata: DublinCoreMetadata = {
      title: "Test",
      identifier: "2024.1.1",
      relation: "http://example.com",
    };

    const collection = fromDublinCore(metadata);

    expect(collection.links).toEqual([{ url: "http://example.com" }]);
  });

  test("should split identifier into primary and alternate accession numbers", () => {
    const metadata: DublinCoreMetadata = {
      title: "Test",
      identifier: "2024.1.1; OLD-123; REF-456",
    };

    const collection = fromDublinCore(metadata);

    expect(collection.accessionNumber).toBe("2024.1.1");
    expect(collection.alternateAccessionNumbers).toEqual([
      "OLD-123",
      "REF-456",
    ]);
  });

  test("should map type to objectType", () => {
    const metadata: DublinCoreMetadata = {
      title: "Test",
      identifier: "2024.1.1",
      type: "Painting",
    };

    const collection = fromDublinCore(metadata);

    expect(collection.objectType).toBe("Painting");
  });

  test("should map date to dateCreated", () => {
    const metadata: DublinCoreMetadata = {
      title: "Test",
      identifier: "2024.1.1",
      date: "1890",
    };

    const collection = fromDublinCore(metadata);

    expect(collection.dateCreated).toBe("1890");
  });

  test("should map source to provenance", () => {
    const metadata: DublinCoreMetadata = {
      title: "Test",
      identifier: "2024.1.1",
      source: "Previously owned by Lord Carnarvon",
    };

    const collection = fromDublinCore(metadata);

    expect(collection.provenance).toBe("Previously owned by Lord Carnarvon");
  });

  test("should map rights to creditLine", () => {
    const metadata: DublinCoreMetadata = {
      title: "Test",
      identifier: "2024.1.1",
      rights: "Gift of John Doe, 1990",
    };

    const collection = fromDublinCore(metadata);

    expect(collection.creditLine).toBe("Gift of John Doe, 1990");
  });
});

describe("toDublinCoreXML", () => {
  test("should convert Dublin Core metadata to XML", () => {
    const metadata: DublinCoreMetadata = {
      title: "Test Artwork",
      identifier: "2024.1.1",
      creator: "John Artist",
      description: "A beautiful painting",
    };

    const xml = toDublinCoreXML(metadata);

    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain("<oai_dc:dc");
    expect(xml).toContain('xmlns:dc="http://purl.org/dc/elements/1.1/"');
    expect(xml).toContain("<dc:title>Test Artwork</dc:title>");
    expect(xml).toContain("<dc:identifier>2024.1.1</dc:identifier>");
    expect(xml).toContain("<dc:creator>John Artist</dc:creator>");
    expect(xml).toContain(
      "<dc:description>A beautiful painting</dc:description>",
    );
    expect(xml).toContain("</oai_dc:dc>");
  });

  test("should escape special XML characters", () => {
    const metadata: DublinCoreMetadata = {
      title: 'Test & "Artwork" <Special>',
      identifier: "2024.1.1",
    };

    const xml = toDublinCoreXML(metadata);

    expect(xml).toContain("&amp;");
    expect(xml).toContain("&quot;");
    expect(xml).toContain("&lt;");
    expect(xml).toContain("&gt;");
  });

  test("should handle array values with multiple elements", () => {
    const metadata: DublinCoreMetadata = {
      title: "Test",
      identifier: "2024.1.1",
      subject: ["painting", "modern art", "abstract"],
    };

    const xml = toDublinCoreXML(metadata);

    expect(xml).toContain("<dc:subject>painting</dc:subject>");
    expect(xml).toContain("<dc:subject>modern art</dc:subject>");
    expect(xml).toContain("<dc:subject>abstract</dc:subject>");
  });

  test("should omit undefined fields", () => {
    const metadata: DublinCoreMetadata = {
      title: "Test",
      identifier: "2024.1.1",
    };

    const xml = toDublinCoreXML(metadata);

    expect(xml).not.toContain("<dc:creator>");
    expect(xml).not.toContain("<dc:subject>");
    expect(xml).not.toContain("<dc:description>");
  });

  test("should format with pretty printing by default", () => {
    const metadata: DublinCoreMetadata = {
      title: "Test",
      identifier: "2024.1.1",
    };

    const xml = toDublinCoreXML(metadata);

    expect(xml).toContain("\n");
    expect(xml.split("\n").length).toBeGreaterThan(1);
  });

  test("should format without pretty printing when disabled", () => {
    const metadata: DublinCoreMetadata = {
      title: "Test",
      identifier: "2024.1.1",
    };

    const xml = toDublinCoreXML(metadata, { pretty: false });

    expect(xml).not.toContain("\n");
  });
});

describe("collectionsToDublinCore", () => {
  test("should convert multiple collections to Dublin Core", () => {
    const collections: Partial<Doc<"collections">>[] = [
      {
        title: "Artwork 1",
        accessionNumber: "2024.1.1",
        creator: "Artist 1",
      },
      {
        title: "Artwork 2",
        accessionNumber: "2024.1.2",
        creator: "Artist 2",
      },
    ];

    const dcArray = collectionsToDublinCore(collections);

    expect(dcArray.length).toBe(2);
    expect(dcArray[0].title).toBe("Artwork 1");
    expect(dcArray[0].identifier).toBe("2024.1.1");
    expect(dcArray[1].title).toBe("Artwork 2");
    expect(dcArray[1].identifier).toBe("2024.1.2");
  });

  test("should apply options to all collections", () => {
    const collections: Partial<Doc<"collections">>[] = [
      {
        title: "Artwork 1",
        accessionNumber: "2024.1.1",
      },
      {
        title: "Artwork 2",
        accessionNumber: "2024.1.2",
      },
    ];

    const dcArray = collectionsToDublinCore(collections, {
      organizationName: "Test Museum",
      language: "en",
    });

    expect(dcArray[0].publisher).toBe("Test Museum");
    expect(dcArray[0].language).toBe("en");
    expect(dcArray[1].publisher).toBe("Test Museum");
    expect(dcArray[1].language).toBe("en");
  });

  test("should handle empty array", () => {
    const dcArray = collectionsToDublinCore([]);

    expect(dcArray).toEqual([]);
  });
});

describe("round-trip conversions", () => {
  test("should round-trip basic collection through Dublin Core", () => {
    const original: Partial<Doc<"collections">> = {
      title: "Test Artwork",
      accessionNumber: "2024.1.1",
      creator: "John Artist",
      description: "A beautiful painting",
      dateCreated: "1890",
      objectType: "Painting",
      materials: "Oil on canvas",
    };

    const dc = toDublinCore(original);
    const converted = fromDublinCore(dc);

    expect(converted.title).toBe(original.title);
    expect(converted.accessionNumber).toBe(original.accessionNumber);
    expect(converted.creator).toBe(original.creator);
    expect(converted.description).toBe(original.description);
    expect(converted.dateCreated).toBe(original.dateCreated);
    expect(converted.objectType).toBe(original.objectType);
    expect(converted.materials).toBe(original.materials);
  });

  test("should round-trip complex collection with arrays", () => {
    const original: Partial<Doc<"collections">> = {
      title: "Test",
      accessionNumber: "2024.1.1",
      tags: ["painting", "modern"],
      donated_by: ["John Doe"],
      links: [{ url: "http://example.com" }],
    };

    const dc = toDublinCore(original);
    const converted = fromDublinCore(dc);

    expect(converted.tags).toEqual(original.tags);
    expect(converted.donated_by).toEqual(original.donated_by);
    expect(converted.links).toEqual(original.links);
  });
});
