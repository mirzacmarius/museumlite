import { protectSpreadsheetText } from "@v1/backend/convex/utils/exportEncoding";

const CSV_QUOTE_CHARS = new Set([",", '"', "\n", "\r"]);

function csvValueNeedsQuoting(value: string) {
  for (const char of value) {
    if (CSV_QUOTE_CHARS.has(char)) return true;
  }
  return false;
}

export function formatCsvCell(value: unknown) {
  if (value === null || value === undefined) return "";
  if (typeof value === "number" || typeof value === "boolean")
    return String(value);
  if (value instanceof Date) return value.toISOString();
  const raw = typeof value === "object" ? JSON.stringify(value) : String(value);
  const text = protectSpreadsheetText(raw);
  return text !== raw || csvValueNeedsQuoting(text)
    ? `"${text.replace(/"/g, '""')}"`
    : text;
}

/**
 * Converts an array of objects to CSV. Cell handling depends on the value
 * type, never on the column name: numbers and booleans stay unlocalized,
 * Date values become UTC ISO timestamps, and text is formula-protected.
 */
export function convertToCSV(data: Record<string, unknown>[]): string {
  if (data.length === 0) return "";

  const headers = Object.keys(data[0] ?? {});
  return [
    headers.join(","),
    ...data.map((row) =>
      headers.map((header) => formatCsvCell(row[header])).join(","),
    ),
  ].join("\n");
}

/**
 * Converts an array of objects to JSON format
 * @param data Array of objects to convert
 * @param pretty Whether to pretty-print the JSON (default: true)
 * @returns JSON string representation
 */
export function convertToJSON(
  data: Record<string, unknown>[],
  pretty = true,
): string {
  if (data.length === 0) return "[]";

  try {
    return pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data);
  } catch (error) {
    throw new Error(
      `Failed to convert to JSON: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

/**
 * Escapes special XML characters
 * @param str String to escape
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
 * Converts a single value to XML element string
 * @param key Element tag name
 * @param value Element value
 * @param indent Indentation string
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
 * @param obj Object to convert
 * @param indent Indentation string
 * @returns XML elements string
 */
function objectToXml(obj: Record<string, unknown>, indent = ""): string {
  return Object.entries(obj)
    .map(([key, value]) => valueToXml(key, value, indent))
    .join("\n");
}

/**
 * Converts an array of objects to XML format
 * @param data Array of objects to convert
 * @param rootTag Root element tag name (default: "data")
 * @param itemTag Item element tag name (default: "item")
 * @returns XML string representation
 */
export function convertToXML(
  data: Record<string, unknown>[],
  rootTag = "data",
  itemTag = "item",
): string {
  if (data.length === 0) {
    return `<?xml version="1.0" encoding="UTF-8"?>\n<${rootTag}>\n</${rootTag}>`;
  }

  try {
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += `<${rootTag}>\n`;

    xml += data
      .map((item) => {
        const content = objectToXml(item, "    ");
        return `  <${itemTag}>\n${content}\n  </${itemTag}>`;
      })
      .join("\n");

    xml += `\n</${rootTag}>`;

    return xml;
  } catch (error) {
    throw new Error(
      `Failed to convert to XML: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}
