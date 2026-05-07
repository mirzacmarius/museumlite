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

  const cleaned = trimmed.replace(/[^0-9.-]/g, "");
  const parsed = Number.parseFloat(cleaned);
  return Number.isNaN(parsed) ? null : parsed;
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
    const parsedDate = Date.parse(trimmedDateReceived);
    if (Number.isNaN(parsedDate)) {
      issues.push({
        row: rowNumber,
        field: "dateReceived",
        message: "Invalid date format",
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
