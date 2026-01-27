/**
 * Format conversion utilities for import/export functionality
 *
 * Provides conversion between JSON, XML, and internal data structures.
 * Used by import/export mutations to support multiple file formats.
 */

/**
 * JSON conversion utilities
 */

export interface JsonConversionOptions {
  pretty?: boolean;
  indent?: number;
}

/**
 * Converts data to JSON string format
 * @param data - Data to convert to JSON
 * @param options - Formatting options
 * @returns JSON string representation
 */
export function toJSON(
  data: unknown,
  options: JsonConversionOptions = {},
): string {
  const { pretty = true, indent = 2 } = options;

  try {
    return pretty ? JSON.stringify(data, null, indent) : JSON.stringify(data);
  } catch (error) {
    throw new Error(
      `Failed to convert to JSON: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

/**
 * Parses JSON string to data object
 * @param jsonString - JSON string to parse
 * @returns Parsed data object
 */
export function fromJSON<T = unknown>(jsonString: string): T {
  try {
    return JSON.parse(jsonString) as T;
  } catch (error) {
    throw new Error(
      `Failed to parse JSON: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

/**
 * XML conversion utilities
 */

export interface XmlConversionOptions {
  pretty?: boolean;
  indent?: string;
  rootTag?: string;
  itemTag?: string;
}

/**
 * Escapes special XML characters
 * @param str - String to escape
 * @returns XML-safe string
 */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Unescapes XML special characters
 * @param str - Escaped XML string
 * @returns Unescaped string
 */
function unescapeXml(str: string): string {
  return str
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&gt;/g, ">")
    .replace(/&lt;/g, "<")
    .replace(/&amp;/g, "&");
}

/**
 * Converts a single value to XML element string
 * @param key - Element tag name
 * @param value - Element value
 * @param indent - Indentation string
 * @returns XML element string
 */
function valueToXml(key: string, value: unknown, indent = ""): string {
  if (value === null || value === undefined) {
    return `${indent}<${key} />`;
  }

  if (typeof value === "object" && !Array.isArray(value)) {
    const nested = objectToXml(value as Record<string, unknown>, `${indent}  `);
    return `${indent}<${key}>\n${nested}\n${indent}</${key}>`;
  }

  if (Array.isArray(value)) {
    return value.map((item) => valueToXml(key, item, indent)).join("\n");
  }

  const escapedValue = escapeXml(String(value));
  return `${indent}<${key}>${escapedValue}</${key}>`;
}

/**
 * Converts an object to XML elements
 * @param obj - Object to convert
 * @param indent - Indentation string
 * @returns XML elements string
 */
function objectToXml(obj: Record<string, unknown>, indent = ""): string {
  return Object.entries(obj)
    .map(([key, value]) => valueToXml(key, value, indent))
    .join("\n");
}

/**
 * Converts data to XML string format
 * @param data - Data to convert to XML
 * @param options - Formatting options
 * @returns XML string representation
 */
export function toXML(
  data: unknown,
  options: XmlConversionOptions = {},
): string {
  const {
    pretty = true,
    indent = "  ",
    rootTag = "data",
    itemTag = "item",
  } = options;

  try {
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';

    if (Array.isArray(data)) {
      xml += `<${rootTag}>\n`;
      xml += data
        .map((item) => {
          if (typeof item === "object" && item !== null) {
            const content = objectToXml(
              item as Record<string, unknown>,
              indent + indent,
            );
            return `${indent}<${itemTag}>\n${content}\n${indent}</${itemTag}>`;
          }
          return `${indent}<${itemTag}>${escapeXml(String(item))}</${itemTag}>`;
        })
        .join("\n");
      xml += `\n</${rootTag}>`;
    } else if (typeof data === "object" && data !== null) {
      xml += `<${rootTag}>\n`;
      xml += objectToXml(data as Record<string, unknown>, indent);
      xml += `\n</${rootTag}>`;
    } else {
      xml += `<${rootTag}>${escapeXml(String(data))}</${rootTag}>`;
    }

    return pretty ? xml : xml.replace(/\n\s*/g, "");
  } catch (error) {
    throw new Error(
      `Failed to convert to XML: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

/**
 * Parses XML element to object
 * @param element - XML element string
 * @returns Parsed object
 */
function parseXmlElement(element: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  // Match all child elements
  const elementRegex =
    /<(\w+)(?:\s[^>]*)?>(.+?)<\/\1>|<(\w+)(?:\s[^>]*)?\s*\/>/gs;
  const matches = element.matchAll(elementRegex);

  for (const match of matches) {
    const tagName = match[1] ?? match[3];
    const content = match[2];

    if (!tagName || !content) {
      if (tagName) {
        result[tagName] = null;
      }
      continue;
    }

    // Check if content contains nested elements
    if (content.includes("<")) {
      result[tagName] = parseXmlElement(content);
    } else {
      result[tagName] = unescapeXml(content.trim());
    }
  }

  return result;
}

/**
 * Parses XML string to data object
 * @param xmlString - XML string to parse
 * @returns Parsed data object
 */
export function fromXML<T = unknown>(xmlString: string): T {
  try {
    // Remove XML declaration
    const cleaned = xmlString.replace(/<\?xml[^?]*\?>/g, "").trim();

    // Find root element
    const rootMatch = cleaned.match(/<(\w+)(?:\s[^>]*)?>(.+)<\/\1>/s);
    if (!rootMatch) {
      throw new Error("Invalid XML: No root element found");
    }

    const rootContent = rootMatch[2];
    if (!rootContent) {
      throw new Error("Invalid XML: Root element is empty");
    }

    // Check if root contains multiple items with the same tag (array)
    const itemRegex = /<(\w+)(?:\s[^>]*)?>(.+?)<\/\1>/gs;
    const items = Array.from(rootContent.matchAll(itemRegex));

    if (items.length > 0) {
      // Check if all items have the same tag name
      const firstTag = items[0]?.[1];
      const allSameTag =
        firstTag && items.every((item) => item[1] === firstTag);

      if (allSameTag && items.length > 1) {
        // Parse as array
        return items.map((item) => {
          const content = item[2];
          if (!content) return null;
          return content.includes("<")
            ? parseXmlElement(content)
            : unescapeXml(content.trim());
        }) as T;
      }
    }

    // Parse as single object
    return parseXmlElement(rootContent) as T;
  } catch (error) {
    throw new Error(
      `Failed to parse XML: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

/**
 * Validates if a string is valid JSON
 * @param str - String to validate
 * @returns True if valid JSON
 */
export function isValidJSON(str: string): boolean {
  try {
    JSON.parse(str);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validates if a string is valid XML
 * @param str - String to validate
 * @returns True if valid XML
 */
export function isValidXML(str: string): boolean {
  try {
    const cleaned = str.replace(/<\?xml[^?]*\?>/g, "").trim();

    // Check for root element
    const rootMatch = cleaned.match(/<(\w+)(?:\s[^>]*)?>.*<\/\1>/s);
    if (!rootMatch) {
      return false;
    }

    // Basic validation: check for mismatched tags
    const openTags = str.match(/<(\w+)(?:\s[^>]*)?>/g) || [];
    const closeTags = str.match(/<\/(\w+)>/g) || [];
    const selfClosingTags = str.match(/<(\w+)(?:\s[^>]*)?\s*\/>/g) || [];

    // Rough check: open tags should match close tags (accounting for self-closing)
    const expectedCloseTags = openTags.length - selfClosingTags.length;

    return closeTags.length === expectedCloseTags;
  } catch {
    return false;
  }
}

/**
 * Detects the format of a string (JSON or XML)
 * @param str - String to detect format
 * @returns Detected format or null if unknown
 */
export function detectFormat(str: string): "json" | "xml" | null {
  const trimmed = str.trim();

  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    return isValidJSON(trimmed) ? "json" : null;
  }

  if (trimmed.startsWith("<?xml") || trimmed.startsWith("<")) {
    return isValidXML(trimmed) ? "xml" : null;
  }

  return null;
}
