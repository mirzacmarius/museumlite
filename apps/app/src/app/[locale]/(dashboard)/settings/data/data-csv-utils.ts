import { parseCsvRecords } from "@/lib/csv-parser";
import { formatCsvCell } from "@/lib/format-converters";

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
    headers.map((h) => formatCsvCell(row[h])).join(","),
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
