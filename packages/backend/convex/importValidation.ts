import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { requirePermission } from "./utils/permissions";

/**
 * Validation error severity levels
 */
type ValidationSeverity = "error" | "warning" | "info";

/**
 * Validation error structure
 */
interface ValidationError {
  row: number;
  field: string;
  message: string;
  severity: ValidationSeverity;
  value?: string;
}

/**
 * Validation report structure
 */
interface ValidationReport {
  isValid: boolean;
  totalRows: number;
  validRows: number;
  errorCount: number;
  warningCount: number;
  infoCount: number;
  errors: ValidationError[];
}

/**
 * Accession import row structure
 */
interface AccessionImportRow {
  accessionNumber?: string;
  dateReceived: string;
  source: string;
  method: string;
  cost?: string;
  notes?: string;
}

/**
 * Collection import row structure
 */
interface CollectionImportRow {
  title: string;
  accessionNumber?: string;
  maker?: string;
  date?: string;
  medium?: string;
  dimensions?: string;
  location?: string;
  condition?: string;
  notes?: string;
}

/**
 * Valid accession methods
 */
const VALID_METHODS = [
  "purchase",
  "gift",
  "loan",
  "transfer",
  "donation",
  "other",
  "bequest",
];

/**
 * Validate a single accession row
 */
function validateAccessionRow(
  row: AccessionImportRow,
  rowNumber: number,
): ValidationError[] {
  const errors: ValidationError[] = [];

  // Required field: source
  if (!row.source || row.source.trim() === "") {
    errors.push({
      row: rowNumber,
      field: "source",
      message: "Source is required",
      severity: "error",
      value: row.source,
    });
  }

  // Required field: dateReceived
  if (!row.dateReceived || row.dateReceived.trim() === "") {
    errors.push({
      row: rowNumber,
      field: "dateReceived",
      message: "Date received is required",
      severity: "error",
      value: row.dateReceived,
    });
  } else {
    // Validate date format
    const parsed = Date.parse(row.dateReceived);
    if (Number.isNaN(parsed)) {
      errors.push({
        row: rowNumber,
        field: "dateReceived",
        message: "Invalid date format",
        severity: "error",
        value: row.dateReceived,
      });
    } else {
      // Warn about future dates
      if (parsed > Date.now()) {
        errors.push({
          row: rowNumber,
          field: "dateReceived",
          message: "Date is in the future",
          severity: "warning",
          value: row.dateReceived,
        });
      }
    }
  }

  // Validate method
  if (!row.method || row.method.trim() === "") {
    errors.push({
      row: rowNumber,
      field: "method",
      message: "Method is required",
      severity: "error",
      value: row.method,
    });
  } else {
    const normalized = row.method.toLowerCase().trim();
    if (!VALID_METHODS.includes(normalized)) {
      errors.push({
        row: rowNumber,
        field: "method",
        message: `Invalid method. Must be one of: ${VALID_METHODS.join(", ")}`,
        severity: "warning",
        value: row.method,
      });
    }
  }

  // Validate cost (optional but must be valid number if provided)
  if (row.cost && row.cost.trim() !== "") {
    const cleaned = row.cost.replace(/[^0-9.-]/g, "");
    const num = Number.parseFloat(cleaned);
    if (Number.isNaN(num)) {
      errors.push({
        row: rowNumber,
        field: "cost",
        message: "Cost must be a valid number",
        severity: "error",
        value: row.cost,
      });
    } else if (num < 0) {
      errors.push({
        row: rowNumber,
        field: "cost",
        message: "Cost cannot be negative",
        severity: "warning",
        value: row.cost,
      });
    }
  }

  // Info: suggest accession number format if not provided
  if (!row.accessionNumber || row.accessionNumber.trim() === "") {
    errors.push({
      row: rowNumber,
      field: "accessionNumber",
      message: "Accession number will be auto-generated",
      severity: "info",
    });
  }

  return errors;
}

/**
 * Validate a single collection row
 */
function validateCollectionRow(
  row: CollectionImportRow,
  rowNumber: number,
): ValidationError[] {
  const errors: ValidationError[] = [];

  // Required field: title
  if (!row.title || row.title.trim() === "") {
    errors.push({
      row: rowNumber,
      field: "title",
      message: "Title is required",
      severity: "error",
      value: row.title,
    });
  }

  // Validate date if provided
  if (row.date && row.date.trim() !== "") {
    const parsed = Date.parse(row.date);
    if (Number.isNaN(parsed)) {
      // Not a standard date format, might be a year or period (e.g., "1850-1900")
      // Only warn if it doesn't look like a year
      if (!/^\d{4}(-\d{4})?$/.test(row.date.trim())) {
        errors.push({
          row: rowNumber,
          field: "date",
          message:
            "Date format may not be standard. Use ISO format (YYYY-MM-DD) or year (YYYY)",
          severity: "info",
          value: row.date,
        });
      }
    }
  }

  // Validate dimensions format (optional guidance)
  if (row.dimensions && row.dimensions.trim() !== "") {
    // Check if dimensions include units
    const hasUnits = /cm|in|mm|m|inches|centimeters|millimeters|meters/i.test(
      row.dimensions,
    );
    if (!hasUnits) {
      errors.push({
        row: rowNumber,
        field: "dimensions",
        message: "Consider including units (cm, in, etc.) in dimensions",
        severity: "info",
        value: row.dimensions,
      });
    }
  }

  // Info: suggest accession number if not provided
  if (!row.accessionNumber || row.accessionNumber.trim() === "") {
    errors.push({
      row: rowNumber,
      field: "accessionNumber",
      message: "Accession number will be auto-generated",
      severity: "info",
    });
  }

  return errors;
}

/**
 * Validate multiple accession rows and generate a report
 */
export function validateAccessions(
  rows: AccessionImportRow[],
): ValidationReport {
  const allErrors: ValidationError[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;

    const rowNumber = i + 2; // Account for header row
    const rowErrors = validateAccessionRow(row, rowNumber);
    allErrors.push(...rowErrors);
  }

  const errorCount = allErrors.filter((e) => e.severity === "error").length;
  const warningCount = allErrors.filter((e) => e.severity === "warning").length;
  const infoCount = allErrors.filter((e) => e.severity === "info").length;

  // Count valid rows (rows without errors)
  const rowsWithErrors = new Set(
    allErrors.filter((e) => e.severity === "error").map((e) => e.row),
  );
  const validRows = rows.length - rowsWithErrors.size;

  return {
    isValid: errorCount === 0,
    totalRows: rows.length,
    validRows,
    errorCount,
    warningCount,
    infoCount,
    errors: allErrors,
  };
}

/**
 * Validate multiple collection rows and generate a report
 */
export function validateCollections(
  rows: CollectionImportRow[],
): ValidationReport {
  const allErrors: ValidationError[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;

    const rowNumber = i + 2; // Account for header row
    const rowErrors = validateCollectionRow(row, rowNumber);
    allErrors.push(...rowErrors);
  }

  const errorCount = allErrors.filter((e) => e.severity === "error").length;
  const warningCount = allErrors.filter((e) => e.severity === "warning").length;
  const infoCount = allErrors.filter((e) => e.severity === "info").length;

  // Count valid rows (rows without errors)
  const rowsWithErrors = new Set(
    allErrors.filter((e) => e.severity === "error").map((e) => e.row),
  );
  const validRows = rows.length - rowsWithErrors.size;

  return {
    isValid: errorCount === 0,
    totalRows: rows.length,
    validRows,
    errorCount,
    warningCount,
    infoCount,
    errors: allErrors,
  };
}

/**
 * General mutation to validate import data of any type
 */
export const validateImport = mutation({
  args: {
    organizationId: v.id("organizations"),
    type: v.union(v.literal("accession"), v.literal("collection")),
    rows: v.array(
      v.union(
        v.object({
          accessionNumber: v.optional(v.string()),
          dateReceived: v.string(),
          source: v.string(),
          method: v.string(),
          cost: v.optional(v.string()),
          notes: v.optional(v.string()),
        }),
        v.object({
          title: v.string(),
          accessionNumber: v.optional(v.string()),
          maker: v.optional(v.string()),
          date: v.optional(v.string()),
          medium: v.optional(v.string()),
          dimensions: v.optional(v.string()),
          location: v.optional(v.string()),
          condition: v.optional(v.string()),
          notes: v.optional(v.string()),
        }),
      ),
    ),
  },
  returns: v.object({
    isValid: v.boolean(),
    totalRows: v.number(),
    validRows: v.number(),
    errorCount: v.number(),
    warningCount: v.number(),
    infoCount: v.number(),
    errors: v.array(
      v.object({
        row: v.number(),
        field: v.string(),
        message: v.string(),
        severity: v.union(
          v.literal("error"),
          v.literal("warning"),
          v.literal("info"),
        ),
        value: v.optional(v.string()),
      }),
    ),
  }),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    await requirePermission(ctx, args.organizationId, "collections.create");

    let report: ValidationReport;

    if (args.type === "accession") {
      report = validateAccessions(args.rows as AccessionImportRow[]);
    } else if (args.type === "collection") {
      report = validateCollections(args.rows as CollectionImportRow[]);
    } else {
      throw new Error(`Unsupported import type: ${args.type}`);
    }

    // Store validation report for tracking
    await ctx.db.insert("importValidationReports", {
      organizationId: args.organizationId,
      entityType: args.type,
      totalRows: report.totalRows,
      validRows: report.validRows,
      errorCount: report.errorCount,
      warningCount: report.warningCount,
      createdBy: userId,
      createdAt: Date.now(),
    });

    return report;
  },
});

/**
 * Mutation to validate accession import data before committing
 */
export const validateAccessionImport = mutation({
  args: {
    organizationId: v.id("organizations"),
    rows: v.array(
      v.object({
        accessionNumber: v.optional(v.string()),
        dateReceived: v.string(),
        source: v.string(),
        method: v.string(),
        cost: v.optional(v.string()),
        notes: v.optional(v.string()),
      }),
    ),
  },
  returns: v.object({
    isValid: v.boolean(),
    totalRows: v.number(),
    validRows: v.number(),
    errorCount: v.number(),
    warningCount: v.number(),
    infoCount: v.number(),
    errors: v.array(
      v.object({
        row: v.number(),
        field: v.string(),
        message: v.string(),
        severity: v.union(
          v.literal("error"),
          v.literal("warning"),
          v.literal("info"),
        ),
        value: v.optional(v.string()),
      }),
    ),
  }),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    await requirePermission(ctx, args.organizationId, "collections.create");

    const report = validateAccessions(args.rows);

    // Store validation report for tracking
    await ctx.db.insert("importValidationReports", {
      organizationId: args.organizationId,
      entityType: "accession",
      totalRows: report.totalRows,
      validRows: report.validRows,
      errorCount: report.errorCount,
      warningCount: report.warningCount,
      createdBy: userId,
      createdAt: Date.now(),
    });

    return report;
  },
});

/**
 * Mutation to validate collection import data before committing
 */
export const validateCollectionImport = mutation({
  args: {
    organizationId: v.id("organizations"),
    rows: v.array(
      v.object({
        title: v.string(),
        accessionNumber: v.optional(v.string()),
        maker: v.optional(v.string()),
        date: v.optional(v.string()),
        medium: v.optional(v.string()),
        dimensions: v.optional(v.string()),
        location: v.optional(v.string()),
        condition: v.optional(v.string()),
        notes: v.optional(v.string()),
      }),
    ),
  },
  returns: v.object({
    isValid: v.boolean(),
    totalRows: v.number(),
    validRows: v.number(),
    errorCount: v.number(),
    warningCount: v.number(),
    infoCount: v.number(),
    errors: v.array(
      v.object({
        row: v.number(),
        field: v.string(),
        message: v.string(),
        severity: v.union(
          v.literal("error"),
          v.literal("warning"),
          v.literal("info"),
        ),
        value: v.optional(v.string()),
      }),
    ),
  }),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    await requirePermission(ctx, args.organizationId, "collections.create");

    const report = validateCollections(args.rows);

    // Store validation report for tracking
    await ctx.db.insert("importValidationReports", {
      organizationId: args.organizationId,
      entityType: "collection",
      totalRows: report.totalRows,
      validRows: report.validRows,
      errorCount: report.errorCount,
      warningCount: report.warningCount,
      createdBy: userId,
      createdAt: Date.now(),
    });

    return report;
  },
});

/**
 * Query to list recent validation reports for an organization
 */
export const listValidationReports = query({
  args: {
    organizationId: v.id("organizations"),
  },
  returns: v.array(
    v.object({
      _id: v.id("importValidationReports"),
      entityType: v.string(),
      totalRows: v.number(),
      validRows: v.number(),
      errorCount: v.number(),
      warningCount: v.number(),
      createdAt: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const reports = await ctx.db
      .query("importValidationReports")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .order("desc")
      .take(20);

    return reports.map((report) => ({
      _id: report._id,
      entityType: report.entityType,
      totalRows: report.totalRows,
      validRows: report.validRows,
      errorCount: report.errorCount,
      warningCount: report.warningCount,
      createdAt: report.createdAt,
    }));
  },
});
