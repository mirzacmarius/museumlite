export type ValidationSeverity = "error" | "warning" | "info";

export interface ValidationIssue {
  row: number;
  field: string;
  message: string;
  severity: ValidationSeverity;
  value?: string;
}

export type AccessionImportMethod =
  | "purchase"
  | "gift"
  | "loan"
  | "transfer"
  | "donation"
  | "other"
  | "bequest";

export interface AccessionImportRow {
  accessionNumber?: string;
  dateReceived: string;
  source: string;
  method: string;
  cost?: string;
  notes?: string;
}

export interface NormalizedAccessionImportRow {
  accessionNumber?: string;
  dateReceived: number;
  source: string;
  method: AccessionImportMethod;
  cost?: number;
  notes?: string;
}

const VALID_ACCESSION_METHODS: readonly AccessionImportMethod[] = [
  "purchase",
  "gift",
  "loan",
  "transfer",
  "donation",
  "other",
  "bequest",
];

function isAccessionImportMethod(
  value: string,
): value is AccessionImportMethod {
  return VALID_ACCESSION_METHODS.some((method) => method === value);
}

function trimOptional(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function parseOptionalCost(value: string | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) {
    return undefined;
  }

  return parseImportDecimal(trimmed);
}

export function normalizeAccessionImportRow(
  row: AccessionImportRow,
  rowNumber: number,
  now = Date.now(),
) {
  const issues: ValidationIssue[] = [];
  const source = row.source.trim();

  if (!source) {
    issues.push({
      row: rowNumber,
      field: "source",
      message: "Source is required",
      severity: "error",
      value: row.source,
    });
  }

  const trimmedDateReceived = row.dateReceived.trim();
  let dateReceived: number | undefined;
  if (!trimmedDateReceived) {
    issues.push({
      row: rowNumber,
      field: "dateReceived",
      message: "Date received is required",
      severity: "error",
      value: row.dateReceived,
    });
  } else {
    const parsedDate = parseImportDate(trimmedDateReceived);
    if (parsedDate === null) {
      issues.push({
        row: rowNumber,
        field: "dateReceived",
        message: "Invalid date format. Use YYYY-MM-DD",
        severity: "error",
        value: row.dateReceived,
      });
    } else {
      dateReceived = parsedDate;
      if (parsedDate > now) {
        issues.push({
          row: rowNumber,
          field: "dateReceived",
          message: "Date is in the future",
          severity: "warning",
          value: row.dateReceived,
        });
      }
    }
  }

  const trimmedMethod = row.method.trim();
  let method: AccessionImportMethod | undefined;
  if (!trimmedMethod) {
    issues.push({
      row: rowNumber,
      field: "method",
      message: "Method is required",
      severity: "error",
      value: row.method,
    });
  } else {
    const normalizedMethod = trimmedMethod.toLowerCase();
    if (isAccessionImportMethod(normalizedMethod)) {
      method = normalizedMethod;
    } else {
      method = "other";
      issues.push({
        row: rowNumber,
        field: "method",
        message: `Invalid method. Must be one of: ${VALID_ACCESSION_METHODS.join(", ")}`,
        severity: "warning",
        value: row.method,
      });
    }
  }

  const cost = parseOptionalCost(row.cost);
  if (cost === null) {
    issues.push({
      row: rowNumber,
      field: "cost",
      message: "Cost must be a valid number",
      severity: "error",
      value: row.cost,
    });
  } else if (cost !== undefined && cost < 0) {
    issues.push({
      row: rowNumber,
      field: "cost",
      message: "Cost cannot be negative",
      severity: "warning",
      value: row.cost,
    });
  }

  const accessionNumber = trimOptional(row.accessionNumber);
  if (!accessionNumber) {
    issues.push({
      row: rowNumber,
      field: "accessionNumber",
      message: "Accession number will be auto-generated",
      severity: "info",
    });
  }

  const hasErrors = issues.some((issue) => issue.severity === "error");
  if (
    hasErrors ||
    dateReceived === undefined ||
    method === undefined ||
    !source
  ) {
    return {
      issues,
      normalized: null,
    };
  }

  return {
    issues,
    normalized: {
      accessionNumber,
      dateReceived,
      source,
      method,
      cost: cost ?? undefined,
      notes: trimOptional(row.notes),
    },
  };
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const ISO_DATE_TIME =
  /^(\d{4})-(\d{2})-(\d{2})T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/;

/**
 * Strict import date: `YYYY-MM-DD` (UTC midnight) or a full ISO 8601 date-time
 * with an offset. Ambiguous forms such as `01/02/2024` are rejected rather than
 * guessed, and impossible calendar dates fail. Returns null when invalid.
 */
export function parseImportDate(value: string): number | null {
  const text = value.trim();
  const match = ISO_DATE.exec(text) ?? ISO_DATE_TIME.exec(text);
  if (!match) return null;
  const [year, month, day] = [match[1], match[2], match[3]].map(Number) as [
    number,
    number,
    number,
  ];
  const calendar = new Date(Date.UTC(year, month - 1, day));
  if (
    calendar.getUTCFullYear() !== year ||
    calendar.getUTCMonth() !== month - 1 ||
    calendar.getUTCDate() !== day
  ) {
    return null;
  }
  if (ISO_DATE.test(text)) return calendar.getTime();
  const parsed = Date.parse(text);
  return Number.isNaN(parsed) ? null : parsed;
}

/** Plain decimal (optional thousands commas or currency symbol); null when invalid. */
export function parseImportDecimal(value: string): number | null {
  const text = value.trim().replace(/^[$€£¥]\s*/, "");
  if (!/^-?(\d{1,3}(,\d{3})+|\d+)(\.\d+)?$/.test(text)) return null;
  const parsed = Number(text.replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}
