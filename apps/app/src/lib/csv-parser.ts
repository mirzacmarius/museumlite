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

/**
 * RFC 4180 parser: quoted fields may contain the separator, doubled quotes
 * and line breaks; CRLF and a leading byte-order mark are accepted. The
 * separator is a comma, semicolon or tab, whichever the header row uses.
 * Blank records are dropped but keep their line numbers out of later records.
 */
export function parseCsvRecords(text: string): CsvRecord[] {
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
    throw new Error(`Unclosed quoted field starting on line ${recordStart}`);
  }
  if (field !== "" || values.length > 0) endRecord();
  return records;
}

/** Header row plus data records; headers and values are trimmed. */
export function parseCsvTable(text: string): CsvTable {
  const [header, ...records] = parseCsvRecords(text);
  if (!header) {
    throw new Error("CSV file is empty");
  }
  return {
    headers: header.values.map((value) => value.trim()),
    records: records.map((record) => ({
      rowNumber: record.rowNumber,
      values: record.values.map((value) => value.trim()),
    })),
  };
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
    throw new Error("CSV file has no data rows");
  }
  if (table.records.length > maxRows) {
    throw new Error(
      `This file has ${table.records.length} rows. Split it into files of at most ${maxRows} rows.`,
    );
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
