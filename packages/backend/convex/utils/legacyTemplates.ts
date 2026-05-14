/**
 * Legacy system import templates
 *
 * Provides field mapping templates for common museum collection management systems
 * like PastPerfect and TMS (The Museum System). These templates help users migrate
 * from legacy systems by providing pre-configured field mappings.
 */

import type { Doc } from "../_generated/dataModel";

/**
 * Field mapping definition - maps a source field to a target field
 */
export interface FieldMapping {
  /** Source field name from the legacy system */
  sourceField: string;
  /** Target field name in MuseumLite schema */
  targetField: string;
  /** Optional transformation function name */
  transform?: "date" | "cost" | "method" | "array" | "dimensions";
  /** Whether this field is required */
  required?: boolean;
  /** Description of the field mapping */
  description?: string;
}

/**
 * Import template for a legacy system
 */
export interface ImportTemplate {
  /** Template name */
  name: string;
  /** Template description */
  description: string;
  /** Legacy system name */
  system: "PastPerfect" | "TMS" | "custom";
  /** Field mappings for collections */
  collectionMappings: FieldMapping[];
  /** Field mappings for accessions */
  accessionMappings: FieldMapping[];
}

/**
 * PastPerfect field mapping template
 * PastPerfect is a popular collections management system used by small to medium museums
 */
export const PASTPERFECT_TEMPLATE: ImportTemplate = {
  name: "PastPerfect",
  description: "Import template for PastPerfect collections management system",
  system: "PastPerfect",
  collectionMappings: [
    {
      sourceField: "ObjectID",
      targetField: "accessionNumber",
      required: true,
      description: "Primary object identifier",
    },
    {
      sourceField: "Title",
      targetField: "title",
      required: true,
      description: "Object title or name",
    },
    {
      sourceField: "ObjectName",
      targetField: "objectName",
      description: "Common name for the object type",
    },
    {
      sourceField: "Maker",
      targetField: "creator",
      description: "Artist, maker, or creator name",
    },
    {
      sourceField: "Artist",
      targetField: "creator",
      description: "Alternative field for artist name",
    },
    {
      sourceField: "DateMade",
      targetField: "dateCreated",
      description: "Date the object was created",
    },
    {
      sourceField: "Date",
      targetField: "dateCreated",
      description: "Alternative field for creation date",
    },
    {
      sourceField: "Materials",
      targetField: "materials",
      description: "Materials used in the object",
    },
    {
      sourceField: "Medium",
      targetField: "materials",
      description: "Alternative field for materials/medium",
    },
    {
      sourceField: "Measurements",
      targetField: "dimensions",
      description: "Physical dimensions of the object",
    },
    {
      sourceField: "Dimensions",
      targetField: "dimensions",
      description: "Alternative field for dimensions",
    },
    {
      sourceField: "Height",
      targetField: "dimensionHeight",
      transform: "cost",
      description: "Height in cm (numeric)",
    },
    {
      sourceField: "Width",
      targetField: "dimensionWidth",
      transform: "cost",
      description: "Width in cm (numeric)",
    },
    {
      sourceField: "Depth",
      targetField: "dimensionDepth",
      transform: "cost",
      description: "Depth in cm (numeric)",
    },
    {
      sourceField: "Description",
      targetField: "description",
      description: "Detailed description of the object",
    },
    {
      sourceField: "Condition",
      targetField: "condition",
      description: "Condition assessment",
    },
    {
      sourceField: "AccessionNumber",
      targetField: "accessionNumber",
      description: "Formal accession number",
    },
    {
      sourceField: "Donor",
      targetField: "donated_by",
      transform: "array",
      description: "Donor name(s)",
    },
    {
      sourceField: "AcquisitionMethod",
      targetField: "acquisitionMethod",
      description: "How the object was acquired",
    },
    {
      sourceField: "CurrentLocation",
      targetField: "displayStatus",
      description: "Current storage or display location",
    },
    {
      sourceField: "Location",
      targetField: "displayStatus",
      description: "Alternative field for location",
    },
    {
      sourceField: "CreditLine",
      targetField: "creditLine",
      description: "Public credit line for the object",
    },
    {
      sourceField: "ObjectType",
      targetField: "objectType",
      description: "Classification or category",
    },
    {
      sourceField: "Culture",
      targetField: "culture",
      description: "Cultural origin",
    },
    {
      sourceField: "Period",
      targetField: "period",
      description: "Historical period",
    },
    {
      sourceField: "Provenance",
      targetField: "provenance",
      description: "Ownership history",
    },
    {
      sourceField: "ExhibitionHistory",
      targetField: "exhibitionHistory",
      description: "Exhibition history",
    },
    {
      sourceField: "Inscriptions",
      targetField: "inscriptions",
      description: "Inscriptions or marks on the object",
    },
    {
      sourceField: "Technique",
      targetField: "technique",
      description: "Manufacturing or artistic technique",
    },
  ],
  accessionMappings: [
    {
      sourceField: "AccessionNumber",
      targetField: "accessionNumber",
      required: true,
      description: "Accession record number",
    },
    {
      sourceField: "DateReceived",
      targetField: "dateReceived",
      transform: "date",
      required: true,
      description: "Date object was received",
    },
    {
      sourceField: "AccessionDate",
      targetField: "dateReceived",
      transform: "date",
      description: "Alternative field for accession date",
    },
    {
      sourceField: "Donor",
      targetField: "source",
      required: true,
      description: "Source or donor name",
    },
    {
      sourceField: "Source",
      targetField: "source",
      description: "Alternative field for source",
    },
    {
      sourceField: "AcquisitionMethod",
      targetField: "method",
      transform: "method",
      required: true,
      description: "Method of acquisition (gift, purchase, etc.)",
    },
    {
      sourceField: "Method",
      targetField: "method",
      transform: "method",
      description: "Alternative field for method",
    },
    {
      sourceField: "Cost",
      targetField: "cost",
      transform: "cost",
      description: "Purchase price or valuation",
    },
    {
      sourceField: "PurchasePrice",
      targetField: "cost",
      transform: "cost",
      description: "Alternative field for cost",
    },
    {
      sourceField: "Notes",
      targetField: "notes",
      description: "Additional notes about the accession",
    },
  ],
};

/**
 * TMS (The Museum System) field mapping template
 * TMS is an enterprise collections management system used by large museums
 */
export const TMS_TEMPLATE: ImportTemplate = {
  name: "TMS",
  description: "Import template for The Museum System (TMS)",
  system: "TMS",
  collectionMappings: [
    {
      sourceField: "ObjectNumber",
      targetField: "accessionNumber",
      required: true,
      description: "Primary object number",
    },
    {
      sourceField: "ObjectID",
      targetField: "accessionNumber",
      description: "Alternative field for object identifier",
    },
    {
      sourceField: "Title",
      targetField: "title",
      required: true,
      description: "Object title",
    },
    {
      sourceField: "AlternativeTitle",
      targetField: "alternativeTitle",
      description: "Alternative or subtitle",
    },
    {
      sourceField: "ObjectName",
      targetField: "objectName",
      description: "Object type name",
    },
    {
      sourceField: "Artist",
      targetField: "creator",
      description: "Artist or maker name",
    },
    {
      sourceField: "Maker",
      targetField: "creator",
      description: "Alternative field for maker",
    },
    {
      sourceField: "DisplayName",
      targetField: "creator",
      description: "Display name for artist/maker",
    },
    {
      sourceField: "Dated",
      targetField: "dateCreated",
      description: "Date or period when created",
    },
    {
      sourceField: "DateCreated",
      targetField: "dateCreated",
      description: "Alternative field for creation date",
    },
    {
      sourceField: "Medium",
      targetField: "materials",
      description: "Materials and medium",
    },
    {
      sourceField: "Materials",
      targetField: "materials",
      description: "Alternative field for materials",
    },
    {
      sourceField: "Dimensions",
      targetField: "dimensions",
      description: "Physical dimensions",
    },
    {
      sourceField: "DimensionDescription",
      targetField: "dimensions",
      description: "Alternative field for dimensions description",
    },
    {
      sourceField: "Height",
      targetField: "dimensionHeight",
      transform: "cost",
      description: "Height in cm (numeric)",
    },
    {
      sourceField: "Width",
      targetField: "dimensionWidth",
      transform: "cost",
      description: "Width in cm (numeric)",
    },
    {
      sourceField: "Depth",
      targetField: "dimensionDepth",
      transform: "cost",
      description: "Depth in cm (numeric)",
    },
    {
      sourceField: "Weight",
      targetField: "dimensionWeight",
      transform: "cost",
      description: "Weight in kg (numeric)",
    },
    {
      sourceField: "Description",
      targetField: "description",
      description: "Object description",
    },
    {
      sourceField: "Condition",
      targetField: "condition",
      description: "Condition assessment",
    },
    {
      sourceField: "ConditionDescription",
      targetField: "condition",
      description: "Alternative field for condition",
    },
    {
      sourceField: "CurrentLocation",
      targetField: "displayStatus",
      description: "Current location or status",
    },
    {
      sourceField: "Location",
      targetField: "displayStatus",
      description: "Alternative field for location",
    },
    {
      sourceField: "AcquisitionMethod",
      targetField: "acquisitionMethod",
      description: "Method of acquisition",
    },
    {
      sourceField: "CreditLine",
      targetField: "creditLine",
      description: "Credit line text",
    },
    {
      sourceField: "Credit",
      targetField: "creditLine",
      description: "Alternative field for credit",
    },
    {
      sourceField: "Department",
      targetField: "objectType",
      description: "Department or classification",
    },
    {
      sourceField: "Classification",
      targetField: "objectType",
      description: "Object classification or type",
    },
    {
      sourceField: "Culture",
      targetField: "culture",
      description: "Cultural origin or context",
    },
    {
      sourceField: "Period",
      targetField: "period",
      description: "Historical period",
    },
    {
      sourceField: "Dynasty",
      targetField: "period",
      description: "Alternative field for period/dynasty",
    },
    {
      sourceField: "Provenance",
      targetField: "provenance",
      description: "Provenance information",
    },
    {
      sourceField: "ProvenanceText",
      targetField: "provenance",
      description: "Alternative field for provenance",
    },
    {
      sourceField: "ExhibitionHistory",
      targetField: "exhibitionHistory",
      description: "Exhibition history",
    },
    {
      sourceField: "Inscriptions",
      targetField: "inscriptions",
      description: "Inscriptions and marks",
    },
    {
      sourceField: "MarkingsInscriptions",
      targetField: "inscriptions",
      description: "Alternative field for inscriptions",
    },
    {
      sourceField: "Technique",
      targetField: "technique",
      description: "Manufacturing technique",
    },
    {
      sourceField: "Tags",
      targetField: "tags",
      transform: "array",
      description: "Subject tags or keywords",
    },
    {
      sourceField: "Keywords",
      targetField: "tags",
      transform: "array",
      description: "Alternative field for keywords",
    },
  ],
  accessionMappings: [
    {
      sourceField: "AccessionNumber",
      targetField: "accessionNumber",
      required: true,
      description: "Accession number",
    },
    {
      sourceField: "AccessionLot",
      targetField: "accessionNumber",
      description: "Alternative field for accession number",
    },
    {
      sourceField: "AcquisitionDate",
      targetField: "dateReceived",
      transform: "date",
      required: true,
      description: "Date of acquisition",
    },
    {
      sourceField: "DateReceived",
      targetField: "dateReceived",
      transform: "date",
      description: "Alternative field for receipt date",
    },
    {
      sourceField: "AcquisitionSource",
      targetField: "source",
      required: true,
      description: "Source or donor",
    },
    {
      sourceField: "Source",
      targetField: "source",
      description: "Alternative field for source",
    },
    {
      sourceField: "Donor",
      targetField: "source",
      description: "Donor name",
    },
    {
      sourceField: "AcquisitionMethod",
      targetField: "method",
      transform: "method",
      required: true,
      description: "Acquisition method",
    },
    {
      sourceField: "Method",
      targetField: "method",
      transform: "method",
      description: "Alternative field for method",
    },
    {
      sourceField: "PurchasePrice",
      targetField: "cost",
      transform: "cost",
      description: "Purchase price",
    },
    {
      sourceField: "Cost",
      targetField: "cost",
      transform: "cost",
      description: "Alternative field for cost",
    },
    {
      sourceField: "Value",
      targetField: "cost",
      transform: "cost",
      description: "Valuation amount",
    },
    {
      sourceField: "Notes",
      targetField: "notes",
      description: "Accession notes",
    },
    {
      sourceField: "AcquisitionNotes",
      targetField: "notes",
      description: "Alternative field for notes",
    },
  ],
};

/**
 * Gets an import template by name
 * @param templateName - Name of the template (case-insensitive)
 * @returns Import template or undefined if not found
 */
export function getTemplate(templateName: string): ImportTemplate | undefined {
  const normalized = templateName.toLowerCase().trim();

  switch (normalized) {
    case "pastperfect":
    case "past perfect":
    case "past-perfect":
      return PASTPERFECT_TEMPLATE;
    case "tms":
    case "the museum system":
      return TMS_TEMPLATE;
    default:
      return undefined;
  }
}

/**
 * Lists all available templates
 * @returns Array of available import templates
 */
export function listTemplates(): ImportTemplate[] {
  return [PASTPERFECT_TEMPLATE, TMS_TEMPLATE];
}

/**
 * Applies a field mapping template to transform source data
 * @param sourceData - Raw data from legacy system
 * @param mappings - Field mappings to apply
 * @returns Transformed data ready for import
 */
export function applyMappings(
  sourceData: Record<string, unknown>,
  mappings: FieldMapping[],
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const mapping of mappings) {
    const sourceValue = sourceData[mapping.sourceField];

    // Skip if source field is missing and not required
    if (sourceValue === undefined || sourceValue === null) {
      if (mapping.required) {
        throw new Error(`Required field ${mapping.sourceField} is missing`);
      }
      continue;
    }

    // Apply transformation if specified
    const transformedValue = mapping.transform
      ? applyTransform(sourceValue, mapping.transform)
      : sourceValue;

    // Set the target field value - use setProperty helper to avoid strict mode issues
    setProperty(result, mapping.targetField, transformedValue);
  }

  return result;
}

/**
 * Helper function to set a property on a Record<string, unknown>
 * This avoids TypeScript strict mode issues with unknown values
 */
function setProperty(
  obj: Record<string, unknown>,
  key: string,
  value: unknown,
): void {
  obj[key] = value;
}

/**
 * Applies a transformation to a value
 * @param value - Value to transform
 * @param transform - Transformation type
 * @returns Transformed value
 */
function applyTransform(
  value: unknown,
  transform: "date" | "cost" | "method" | "array" | "dimensions",
): unknown {
  if (value === null || value === undefined) return value;

  switch (transform) {
    case "date":
      return parseDate(String(value));
    case "cost":
      return parseCost(String(value));
    case "method":
      return parseMethod(String(value));
    case "array":
      return parseArray(value);
    case "dimensions":
      return String(value);
    default:
      return value;
  }
}

/**
 * Parses a date string to timestamp
 * @param value - Date string to parse
 * @returns Timestamp in milliseconds
 */
function parseDate(value: string): number {
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    return Date.now();
  }
  return parsed;
}

/**
 * Parses a cost/price string to number
 * @param value - Cost string (may include currency symbols)
 * @returns Numeric value or undefined
 */
function parseCost(value: string): number | undefined {
  if (!value || value.trim() === "") return undefined;
  const cleaned = value.replace(/[^0-9.-]/g, "");
  const num = Number.parseFloat(cleaned);
  return Number.isNaN(num) ? undefined : num;
}

/**
 * Parses an acquisition method string to standardized value
 * @param value - Method string
 * @returns Standardized method value
 */
function parseMethod(value: string): string {
  const normalized = value.toLowerCase().trim();
  const validMethods = [
    "purchase",
    "gift",
    "loan",
    "transfer",
    "donation",
    "bequest",
    "other",
  ];

  // Direct match - return as-is if it's already a valid method
  if (validMethods.includes(normalized)) {
    return normalized;
  }

  // Fuzzy matching for common variations
  // Note: "donation" is already handled by direct match above
  // "gift" variations that aren't exactly "gift"
  if (normalized.includes("donat")) {
    return "donation";
  }
  if (normalized.includes("purchase") || normalized.includes("buy")) {
    return "purchase";
  }
  if (normalized.includes("loan")) {
    return "loan";
  }
  if (normalized.includes("transfer")) {
    return "transfer";
  }
  if (normalized.includes("bequest") || normalized.includes("inherit")) {
    return "bequest";
  }

  return "other";
}

/**
 * Parses a value into an array
 * @param value - Value to parse (may be string, array, or other)
 * @returns Array of strings
 */
function parseArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map(String);
  }

  if (typeof value === "string") {
    // Split on common delimiters
    const delimiters = [";", ",", "|", "\n"];
    for (const delimiter of delimiters) {
      if (value.includes(delimiter)) {
        return value.split(delimiter).flatMap((item) => {
          const trimmedItem = item.trim();
          return trimmedItem.length > 0 ? [trimmedItem] : [];
        });
      }
    }
    // Return single-item array if no delimiters found
    return [value.trim()];
  }

  return [String(value)];
}

/**
 * Validates that required mappings are present in source data
 * @param sourceData - Source data to validate
 * @param mappings - Field mappings with required flags
 * @returns Validation result with errors if any
 */
export function validateMappings(
  sourceData: Record<string, unknown>,
  mappings: FieldMapping[],
): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  for (const mapping of mappings) {
    if (mapping.required) {
      const value = sourceData[mapping.sourceField];
      if (value === undefined || value === null || value === "") {
        errors.push(
          `Required field "${mapping.sourceField}" is missing or empty`,
        );
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Finds the best matching field mapping for a source field
 * @param sourceField - Source field name
 * @param mappings - Available field mappings
 * @returns Best matching field mapping or undefined
 */
export function findMapping(
  sourceField: string,
  mappings: FieldMapping[],
): FieldMapping | undefined {
  const normalized = sourceField.toLowerCase().trim();

  // Return undefined for empty strings
  if (normalized === "") return undefined;

  // Try exact match first (case-insensitive)
  const exactMatch = mappings.find(
    (m) => m.sourceField.toLowerCase() === normalized,
  );
  if (exactMatch) return exactMatch;

  // Try partial match
  const partialMatch = mappings.find(
    (m) =>
      m.sourceField.toLowerCase().includes(normalized) ||
      normalized.includes(m.sourceField.toLowerCase()),
  );
  return partialMatch;
}
