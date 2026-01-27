/**
 * Test file for Format Converters
 *
 * Tests JSON and XML conversion utilities for import/export functionality.
 *
 * Run with: `bun test utils/formatConverters.test.ts` (from packages/backend)
 */

import { describe, expect, test } from "vitest";
import {
  toJSON,
  fromJSON,
  toXML,
  fromXML,
  isValidJSON,
  isValidXML,
  detectFormat,
} from "../../convex/utils/formatConverters";

describe("JSON conversion", () => {
  test("should convert object to JSON string", () => {
    const data = { name: "Test", value: 123 };
    const json = toJSON(data);

    expect(json).toContain('"name"');
    expect(json).toContain('"Test"');
    expect(json).toContain('"value"');
    expect(json).toContain("123");
  });

  test("should convert array to JSON string", () => {
    const data = [{ id: 1 }, { id: 2 }];
    const json = toJSON(data);

    expect(json).toContain('"id"');
    expect(json).toContain("1");
    expect(json).toContain("2");
  });

  test("should format JSON with pretty printing by default", () => {
    const data = { name: "Test" };
    const json = toJSON(data);

    expect(json).toContain("\n");
    expect(json).toContain("  ");
  });

  test("should format JSON without pretty printing when disabled", () => {
    const data = { name: "Test" };
    const json = toJSON(data, { pretty: false });

    expect(json).not.toContain("\n");
    expect(json).toBe('{"name":"Test"}');
  });

  test("should parse JSON string to object", () => {
    const jsonString = '{"name":"Test","value":123}';
    const data = fromJSON<{ name: string; value: number }>(jsonString);

    expect(data.name).toBe("Test");
    expect(data.value).toBe(123);
  });

  test("should parse JSON array", () => {
    const jsonString = '[{"id":1},{"id":2}]';
    const data = fromJSON<Array<{ id: number }>>(jsonString);

    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBe(2);
    expect(data[0].id).toBe(1);
  });

  test("should throw error on invalid JSON", () => {
    expect(() => fromJSON("invalid json")).toThrow();
  });
});

describe("XML conversion", () => {
  test("should convert simple object to XML", () => {
    const data = { name: "Test", value: 123 };
    const xml = toXML(data);

    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain("<data>");
    expect(xml).toContain("<name>Test</name>");
    expect(xml).toContain("<value>123</value>");
    expect(xml).toContain("</data>");
  });

  test("should convert array to XML with item tags", () => {
    const data = [
      { id: 1, name: "First" },
      { id: 2, name: "Second" },
    ];
    const xml = toXML(data);

    expect(xml).toContain("<item>");
    expect(xml).toContain("</item>");
    expect(xml).toContain("<id>1</id>");
    expect(xml).toContain("<name>First</name>");
    expect(xml).toContain("<id>2</id>");
    expect(xml).toContain("<name>Second</name>");
  });

  test("should escape special XML characters", () => {
    const data = { text: 'Test & "quote" <tag>' };
    const xml = toXML(data);

    expect(xml).toContain("&amp;");
    expect(xml).toContain("&quot;");
    expect(xml).toContain("&lt;");
    expect(xml).toContain("&gt;");
  });

  test("should handle nested objects", () => {
    const data = {
      parent: {
        child: "value",
      },
    };
    const xml = toXML(data);

    expect(xml).toContain("<parent>");
    expect(xml).toContain("<child>value</child>");
    expect(xml).toContain("</parent>");
  });

  test("should handle null values", () => {
    const data = { nullField: null };
    const xml = toXML(data);

    expect(xml).toContain("<nullField />");
  });

  test("should use custom root and item tags", () => {
    const data = [{ id: 1 }];
    const xml = toXML(data, { rootTag: "collection", itemTag: "object" });

    expect(xml).toContain("<collection>");
    expect(xml).toContain("<object>");
    expect(xml).toContain("</object>");
    expect(xml).toContain("</collection>");
  });

  test("should parse simple XML to object", () => {
    const xmlString = `<?xml version="1.0" encoding="UTF-8"?>
<data>
  <name>Test</name>
  <value>123</value>
</data>`;
    const data = fromXML<{ name: string; value: string }>(xmlString);

    expect(data.name).toBe("Test");
    expect(data.value).toBe("123");
  });

  test("should parse XML with nested objects", () => {
    const xmlString = `<?xml version="1.0" encoding="UTF-8"?>
<data>
  <parent>
    <child>value</child>
  </parent>
</data>`;
    const data = fromXML<{ parent: { child: string } }>(xmlString);

    expect(data.parent).toBeDefined();
    expect(data.parent.child).toBe("value");
  });

  test("should unescape XML special characters", () => {
    const xmlString = `<?xml version="1.0" encoding="UTF-8"?>
<data>
  <text>Test &amp; &quot;quote&quot; &lt;tag&gt;</text>
</data>`;
    const data = fromXML<{ text: string }>(xmlString);

    expect(data.text).toBe('Test & "quote" <tag>');
  });

  test("should parse XML array", () => {
    const xmlString = `<?xml version="1.0" encoding="UTF-8"?>
<data>
  <item>
    <id>1</id>
  </item>
  <item>
    <id>2</id>
  </item>
</data>`;
    const data = fromXML<Array<{ id: string }>>(xmlString);

    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBe(2);
    expect(data[0].id).toBe("1");
    expect(data[1].id).toBe("2");
  });

  test("should handle null values in XML", () => {
    const xmlString = `<?xml version="1.0" encoding="UTF-8"?>
<data>
  <nullField />
</data>`;
    const data = fromXML<{ nullField: null }>(xmlString);

    expect(data.nullField).toBeNull();
  });

  test("should throw error on invalid XML", () => {
    expect(() => fromXML("not xml")).toThrow();
  });
});

describe("JSON validation", () => {
  test("should validate correct JSON", () => {
    expect(isValidJSON('{"name":"test"}')).toBe(true);
    expect(isValidJSON("[1,2,3]")).toBe(true);
    expect(isValidJSON("null")).toBe(true);
  });

  test("should invalidate incorrect JSON", () => {
    expect(isValidJSON("not json")).toBe(false);
    expect(isValidJSON("{invalid}")).toBe(false);
    expect(isValidJSON("")).toBe(false);
  });
});

describe("XML validation", () => {
  test("should validate correct XML", () => {
    expect(isValidXML('<?xml version="1.0"?><root></root>')).toBe(true);
    expect(isValidXML("<root><child /></root>")).toBe(true);
  });

  test("should invalidate incorrect XML", () => {
    expect(isValidXML("not xml")).toBe(false);
    expect(isValidXML("<root>")).toBe(false);
    expect(isValidXML("")).toBe(false);
  });
});

describe("format detection", () => {
  test("should detect JSON format", () => {
    expect(detectFormat('{"name":"test"}')).toBe("json");
    expect(detectFormat("[1,2,3]")).toBe("json");
  });

  test("should detect XML format", () => {
    expect(detectFormat('<?xml version="1.0"?><root></root>')).toBe("xml");
    expect(detectFormat("<root><child /></root>")).toBe("xml");
  });

  test("should return null for unknown formats", () => {
    expect(detectFormat("plain text")).toBeNull();
    expect(detectFormat("")).toBeNull();
  });

  test("should handle whitespace", () => {
    expect(detectFormat('  {"name":"test"}  ')).toBe("json");
    expect(detectFormat("  <root></root>  ")).toBe("xml");
  });
});

describe("round-trip conversions", () => {
  test("should round-trip JSON conversion", () => {
    const original = { name: "Test", value: 123, nested: { data: "value" } };
    const json = toJSON(original);
    const parsed = fromJSON(json);

    expect(parsed).toEqual(original);
  });

  test("should round-trip XML conversion for simple objects", () => {
    const original = { name: "Test", value: "123" };
    const xml = toXML(original);
    const parsed = fromXML<{ name: string; value: string }>(xml);

    expect(parsed.name).toBe(original.name);
    expect(parsed.value).toBe(original.value);
  });
});
