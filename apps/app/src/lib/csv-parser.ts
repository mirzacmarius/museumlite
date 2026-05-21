interface ParseCSVOptions<T> {
  text: string;
  requiredColumns: string[];
  allColumns: string[];
  mapRow: (getValue: (col: string) => string, rowIndex: number) => T | null;
}

interface ParseCSVResult<T> {
  rows: T[];
  errors: string[];
}

export function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  result.push(current);
  return result;
}

export function parseCSV<T>({
  text,
  requiredColumns,
  allColumns,
  mapRow,
}: ParseCSVOptions<T>): ParseCSVResult<T> {
  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) {
    return {
      rows: [],
      errors: ["CSV must have a header row and at least one data row"],
    };
  }

  const headerLine = lines[0];
  if (!headerLine) {
    return { rows: [], errors: ["Missing header row"] };
  }

  const headers = headerLine
    .split(",")
    .map((h) => h.trim().replace(/^"|"$/g, ""));

  const missingRequired = requiredColumns.filter(
    (col) => !headers.some((h) => h.toLowerCase() === col.toLowerCase()),
  );

  if (missingRequired.length > 0) {
    return {
      rows: [],
      errors: [`Missing required columns: ${missingRequired.join(", ")}`],
    };
  }

  const columnMap = new Map<string, number>();
  for (const col of allColumns) {
    const idx = headers.findIndex((h) => h.toLowerCase() === col.toLowerCase());
    if (idx !== -1) {
      columnMap.set(col, idx);
    }
  }

  const rows: T[] = [];
  const errors: string[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line?.trim()) continue;

    const values = parseCSVLine(line);

    const getValue = (col: string): string => {
      const idx = columnMap.get(col);
      if (idx === undefined) return "";
      return (values[idx] || "").trim();
    };

    try {
      const row = mapRow(getValue, i + 1);
      if (row !== null) {
        rows.push(row);
      }
    } catch (error) {
      if (error instanceof Error) {
        errors.push(error.message);
      } else {
        errors.push(`Row ${i + 1}: Unknown error occurred`);
      }
    }
  }

  return { rows, errors };
}
