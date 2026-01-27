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
