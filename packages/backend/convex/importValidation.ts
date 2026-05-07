import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import {
  type AccessionImportRow,
  type ValidationIssue,
  type ValidationSeverity,
  normalizeAccessionImportRow,
} from "./utils/importRows";
import { requirePermission } from "./utils/permissions";

/**
 * Validation error structure
 */
type ValidationError = ValidationIssue;

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
 * Validate a single accession row
 */
function validateAccessionRow(
  row: AccessionImportRow,
  rowNumber: number,
): ValidationError[] {
  return normalizeAccessionImportRow(row, rowNumber).issues;
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
