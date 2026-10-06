import { parseCsvRecords } from "@/lib/csv-parser";

export type ImportType =
  | "objects"
  | "accessions"
  | "locations"
  | "accounts"
  | "loans";

/** Rows of trimmed cells, header first. */
export function parseCSV(text: string): string[][] {
  return parseCsvRecords(text).map((record) =>
    record.values.map((value) => value.trim()),
  );
}

export function convertToCSV(
  headers: string[],
  rows: Record<string, unknown>[],
): string {
  const headerLine = headers.join(",");
  const dataLines = rows.map((row) =>
    headers
      .map((h) => {
        const value = row[h];
        if (value === null || value === undefined) return "";
        const str = String(value);
        if (str.includes(",") || str.includes('"') || str.includes("\n")) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      })
      .join(","),
  );
  return [headerLine, ...dataLines].join("\n");
}

export function downloadCsv(filename: string, csvContent: string): void {
  const blob = new Blob([csvContent], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
