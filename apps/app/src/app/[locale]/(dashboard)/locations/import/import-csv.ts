export interface ParsedRow {
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
    | "missingHeaderRow"
    | "missingRequiredColumns"
    | "nameRequired"
    | "locationCodeRequired"
    | "typeRequired";
  row?: number;
  columns?: string;
}

const REQUIRED_COLUMNS = ["name", "locationCode", "type"];
const OPTIONAL_COLUMNS = ["parentLocation", "address", "capacity", "notes"];
const ALL_COLUMNS = [...REQUIRED_COLUMNS, ...OPTIONAL_COLUMNS];

export function parseCSV(text: string): {
  rows: ParsedRow[];
  errors: ParseError[];
} {
  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) {
    return {
      rows: [],
      errors: [{ type: "csvMustHaveRows" }],
    };
  }

  const headerLine = lines[0];
  if (!headerLine) {
    return { rows: [], errors: [{ type: "missingHeaderRow" }] };
  }

  const headers = headerLine
    .split(",")
    .map((header) => header.trim().replace(/^"|"$/g, ""));

  const missingRequired = REQUIRED_COLUMNS.filter(
    (column) =>
      !headers.some((header) => header.toLowerCase() === column.toLowerCase()),
  );

  if (missingRequired.length > 0) {
    return {
      rows: [],
      errors: [
        {
          type: "missingRequiredColumns",
          columns: missingRequired.join(", "),
        },
      ],
    };
  }

  const headerIndexByName = new Map(
    headers.map((header, index) => [header.toLowerCase(), index]),
  );
  const columnMap = new Map<string, number>();
  for (const column of ALL_COLUMNS) {
    const index = headerIndexByName.get(column.toLowerCase()) ?? -1;
    if (index !== -1) {
      columnMap.set(column, index);
    }
  }

  const rows: ParsedRow[] = [];
  const errors: ParseError[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line || !line.trim()) continue;

    const values = parseCSVLine(line);

    const getValue = (column: string): string => {
      const index = columnMap.get(column);
      if (index === undefined) return "";
      return (values[index] || "").trim();
    };

    const name = getValue("name");
    const locationCode = getValue("locationCode");
    const type = getValue("type");

    if (!name) {
      errors.push({ type: "nameRequired", row: i + 1 });
      continue;
    }

    if (!type) {
      errors.push({ type: "typeRequired", row: i + 1 });
      continue;
    }

    if (!locationCode) {
      errors.push({ type: "locationCodeRequired", row: i + 1 });
      continue;
    }

    rows.push({
      name,
      locationCode,
      type,
      parentLocation: getValue("parentLocation") || undefined,
      address: getValue("address") || undefined,
      capacity: getValue("capacity") || undefined,
      notes: getValue("notes") || undefined,
    });
  }

  return { rows, errors };
}

function parseCSVLine(line: string): string[] {
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
