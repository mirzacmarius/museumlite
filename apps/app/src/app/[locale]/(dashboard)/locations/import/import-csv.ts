import { parseCsvTable } from "@/lib/csv-parser";

export interface ParsedRow {
  /** Line in the source file; the row's stable identity on its import job. */
  rowNumber: number;
  name: string;
  locationCode: string;
  type: string;
  parentLocation?: string;
  address?: string;
  capacity?: string;
  notes?: string;
}

export interface ParseError {
  type:
    | "csvMustHaveRows"
    | "tooManyRows"
    | "unreadableFile"
    | "missingRequiredColumns"
    | "nameRequired"
    | "locationCodeRequired"
    | "typeRequired";
  row?: number;
  columns?: string;
  detail?: string;
}

export const MAX_LOCATION_IMPORT_ROWS = 1000;

const REQUIRED_COLUMNS = ["name", "locationCode", "type"] as const;
const OPTIONAL_COLUMNS = [
  "parentLocation",
  "address",
  "capacity",
  "notes",
] as const;

/**
 * Parses a location CSV. Every data row is returned, including rows with
 * missing values: those are reported here and recorded as failed rows by the
 * server so they can be corrected on the same import.
 */
export function parseCSV(text: string): {
  rows: ParsedRow[];
  errors: ParseError[];
} {
  let table: ReturnType<typeof parseCsvTable>;
  try {
    table = parseCsvTable(text);
  } catch (error) {
    return {
      rows: [],
      errors: [
        {
          type: "unreadableFile",
          detail: error instanceof Error ? error.message : undefined,
        },
      ],
    };
  }
  if (table.records.length === 0) {
    return { rows: [], errors: [{ type: "csvMustHaveRows" }] };
  }

  const columnIndex = new Map(
    table.headers.map((header, index) => [header.toLowerCase(), index]),
  );
  const missingRequired = REQUIRED_COLUMNS.filter(
    (column) => !columnIndex.has(column.toLowerCase()),
  );
  if (missingRequired.length > 0) {
    return {
      rows: [],
      errors: [
        { type: "missingRequiredColumns", columns: missingRequired.join(", ") },
      ],
    };
  }

  const rows: ParsedRow[] = [];
  const errors: ParseError[] = [];
  for (const record of table.records) {
    const getValue = (column: string) => {
      const index = columnIndex.get(column.toLowerCase());
      return index === undefined ? "" : (record.values[index] ?? "");
    };
    const row: ParsedRow = {
      rowNumber: record.rowNumber,
      name: getValue("name"),
      locationCode: getValue("locationCode"),
      type: getValue("type"),
    };
    for (const column of OPTIONAL_COLUMNS) {
      const value = getValue(column);
      if (value) row[column] = value;
    }
    if (!row.name) errors.push({ type: "nameRequired", row: row.rowNumber });
    if (!row.type) errors.push({ type: "typeRequired", row: row.rowNumber });
    if (!row.locationCode) {
      errors.push({ type: "locationCodeRequired", row: row.rowNumber });
    }
    rows.push(row);
  }
  return { rows, errors };
}
