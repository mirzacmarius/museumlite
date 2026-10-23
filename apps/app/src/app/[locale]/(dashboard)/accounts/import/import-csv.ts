import { type CsvReadProblem, readCsvTable } from "@/lib/csv-parser";

export interface ParsedRow {
  /** Line in the source file; the row's stable identity on its import job. */
  rowNumber: number;
  accountNumber?: string;
  accountType: string;
  businessName?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  zipCode?: string;
  country?: string;
  contactPerson?: string;
  contactEmail?: string;
  notes?: string;
}

export const MAX_ACCOUNT_IMPORT_ROWS = 1000;

export interface AccountImportMessages {
  csvMissingHeaderAndRows: () => string;
  csvMissingRequiredColumns: (columns: string) => string;
  invalidAccountType: (row: number, value: string) => string;
  emptyValue: () => string;
  unreadableFile: (problem: CsvReadProblem) => string;
}

const DEFAULT_MESSAGES: AccountImportMessages = {
  csvMissingHeaderAndRows: () =>
    "CSV must have a header row and at least one data row",
  csvMissingRequiredColumns: (columns) =>
    `Missing required columns: ${columns}`,
  invalidAccountType: (row, value) =>
    `Row ${row}: Invalid accountType "${value}". Use: lender, borrower, both, institution, or patron`,
  emptyValue: () => "empty",
  unreadableFile: (problem) =>
    problem.code === "empty"
      ? "CSV must have a header row and at least one data row"
      : `A quotation mark in row ${problem.line} is never closed`,
};

const OPTIONAL_COLUMNS = [
  "accountNumber",
  "businessName",
  "firstName",
  "lastName",
  "email",
  "phone",
  "address",
  "city",
  "zipCode",
  "country",
  "contactPerson",
  "contactEmail",
  "notes",
] as const;

const VALID_ACCOUNT_TYPES = new Set([
  "lender",
  "borrower",
  "both",
  "institution",
  "patron",
]);

/**
 * Parses an account CSV. `fileErrors` stop the import; `rowErrors` are shown
 * in the preview while the rows are still sent so the server records them as
 * failed rows that can be corrected on the same import.
 */
export function parseAccountCsv(
  text: string,
  messages: AccountImportMessages = DEFAULT_MESSAGES,
): {
  rows: ParsedRow[];
  fileErrors: string[];
  rowErrors: string[];
} {
  const read = readCsvTable(text);
  if ("problem" in read) {
    return {
      rows: [],
      fileErrors: [messages.unreadableFile(read.problem)],
      rowErrors: [],
    };
  }
  const { table } = read;
  if (table.records.length === 0) {
    return {
      rows: [],
      fileErrors: [messages.csvMissingHeaderAndRows()],
      rowErrors: [],
    };
  }
  if (table.records.length > MAX_ACCOUNT_IMPORT_ROWS) {
    return {
      rows: [],
      fileErrors: [
        `This file has ${table.records.length} rows. Split it into files of at most ${MAX_ACCOUNT_IMPORT_ROWS} rows.`,
      ],
      rowErrors: [],
    };
  }
  const columnIndex = new Map(
    table.headers.map((header, index) => [header.toLowerCase(), index]),
  );
  if (!columnIndex.has("accounttype")) {
    return {
      rows: [],
      fileErrors: [messages.csvMissingRequiredColumns("accountType")],
      rowErrors: [],
    };
  }

  const rows: ParsedRow[] = [];
  const rowErrors: string[] = [];
  for (const record of table.records) {
    const getValue = (column: string) => {
      const index = columnIndex.get(column.toLowerCase());
      return index === undefined ? "" : (record.values[index] ?? "");
    };
    const row: ParsedRow = {
      rowNumber: record.rowNumber,
      accountType: getValue("accountType").toLowerCase(),
    };
    for (const column of OPTIONAL_COLUMNS) {
      const value = getValue(column);
      if (value) row[column] = value;
    }
    if (!VALID_ACCOUNT_TYPES.has(row.accountType)) {
      rowErrors.push(
        messages.invalidAccountType(
          row.rowNumber,
          getValue("accountType") || messages.emptyValue(),
        ),
      );
    }
    rows.push(row);
  }
  return { rows, fileErrors: [], rowErrors };
}
