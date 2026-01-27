/**
 * Test file for Frontend Format Converters
 *
 * Tests CSV, JSON, and XML conversion utilities for export functionality.
 *
 * Run with: `bun test src/lib/format-converters.test.ts` (from apps/app)
 */

import { describe, expect, test } from "vitest";
import { convertToCSV, convertToJSON, convertToXML } from "./format-converters";

describe("CSV conversion", () => {
  test("should convert array of objects to CSV", () => {
    const data = [
      { name: "Test", value: 123 },
      { name: "Test2", value: 456 },
    ];
    const csv = convertToCSV(data);

    expect(csv).toContain("name,value");
    expect(csv).toContain("Test,123");
    expect(csv).toContain("Test2,456");
  });

  test("should return empty string for empty array", () => {
    const csv = convertToCSV([]);
    expect(csv).toBe("");
  });

  test("should escape commas in values", () => {
    const data = [{ name: "Test, Inc" }];
    const csv = convertToCSV(data);

    expect(csv).toContain('"Test, Inc"');
  });

  test("should escape quotes in values", () => {
    const data = [{ name: 'Test "quoted" value' }];
    const csv = convertToCSV(data);

    expect(csv).toContain('""quoted""');
  });

  test("should handle null and undefined values", () => {
    const data = [{ name: "Test", value: null, other: undefined }];
    const csv = convertToCSV(data);

    expect(csv).toContain("Test,,");
  });
});

describe("JSON conversion", () => {
  test("should convert array to JSON string", () => {
    const data = [{ name: "Test", value: 123 }];
    const json = convertToJSON(data);

    expect(json).toContain('"name"');
    expect(json).toContain('"Test"');
    expect(json).toContain('"value"');
    expect(json).toContain("123");
  });

  test("should pretty-print JSON by default", () => {
    const data = [{ name: "Test" }];
    const json = convertToJSON(data);

    expect(json).toContain("\n");
    expect(json).toContain("  ");
  });

  test("should not pretty-print when disabled", () => {
    const data = [{ name: "Test" }];
    const json = convertToJSON(data, false);

    expect(json).toBe('[{"name":"Test"}]');
  });

  test("should return empty array for empty data", () => {
    const json = convertToJSON([]);
    expect(json).toBe("[]");
  });

  test("should handle nested objects", () => {
    const data = [{ name: "Test", nested: { value: 123 } }];
    const json = convertToJSON(data);

    expect(json).toContain('"nested"');
    expect(json).toContain('"value"');
    expect(json).toContain("123");
  });

  test("should handle null values", () => {
    const data = [{ name: "Test", value: null }];
    const json = convertToJSON(data);

    expect(json).toContain("null");
  });
});

describe("XML conversion", () => {
  test("should convert array to XML", () => {
    const data = [{ name: "Test", value: 123 }];
    const xml = convertToXML(data);

    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain("<data>");
    expect(xml).toContain("</data>");
    expect(xml).toContain("<item>");
    expect(xml).toContain("</item>");
    expect(xml).toContain("<name>Test</name>");
    expect(xml).toContain("<value>123</value>");
  });

  test("should escape special XML characters", () => {
    const data = [{ text: 'Test & "quote" <tag>' }];
    const xml = convertToXML(data);

    expect(xml).toContain("&amp;");
    expect(xml).toContain("&quot;");
    expect(xml).toContain("&lt;");
    expect(xml).toContain("&gt;");
  });

  test("should handle nested objects", () => {
    const data = [
      {
        parent: {
          child: "value",
        },
      },
    ];
    const xml = convertToXML(data);

    expect(xml).toContain("<parent>");
    expect(xml).toContain("<child>value</child>");
    expect(xml).toContain("</parent>");
  });

  test("should handle null values", () => {
    const data = [{ nullField: null }];
    const xml = convertToXML(data);

    expect(xml).toContain("<nullField />");
  });

  test("should use custom root and item tags", () => {
    const data = [{ id: 1 }];
    const xml = convertToXML(data, "collection", "object");

    expect(xml).toContain("<collection>");
    expect(xml).toContain("<object>");
    expect(xml).toContain("</object>");
    expect(xml).toContain("</collection>");
  });

  test("should return empty XML for empty array", () => {
    const xml = convertToXML([]);

    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain("<data>");
    expect(xml).toContain("</data>");
  });

  test("should handle multiple items", () => {
    const data = [
      { id: 1, name: "First" },
      { id: 2, name: "Second" },
    ];
    const xml = convertToXML(data);

    expect(xml).toContain("<id>1</id>");
    expect(xml).toContain("<name>First</name>");
    expect(xml).toContain("<id>2</id>");
    expect(xml).toContain("<name>Second</name>");
  });

  test("should handle arrays in values", () => {
    const data = [{ items: ["one", "two"] }];
    const xml = convertToXML(data);

    expect(xml).toContain("<items>one</items>");
    expect(xml).toContain("<items>two</items>");
  });

  test("should handle undefined values", () => {
    const data = [{ undefinedField: undefined }];
    const xml = convertToXML(data);

    expect(xml).toContain("<undefinedField />");
  });
});

describe("format converters integration", () => {
  test("should handle complex data structures in all formats", () => {
    const data = [
      {
        id: 1,
        name: "Test Item",
        value: 123.45,
        active: true,
        tags: ["tag1", "tag2"],
        metadata: {
          created: "2024-01-01",
          author: "John Doe",
        },
      },
    ];

    const csv = convertToCSV(data);
    expect(csv).toContain("id,name,value,active,tags,metadata");

    const json = convertToJSON(data);
    expect(json).toContain('"id": 1');
    expect(json).toContain('"name": "Test Item"');

    const xml = convertToXML(data);
    expect(xml).toContain("<id>1</id>");
    expect(xml).toContain("<name>Test Item</name>");
    expect(xml).toContain("<value>123.45</value>");
  });
});
