/**
 * Tests for SPECTRUM standard mapper
 */

import { describe, expect, it } from "vitest";
import type { Doc } from "../_generated/dataModel";
import {
  type SpectrumObjectEntry,
  type SpectrumObjectRecord,
  accessionToSpectrumEntry,
  accessionsToSpectrumEntries,
  collectionToSpectrum,
  collectionsToSpectrum,
  entryToSpectrumXML,
  spectrumEntryToAccession,
  spectrumToCollection,
  toSpectrumXML,
} from "./spectrum";

describe("SPECTRUM Accession Mapping", () => {
  it("should convert accession to SPECTRUM Object Entry", () => {
    const accession: Partial<Doc<"accessions">> = {
      accessionNumber: "2024.001",
      dateReceived: new Date("2024-01-15").getTime(),
      method: "gift",
      source: "John Doe",
      cost: 1000,
      notes: "Excellent condition",
      status: "approved",
      approvedAt: new Date("2024-01-20").getTime(),
    };

    const entry = accessionToSpectrumEntry(accession);

    expect(entry.entryNumber).toBe("2024.001");
    expect(entry.entryDate).toBe("2024-01-15T00:00:00.000Z");
    expect(entry.entryMethod).toBe("gift");
    expect(entry.depositor).toBe("John Doe");
    expect(entry.cost).toBe(1000);
    expect(entry.notes).toBe("Excellent condition");
    expect(entry.approvalStatus).toBe("approved");
    expect(entry.dateApproved).toBe("2024-01-20T00:00:00.000Z");
  });

  it("should convert SPECTRUM Object Entry back to accession", () => {
    const entry: SpectrumObjectEntry = {
      entryNumber: "2024.002",
      entryDate: "2024-02-01T00:00:00.000Z",
      entryMethod: "purchase",
      depositor: "Jane Smith Gallery",
      cost: 5000,
      notes: "Purchased at auction",
      approvalStatus: "approved",
      dateApproved: "2024-02-05T00:00:00.000Z",
    };

    const accession = spectrumEntryToAccession(entry);

    expect(accession.accessionNumber).toBe("2024.002");
    expect(accession.dateReceived).toBe(new Date("2024-02-01").getTime());
    expect(accession.method).toBe("purchase");
    expect(accession.source).toBe("Jane Smith Gallery");
    expect(accession.cost).toBe(5000);
    expect(accession.notes).toBe("Purchased at auction");
    expect(accession.status).toBe("approved");
    expect(accession.approvedAt).toBe(new Date("2024-02-05").getTime());
  });

  it("should handle minimal accession data", () => {
    const accession: Partial<Doc<"accessions">> = {
      accessionNumber: "2024.003",
      dateReceived: new Date("2024-03-01").getTime(),
      method: "other",
      source: "Unknown",
    };

    const entry = accessionToSpectrumEntry(accession);

    expect(entry.entryNumber).toBe("2024.003");
    expect(entry.entryMethod).toBe("other");
    expect(entry.depositor).toBe("Unknown");
    expect(entry.cost).toBeUndefined();
    expect(entry.notes).toBeUndefined();
  });

  it("should convert multiple accessions to SPECTRUM entries", () => {
    const accessions: Partial<Doc<"accessions">>[] = [
      {
        accessionNumber: "2024.001",
        dateReceived: new Date("2024-01-01").getTime(),
        method: "gift",
        source: "Donor A",
      },
      {
        accessionNumber: "2024.002",
        dateReceived: new Date("2024-01-02").getTime(),
        method: "purchase",
        source: "Gallery B",
      },
    ];

    const entries = accessionsToSpectrumEntries(accessions);

    expect(entries).toHaveLength(2);
    expect(entries[0].entryNumber).toBe("2024.001");
    expect(entries[1].entryNumber).toBe("2024.002");
  });
});

describe("SPECTRUM Collection Mapping", () => {
  it("should convert collection to SPECTRUM Object Record", () => {
    const collection: Partial<Doc<"collections">> = {
      accessionNumber: "2024.001.001",
      alternateAccessionNumbers: ["OLD-123", "PREV-456"],
      objectName: "Painting",
      title: "Sunset Over Mountains",
      description: "Oil painting depicting a mountain landscape at sunset",
      creator: "Jane Artist",
      dateCreated: "1950",
      culture: "American",
      period: "20th Century",
      materials: "Oil on canvas",
      technique: "Brush painting",
      dimensions: "24 x 36 inches",
      dimensionHeight: 61,
      dimensionWidth: 91.4,
      dimensionDepth: 5,
      dimensionUnit: "cm",
      dimensionWeight: 2.5,
      weightUnit: "kg",
      inscriptions: "Signed lower right",
      condition: "Good - minor surface dirt",
      acquisitionMethod: "purchase",
      provenance: "Estate of John Collector",
      exhibitionHistory: "Metropolitan Museum, 1975",
      creditLine: "Gift of the Estate of John Collector",
      objectType: "Fine Art",
      tags: ["landscape", "American art", "20th century"],
      legalRestrictions: false,
      isPubliclyVisible: true,
    };

    const record = collectionToSpectrum(collection, {
      includeAlternateNumbers: true,
    });

    expect(record.objectNumber).toBe("2024.001.001");
    expect(record.otherNumbers).toEqual(["OLD-123", "PREV-456"]);
    expect(record.objectName).toBe("Painting");
    expect(record.title).toBe("Sunset Over Mountains");
    expect(record.description).toBe(
      "Oil painting depicting a mountain landscape at sunset",
    );
    expect(record.maker).toBe("Jane Artist");
    expect(record.dateCreated).toBe("1950");
    expect(record.culture).toBe("American");
    expect(record.period).toBe("20th Century");
    expect(record.material).toBe("Oil on canvas");
    expect(record.technique).toBe("Brush painting");
    expect(record.dimension).toBe("24 x 36 inches");
    expect(record.dimensionHeight).toBe(61);
    expect(record.dimensionWidth).toBe(91.4);
    expect(record.dimensionDepth).toBe(5);
    expect(record.dimensionUnit).toBe("cm");
    expect(record.weight).toBe(2.5);
    expect(record.weightUnit).toBe("kg");
    expect(record.inscription).toBe("Signed lower right");
    expect(record.condition).toBe("Good - minor surface dirt");
    expect(record.acquisitionMethod).toBe("purchase");
    expect(record.provenance).toBe("Estate of John Collector");
    expect(record.exhibitionHistory).toBe("Metropolitan Museum, 1975");
    expect(record.creditLine).toBe("Gift of the Estate of John Collector");
    expect(record.objectType).toBe("Fine Art");
    expect(record.keywords).toEqual([
      "landscape",
      "American art",
      "20th century",
    ]);
    expect(record.legalRestrictions).toBe(false);
    expect(record.publiclyVisible).toBe(true);
  });

  it("should convert SPECTRUM Object Record back to collection", () => {
    const record: SpectrumObjectRecord = {
      objectNumber: "2024.002.001",
      otherNumbers: ["LEGACY-789"],
      objectName: "Sculpture",
      title: "Abstract Form",
      description: "Bronze abstract sculpture",
      maker: "John Sculptor",
      dateCreated: "1965",
      culture: "European",
      period: "Modern",
      material: "Bronze",
      technique: "Lost-wax casting",
      dimension: "12 x 8 x 6 inches",
      dimensionHeight: 30.5,
      dimensionWidth: 20.3,
      dimensionDepth: 15.2,
      dimensionUnit: "cm",
      weight: 5.0,
      weightUnit: "kg",
      inscription: "Signed on base",
      condition: "Excellent",
      acquisitionMethod: "gift",
      provenance: "Artist's estate",
      exhibitionHistory: "Tate Modern, 2000",
      creditLine: "Gift of the Artist's Estate",
      objectType: "Sculpture",
      keywords: ["abstract", "bronze", "modern"],
      legalRestrictions: false,
      publiclyVisible: true,
    };

    const collection = spectrumToCollection(record);

    expect(collection.accessionNumber).toBe("2024.002.001");
    expect(collection.alternateAccessionNumbers).toEqual(["LEGACY-789"]);
    expect(collection.objectName).toBe("Sculpture");
    expect(collection.title).toBe("Abstract Form");
    expect(collection.description).toBe("Bronze abstract sculpture");
    expect(collection.creator).toBe("John Sculptor");
    expect(collection.dateCreated).toBe("1965");
    expect(collection.culture).toBe("European");
    expect(collection.period).toBe("Modern");
    expect(collection.materials).toBe("Bronze");
    expect(collection.technique).toBe("Lost-wax casting");
    expect(collection.dimensions).toBe("12 x 8 x 6 inches");
    expect(collection.dimensionHeight).toBe(30.5);
    expect(collection.dimensionWidth).toBe(20.3);
    expect(collection.dimensionDepth).toBe(15.2);
    expect(collection.dimensionUnit).toBe("cm");
    expect(collection.dimensionWeight).toBe(5.0);
    expect(collection.weightUnit).toBe("kg");
    expect(collection.inscriptions).toBe("Signed on base");
    expect(collection.condition).toBe("Excellent");
    expect(collection.acquisitionMethod).toBe("gift");
    expect(collection.provenance).toBe("Artist's estate");
    expect(collection.exhibitionHistory).toBe("Tate Modern, 2000");
    expect(collection.creditLine).toBe("Gift of the Artist's Estate");
    expect(collection.objectType).toBe("Sculpture");
    expect(collection.tags).toEqual(["abstract", "bronze", "modern"]);
    expect(collection.legalRestrictions).toBe(false);
    expect(collection.isPubliclyVisible).toBe(true);
  });

  it("should handle minimal collection data", () => {
    const collection: Partial<Doc<"collections">> = {
      accessionNumber: "2024.003.001",
      title: "Untitled",
    };

    const record = collectionToSpectrum(collection);

    expect(record.objectNumber).toBe("2024.003.001");
    expect(record.title).toBe("Untitled");
    expect(record.description).toBeUndefined();
    expect(record.maker).toBeUndefined();
  });

  it("should handle collections without alternate numbers", () => {
    const collection: Partial<Doc<"collections">> = {
      accessionNumber: "2024.004.001",
      title: "Test Object",
      alternateAccessionNumbers: ["OLD-1", "OLD-2"],
    };

    const recordWithoutAlternates = collectionToSpectrum(collection, {
      includeAlternateNumbers: false,
    });
    expect(recordWithoutAlternates.otherNumbers).toBeUndefined();

    const recordWithAlternates = collectionToSpectrum(collection, {
      includeAlternateNumbers: true,
    });
    expect(recordWithAlternates.otherNumbers).toEqual(["OLD-1", "OLD-2"]);
  });

  it("should convert multiple collections to SPECTRUM records", () => {
    const collections: Partial<Doc<"collections">>[] = [
      {
        accessionNumber: "2024.001",
        title: "Object 1",
        creator: "Artist A",
      },
      {
        accessionNumber: "2024.002",
        title: "Object 2",
        creator: "Artist B",
      },
    ];

    const records = collectionsToSpectrum(collections);

    expect(records).toHaveLength(2);
    expect(records[0].objectNumber).toBe("2024.001");
    expect(records[0].title).toBe("Object 1");
    expect(records[1].objectNumber).toBe("2024.002");
    expect(records[1].title).toBe("Object 2");
  });
});

describe("SPECTRUM XML Generation", () => {
  it("should generate valid XML for Object Record", () => {
    const record: SpectrumObjectRecord = {
      objectNumber: "2024.001",
      objectName: "Painting",
      title: "Test Painting",
      description: "A test painting",
      maker: "Test Artist",
      dateCreated: "2024",
      material: "Oil on canvas",
      technique: "Brush painting",
      dimensionHeight: 50,
      dimensionWidth: 40,
      dimensionUnit: "cm",
      condition: "Good",
      keywords: ["test", "painting"],
      legalRestrictions: false,
      publiclyVisible: true,
    };

    const xml = toSpectrumXML(record);

    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain("<spectrum:object");
    expect(xml).toContain("<objectNumber>2024.001</objectNumber>");
    expect(xml).toContain("<objectName>Painting</objectName>");
    expect(xml).toContain("<title>Test Painting</title>");
    expect(xml).toContain("<description>A test painting</description>");
    expect(xml).toContain("<maker>Test Artist</maker>");
    expect(xml).toContain("<dateCreated>2024</dateCreated>");
    expect(xml).toContain("<material>Oil on canvas</material>");
    expect(xml).toContain("<technique>Brush painting</technique>");
    expect(xml).toContain("<dimensions>");
    expect(xml).toContain('<height unit="cm">50</height>');
    expect(xml).toContain('<width unit="cm">40</width>');
    expect(xml).toContain("</dimensions>");
    expect(xml).toContain("<condition>Good</condition>");
    expect(xml).toContain("<keyword>test</keyword>");
    expect(xml).toContain("<keyword>painting</keyword>");
    expect(xml).toContain("<legalRestrictions>false</legalRestrictions>");
    expect(xml).toContain("<publiclyVisible>true</publiclyVisible>");
    expect(xml).toContain("</spectrum:object>");
  });

  it("should generate XML with multiple other numbers", () => {
    const record: SpectrumObjectRecord = {
      objectNumber: "2024.001",
      otherNumbers: ["OLD-123", "PREV-456"],
      title: "Test Object",
    };

    const xml = toSpectrumXML(record);

    expect(xml).toContain("<otherNumber>OLD-123</otherNumber>");
    expect(xml).toContain("<otherNumber>PREV-456</otherNumber>");
  });

  it("should escape XML special characters", () => {
    const record: SpectrumObjectRecord = {
      objectNumber: "2024.001",
      title: 'Title with <special> & "characters"',
      description: "Description with 'quotes' & ampersands",
    };

    const xml = toSpectrumXML(record);

    expect(xml).toContain("&lt;special&gt;");
    expect(xml).toContain("&amp;");
    expect(xml).toContain("&quot;");
    expect(xml).toContain("&apos;");
    expect(xml).not.toContain("<special>");
  });

  it("should generate compact XML when pretty is false", () => {
    const record: SpectrumObjectRecord = {
      objectNumber: "2024.001",
      title: "Test",
    };

    const xml = toSpectrumXML(record, { pretty: false });

    expect(xml).not.toContain("\n");
  });

  it("should generate valid XML for Object Entry", () => {
    const entry: SpectrumObjectEntry = {
      entryNumber: "2024.001",
      entryDate: "2024-01-15T00:00:00.000Z",
      entryMethod: "gift",
      depositor: "John Doe",
      cost: 1000,
      notes: "Test entry",
      approvalStatus: "approved",
      dateApproved: "2024-01-20T00:00:00.000Z",
    };

    const xml = entryToSpectrumXML(entry);

    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain("<spectrum:entry");
    expect(xml).toContain("<entryNumber>2024.001</entryNumber>");
    expect(xml).toContain("<entryDate>2024-01-15T00:00:00.000Z</entryDate>");
    expect(xml).toContain("<entryMethod>gift</entryMethod>");
    expect(xml).toContain("<depositor>John Doe</depositor>");
    expect(xml).toContain("<cost>1000</cost>");
    expect(xml).toContain("<notes>Test entry</notes>");
    expect(xml).toContain("<approvalStatus>approved</approvalStatus>");
    expect(xml).toContain(
      "<dateApproved>2024-01-20T00:00:00.000Z</dateApproved>",
    );
    expect(xml).toContain("</spectrum:entry>");
  });

  it("should omit undefined fields in XML", () => {
    const record: SpectrumObjectRecord = {
      objectNumber: "2024.001",
      title: "Minimal Record",
    };

    const xml = toSpectrumXML(record);

    expect(xml).toContain("<objectNumber>2024.001</objectNumber>");
    expect(xml).toContain("<title>Minimal Record</title>");
    expect(xml).not.toContain("<maker>");
    expect(xml).not.toContain("<description>");
    expect(xml).not.toContain("<dateCreated>");
  });
});

describe("SPECTRUM Round-trip Conversions", () => {
  it("should preserve data through collection round-trip conversion", () => {
    const original: Partial<Doc<"collections">> = {
      accessionNumber: "2024.001",
      title: "Test Object",
      creator: "Test Creator",
      dateCreated: "2024",
      materials: "Bronze",
      technique: "Casting",
      dimensions: "10 x 5 inches",
      condition: "Excellent",
      tags: ["test", "bronze"],
    };

    const spectrum = collectionToSpectrum(original);
    const converted = spectrumToCollection(spectrum);

    expect(converted.accessionNumber).toBe(original.accessionNumber);
    expect(converted.title).toBe(original.title);
    expect(converted.creator).toBe(original.creator);
    expect(converted.dateCreated).toBe(original.dateCreated);
    expect(converted.materials).toBe(original.materials);
    expect(converted.technique).toBe(original.technique);
    expect(converted.dimensions).toBe(original.dimensions);
    expect(converted.condition).toBe(original.condition);
    expect(converted.tags).toEqual(original.tags);
  });

  it("should preserve data through accession round-trip conversion", () => {
    const original: Partial<Doc<"accessions">> = {
      accessionNumber: "2024.001",
      dateReceived: new Date("2024-01-15").getTime(),
      method: "gift",
      source: "Test Donor",
      cost: 1000,
      notes: "Test notes",
      status: "approved",
    };

    const spectrum = accessionToSpectrumEntry(original);
    const converted = spectrumEntryToAccession(spectrum);

    expect(converted.accessionNumber).toBe(original.accessionNumber);
    expect(converted.dateReceived).toBe(original.dateReceived);
    expect(converted.method).toBe(original.method);
    expect(converted.source).toBe(original.source);
    expect(converted.cost).toBe(original.cost);
    expect(converted.notes).toBe(original.notes);
    expect(converted.status).toBe(original.status);
  });
});
