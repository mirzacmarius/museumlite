/**
 * Converts an array of objects to CSV format
 * @param data Array of objects to convert
 * @returns CSV string representation
 */
export function convertToCSV(data: Record<string, unknown>[]): string {
  if (data.length === 0) return "";

  const headers = Object.keys(data[0] ?? {});
  const csvRows: string[] = [];

  csvRows.push(headers.join(","));

  for (const row of data) {
    const values = headers.map((header) => {
      const value = row[header];
      if (value === null || value === undefined) return "";
      if (typeof value === "number") {
        if (
          header.toLowerCase().includes("date") ||
          header.toLowerCase().includes("at")
        ) {
          return new Date(value).toISOString();
        }
        return String(value);
      }
      const stringValue = String(value);
      if (
        stringValue.includes(",") ||
        stringValue.includes('"') ||
        stringValue.includes("\n")
      ) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }
      return stringValue;
    });
    csvRows.push(values.join(","));
  }

  return csvRows.join("\n");
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
