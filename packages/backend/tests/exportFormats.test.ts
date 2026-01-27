import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";
import type { Id } from "../_generated/dataModel";

describe("Export Formats E2E Verification", () => {
  test("should export accessions in all supported formats", async () => {
    const t = convexTest(schema);

    // Create organization and user
    const asUser = t.withIdentity({ subject: "user123" });
    const userId = await asUser.run(async (ctx) => {
      return ctx.db.insert("users", {
        email: "test@example.com",
        name: "Test User",
        profileImageUrl: "https://example.com/avatar.png",
      });
    });

    const orgId = await asUser.run(async (ctx) => {
      return ctx.db.insert("organizations", {
        name: "Test Museum",
        slug: "test-museum",
        ownerId: userId,
      });
    });

    // Create test data - accession
    const accessionId = await asUser.run(async (ctx) => {
      return ctx.db.insert("accessions", {
        organizationId: orgId as Id<"organizations">,
        accessionNumber: "ACC-2024-001",
        dateReceived: Date.now(),
        source: "Test Donor",
        method: "Gift",
        cost: 1000,
        notes: "Test accession for export verification",
        status: "approved",
      });
    });

    // Test CSV export
    const csvExport = await asUser.mutation(
      api.imports.exportAccessionsWithFormat,
      {
        organizationId: orgId as Id<"organizations">,
        format: "csv",
      },
    );

    expect(csvExport).toContain("accessionNumber");
    expect(csvExport).toContain("ACC-2024-001");
    expect(csvExport).toContain("Test Donor");
    console.log("✓ CSV export verified - contains headers and data");

    // Test JSON export
    const jsonExport = await asUser.mutation(
      api.imports.exportAccessionsWithFormat,
      {
        organizationId: orgId as Id<"organizations">,
        format: "json",
      },
    );

    const jsonData = JSON.parse(jsonExport);
    expect(Array.isArray(jsonData)).toBe(true);
    expect(jsonData.length).toBeGreaterThan(0);
    expect(jsonData[0].accessionNumber).toBe("ACC-2024-001");
    console.log(
      "✓ JSON export verified - valid JSON structure with correct data",
    );

    // Test XML export
    const xmlExport = await asUser.mutation(
      api.imports.exportAccessionsWithFormat,
      {
        organizationId: orgId as Id<"organizations">,
        format: "xml",
      },
    );

    expect(xmlExport).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xmlExport).toContain("<accessions>");
    expect(xmlExport).toContain("<accession>");
    expect(xmlExport).toContain(
      "<accessionNumber>ACC-2024-001</accessionNumber>",
    );
    console.log("✓ XML export verified - valid XML structure with proper tags");

    // Test SPECTRUM export
    const spectrumExport = await asUser.mutation(
      api.imports.exportAccessionsWithFormat,
      {
        organizationId: orgId as Id<"organizations">,
        format: "spectrum",
      },
    );

    expect(spectrumExport).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(spectrumExport).toContain("spectrum:entries");
    expect(spectrumExport).toContain(
      "<ObjectNumber>ACC-2024-001</ObjectNumber>",
    );
    console.log("✓ SPECTRUM export verified - valid SPECTRUM XML structure");
  });

  test("should export collections in all supported formats", async () => {
    const t = convexTest(schema);

    // Create organization and user
    const asUser = t.withIdentity({ subject: "user456" });
    const userId = await asUser.run(async (ctx) => {
      return ctx.db.insert("users", {
        email: "curator@example.com",
        name: "Test Curator",
        profileImageUrl: "https://example.com/avatar.png",
      });
    });

    const orgId = await asUser.run(async (ctx) => {
      return ctx.db.insert("organizations", {
        name: "Test Gallery",
        slug: "test-gallery",
        ownerId: userId,
      });
    });

    // Create test collection item
    const collectionId = await asUser.run(async (ctx) => {
      return ctx.db.insert("collections", {
        organizationId: orgId as Id<"organizations">,
        accessionNumber: "2024.001",
        title: "Test Artwork",
        creator: "Test Artist",
        objectType: "Painting",
        objectName: "Oil Painting",
        culture: "Contemporary",
        period: "21st Century",
        dateCreated: "2024",
        materials: "Oil on canvas",
        technique: "Impasto",
        dimensions: "100 x 80 cm",
        description: "A test artwork for export verification",
        condition: "Excellent",
        provenance: "Acquired from Test Gallery",
        status: "active",
      });
    });

    // Test CSV export
    const csvExport = await asUser.mutation(
      api.imports.exportObjectsWithFormat,
      {
        organizationId: orgId as Id<"organizations">,
        format: "csv",
      },
    );

    expect(csvExport).toContain("accessionNumber");
    expect(csvExport).toContain("2024.001");
    expect(csvExport).toContain("Test Artwork");
    console.log("✓ CSV export verified for collections");

    // Test JSON export
    const jsonExport = await asUser.mutation(
      api.imports.exportObjectsWithFormat,
      {
        organizationId: orgId as Id<"organizations">,
        format: "json",
      },
    );

    const jsonData = JSON.parse(jsonExport);
    expect(Array.isArray(jsonData)).toBe(true);
    expect(jsonData[0].title).toBe("Test Artwork");
    expect(jsonData[0].creator).toBe("Test Artist");
    console.log("✓ JSON export verified for collections");

    // Test XML export
    const xmlExport = await asUser.mutation(
      api.imports.exportObjectsWithFormat,
      {
        organizationId: orgId as Id<"organizations">,
        format: "xml",
      },
    );

    expect(xmlExport).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xmlExport).toContain("<collections>");
    expect(xmlExport).toContain("<collection>");
    expect(xmlExport).toContain("<title>Test Artwork</title>");
    console.log("✓ XML export verified for collections");

    // Test Dublin Core export
    const dcExport = await asUser.mutation(
      api.imports.exportObjectsWithFormat,
      {
        organizationId: orgId as Id<"organizations">,
        format: "dublincore",
      },
    );

    expect(dcExport).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(dcExport).toContain("dublincore:records");
    expect(dcExport).toContain("<dc:title>Test Artwork</dc:title>");
    expect(dcExport).toContain("<dc:creator>Test Artist</dc:creator>");
    expect(dcExport).toContain("<dc:identifier>2024.001</dc:identifier>");
    console.log("✓ Dublin Core export verified - proper metadata mapping");

    // Test SPECTRUM export
    const spectrumExport = await asUser.mutation(
      api.imports.exportObjectsWithFormat,
      {
        organizationId: orgId as Id<"organizations">,
        format: "spectrum",
      },
    );

    expect(spectrumExport).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(spectrumExport).toContain("spectrum:objects");
    expect(spectrumExport).toContain("<ObjectNumber>2024.001</ObjectNumber>");
    expect(spectrumExport).toContain("<ObjectTitle>Test Artwork</ObjectTitle>");
    expect(spectrumExport).toContain("<Maker>Test Artist</Maker>");
    console.log("✓ SPECTRUM export verified - standard compliance");
  });

  test("should handle empty exports gracefully", async () => {
    const t = convexTest(schema);

    // Create organization with no data
    const asUser = t.withIdentity({ subject: "user789" });
    const userId = await asUser.run(async (ctx) => {
      return ctx.db.insert("users", {
        email: "empty@example.com",
        name: "Empty User",
        profileImageUrl: "https://example.com/avatar.png",
      });
    });

    const orgId = await asUser.run(async (ctx) => {
      return ctx.db.insert("organizations", {
        name: "Empty Museum",
        slug: "empty-museum",
        ownerId: userId,
      });
    });

    // Test empty CSV export
    const csvExport = await asUser.mutation(
      api.imports.exportAccessionsWithFormat,
      {
        organizationId: orgId as Id<"organizations">,
        format: "csv",
      },
    );

    expect(csvExport).toContain("accessionNumber");
    expect(csvExport.split("\n").length).toBe(1); // Only header row
    console.log("✓ Empty CSV export handled correctly");

    // Test empty JSON export
    const jsonExport = await asUser.mutation(
      api.imports.exportAccessionsWithFormat,
      {
        organizationId: orgId as Id<"organizations">,
        format: "json",
      },
    );

    const jsonData = JSON.parse(jsonExport);
    expect(Array.isArray(jsonData)).toBe(true);
    expect(jsonData.length).toBe(0);
    console.log("✓ Empty JSON export handled correctly");

    // Test empty XML export
    const xmlExport = await asUser.mutation(
      api.imports.exportAccessionsWithFormat,
      {
        organizationId: orgId as Id<"organizations">,
        format: "xml",
      },
    );

    expect(xmlExport).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xmlExport).toContain("<accessions>");
    console.log("✓ Empty XML export handled correctly");
  });

  test("should properly escape special characters in exports", async () => {
    const t = convexTest(schema);

    const asUser = t.withIdentity({ subject: "user999" });
    const userId = await asUser.run(async (ctx) => {
      return ctx.db.insert("users", {
        email: "special@example.com",
        name: "Special User",
        profileImageUrl: "https://example.com/avatar.png",
      });
    });

    const orgId = await asUser.run(async (ctx) => {
      return ctx.db.insert("organizations", {
        name: "Special Museum",
        slug: "special-museum",
        ownerId: userId,
      });
    });

    // Create collection with special characters
    await asUser.run(async (ctx) => {
      return ctx.db.insert("collections", {
        organizationId: orgId as Id<"organizations">,
        accessionNumber: "2024.002",
        title: 'Test "Artwork" with <special> & characters',
        creator: "Artist & Co.",
        objectType: "Painting",
        description: 'Description with\nnewlines and "quotes"',
        status: "active",
      });
    });

    // Test CSV escaping
    const csvExport = await asUser.mutation(
      api.imports.exportObjectsWithFormat,
      {
        organizationId: orgId as Id<"organizations">,
        format: "csv",
      },
    );

    expect(csvExport).toContain(
      '"Test ""Artwork"" with <special> & characters"',
    );
    console.log("✓ CSV special character escaping verified");

    // Test JSON escaping
    const jsonExport = await asUser.mutation(
      api.imports.exportObjectsWithFormat,
      {
        organizationId: orgId as Id<"organizations">,
        format: "json",
      },
    );

    const jsonData = JSON.parse(jsonExport);
    expect(jsonData[0].title).toBe(
      'Test "Artwork" with <special> & characters',
    );
    console.log("✓ JSON special character handling verified");

    // Test XML escaping
    const xmlExport = await asUser.mutation(
      api.imports.exportObjectsWithFormat,
      {
        organizationId: orgId as Id<"organizations">,
        format: "xml",
      },
    );

    expect(xmlExport).toContain("&lt;");
    expect(xmlExport).toContain("&gt;");
    expect(xmlExport).toContain("&amp;");
    expect(xmlExport).toContain("&quot;");
    console.log("✓ XML special character escaping verified");
  });
});
