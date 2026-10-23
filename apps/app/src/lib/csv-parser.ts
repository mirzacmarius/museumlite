export interface CsvRecord {
  /** 1-based line on which the record starts in the source file. */
  rowNumber: number;
  values: string[];
}

export interface CsvTable {
  headers: string[];
  records: CsvRecord[];
}

const DELIMITERS = [",", ";", "\t"] as const;

/**
 * The separator the header row uses most outside quotes. Spreadsheets set to
 * a decimal-comma language, such as Numbers or Excel in Norwegian, save CSV
 * with semicolons.
 */
function detectDelimiter(source: string): string {
  const counts = new Map<string, number>();
  let inQuotes = false;
  for (const char of source) {
    if (char === '"') inQuotes = !inQuotes;
    else if (!inQuotes && (char === "\n" || char === "\r")) break;
    else if (!inQuotes && DELIMITERS.some((delimiter) => delimiter === char)) {
      counts.set(char, (counts.get(char) ?? 0) + 1);
    }
  }
  let best = ",";
  for (const delimiter of DELIMITERS) {
    if ((counts.get(delimiter) ?? 0) > (counts.get(best) ?? 0)) {
      best = delimiter;
    }
  }
  return best;
}

/** Why a file cannot be read as a CSV table. */
export type CsvReadProblem =
  | { code: "empty" }
  | { code: "unclosedQuote"; line: number };

/** A read problem, or a file too long to import. */
export type CsvFileProblem =
  | CsvReadProblem
  | { code: "tooManyRows"; rows: number; max: number };

/**
 * A file problem thrown by the parsing helpers. `message` is English for
 * logs; staff see the problem through `useCsvFileProblemMessage`.
 */
export class CsvFileError extends Error {
  constructor(readonly problem: CsvFileProblem) {
    super(describeProblem(problem));
    this.name = "CsvFileError";
  }
}

/**
 * RFC 4180 parser: quoted fields may contain the separator, doubled quotes
 * and line breaks; CRLF and a leading byte-order mark are accepted. The
 * separator is a comma, semicolon or tab, whichever the header row uses.
 * Blank records are dropped but keep their line numbers out of later records.
 */
function readCsvRecords(
  text: string,
): { records: CsvRecord[] } | { problem: CsvReadProblem } {
  const source = text.startsWith("\ufeff") ? text.slice(1) : text;
  const delimiter = detectDelimiter(source);
  const records: CsvRecord[] = [];
  let values: string[] = [];
  let field = "";
  let inQuotes = false;
  let line = 1;
  let recordStart = 1;

  const endRecord = () => {
    values.push(field);
    if (values.some((value) => value.trim() !== "")) {
      records.push({ rowNumber: recordStart, values });
    }
    values = [];
    field = "";
  };

  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if (inQuotes) {
      if (char === '"') {
        if (source[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        if (char === "\n") line++;
        field += char;
      }
      continue;
    }
    if (char === '"') {
      inQuotes = true;
    } else if (char === delimiter) {
      values.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && source[i + 1] === "\n") i++;
      endRecord();
      line++;
      recordStart = line;
    } else {
      field += char;
    }
  }
  if (inQuotes) {
    return { problem: { code: "unclosedQuote", line: recordStart } };
  }
  if (field !== "" || values.length > 0) endRecord();
  return { records };
}

function describeProblem(problem: CsvFileProblem) {
  switch (problem.code) {
    case "empty":
      return "CSV file is empty or has no data rows";
    case "unclosedQuote":
      return `Unclosed quoted field starting on line ${problem.line}`;
    case "tooManyRows":
      return `This file has ${problem.rows} rows. Split it into files of at most ${problem.max} rows.`;
  }
}

/** {@link readCsvRecords}, throwing a {@link CsvFileError} for a file problem. */
export function parseCsvRecords(text: string): CsvRecord[] {
  const result = readCsvRecords(text);
  if ("problem" in result) throw new CsvFileError(result.problem);
  return result.records;
}

/**
 * Header row plus data records, or why the file has neither; headers and
 * values are trimmed.
 */
export function readCsvTable(
  text: string,
): { table: CsvTable } | { problem: CsvReadProblem } {
  const result = readCsvRecords(text);
  if ("problem" in result) return result;
  const [header, ...records] = result.records;
  if (!header) return { problem: { code: "empty" } };
  return {
    table: {
      headers: header.values.map((value) => value.trim()),
      records: records.map((record) => ({
        rowNumber: record.rowNumber,
        values: record.values.map((value) => value.trim()),
      })),
    },
  };
}

/** {@link readCsvTable}, throwing a {@link CsvFileError} for a file problem. */
export function parseCsvTable(text: string): CsvTable {
  const result = readCsvTable(text);
  if ("problem" in result) throw new CsvFileError(result.problem);
  return result.table;
}

/** SHA-256 of the file text, used to recognise a re-uploaded source file. */
export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(text),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

export interface CsvObjectRow {
  rowNumber: number;
  values: Record<string, string>;
}

/** Data rows keyed by header, with a row-count limit for browser imports. */
export function parseCsvObjects(
  text: string,
  { maxRows }: { maxRows: number },
): { headers: string[]; rows: CsvObjectRow[] } {
  const table = parseCsvTable(text);
  if (table.records.length === 0) {
    throw new CsvFileError({ code: "empty" });
  }
  if (table.records.length > maxRows) {
    throw new CsvFileError({
      code: "tooManyRows",
      rows: table.records.length,
      max: maxRows,
    });
  }
  return {
    headers: table.headers,
    rows: table.records.map((record) => {
      const values: Record<string, string> = {};
      table.headers.forEach((header, index) => {
        if (header) values[header] = record.values[index] ?? "";
      });
      return { rowNumber: record.rowNumber, values };
    }),
  };
}
