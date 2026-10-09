/**
 * SPECTRUM standard mapper
 *
 * Converts collection and accession objects to SPECTRUM format.
 * SPECTRUM is the UK museum documentation standard for managing collections.
 *
 * Reference: https://collectionstrust.org.uk/spectrum/
 *
 * Key SPECTRUM procedures supported:
 * - Object Entry (accessions)
 * - Object Cataloguing (collections)
 * - Location and Movement Control
 * - Condition Checking and Technical Assessment
 */

import type { Doc } from "../_generated/dataModel";

/**
 * SPECTRUM Object Entry record (Accession)
 * Supports the Object Entry procedure for acquiring objects
 */
export interface SpectrumObjectEntry {
  /** Unique entry number (Entry number) */
  entryNumber: string;
  /** Date of entry (Entry date) */
  entryDate: string;
  /** Method of entry - e.g., purchase, gift, loan, bequest (Entry method) */
  entryMethod:
    | "purchase"
    | "gift"
    | "loan"
    | "transfer"
    | "donation"
    | "bequest"
    | "other";
  /** Person or organization from whom the object was acquired (Current owner/depositor) */
  depositor?: string;
  /** Reason for entry (Entry reason) */
  entryReason?: string;
  /** Cost or value (Acquisition cost) */
  cost?: number;
  /** Entry notes */
  notes?: string;
  /** Approval status */
  approvalStatus?: "pending" | "approved" | "rejected" | "withdrawn";
  /** Date approved (if applicable) */
  dateApproved?: string;
}

/**
 * SPECTRUM Object Cataloguing record (Collection)
 * Supports the Object Cataloguing procedure for documenting collections
 */
export interface SpectrumObjectRecord {
  /** Unique object number/accession number (Object number) */
  objectNumber: string;
  /** Alternative/previous object numbers */
  otherNumbers?: string[];
  /** Simple name or classification (Object name) */
  objectName?: string;
  /** Title or descriptive name (Title) */
  title: string;
  /** Full description (Description) */
  description?: string;
  /** Person or organization who made the object (Production person/organization) */
  maker?: string;
  /** Date of creation (Production date) */
  dateCreated?: string;
  /** Place of creation (Production place) */
  productionPlace?: string;
  /** Cultural context (Culture) */
  culture?: string;
  /** Historical period (Period) */
  period?: string;
  /** Material(s) used (Material) */
  material?: string;
  /** Technique used (Production technique) */
  technique?: string;
  /** Dimensions - free text or structured (Dimension) */
  dimension?: string;
  /** Structured dimensions */
  dimensionHeight?: number;
  dimensionWidth?: number;
  dimensionDepth?: number;
  dimensionUnit?: string;
  /** Weight */
  weight?: number;
  weightUnit?: string;
  /** Inscriptions and marks (Inscription) */
  inscription?: string;
  /** Current condition (Condition) */
  condition?: string;
  /** Current location (Current location) */
  currentLocation?: string;
  /** Acquisition method */
  acquisitionMethod?: string;
  /** Provenance/ownership history (Provenance) */
  provenance?: string;
  /** Exhibition history (Exhibition history) */
  exhibitionHistory?: string;
  /** Credit line */
  creditLine?: string;
  /** Object type classification */
  objectType?: string;
  /** Tags/keywords for categorization */
  keywords?: string[];
  /** Legal restrictions flag */
  legalRestrictions?: boolean;
  /** Public visibility status */
  publiclyVisible?: boolean;
}

/**
 * Converts an accession to SPECTRUM Object Entry format
 * @param accession - Accession document from database
 * @returns SPECTRUM Object Entry record
 */
export function accessionToSpectrumEntry(
  accession: Partial<Doc<"accessions">>,
): SpectrumObjectEntry {
  return {
    entryNumber: accession.accessionNumber || "",
    entryDate: accession.dateReceived
      ? new Date(accession.dateReceived).toISOString()
      : new Date().toISOString(),
    entryMethod: accession.method || "other",
    depositor: accession.source,
    entryReason: accession.notes,
    cost: accession.cost,
    notes: accession.notes,
    approvalStatus: accession.status,
    dateApproved: accession.approvedAt
      ? new Date(accession.approvedAt).toISOString()
      : undefined,
  };
}

/**
 * Converts SPECTRUM Object Entry back to accession fields
 * @param entry - SPECTRUM Object Entry record
 * @returns Partial accession object
 */
export function spectrumEntryToAccession(
  entry: SpectrumObjectEntry,
): Partial<Doc<"accessions">> {
  return {
    accessionNumber: entry.entryNumber,
    dateReceived: new Date(entry.entryDate).getTime(),
    method: entry.entryMethod,
    source: entry.depositor || "",
    cost: entry.cost,
    notes: entry.notes,
    status: entry.approvalStatus || "pending",
    approvedAt: entry.dateApproved
      ? new Date(entry.dateApproved).getTime()
      : undefined,
  };
}

/**
 * Converts a collection to SPECTRUM Object Record format
 * @param collection - Collection document from database
 * @param options - Optional configuration for SPECTRUM mapping
 * @returns SPECTRUM Object Record
 */
export function collectionToSpectrum(
  collection: Partial<Doc<"collections">>,
  options: {
    includeAlternateNumbers?: boolean;
  } = {},
): SpectrumObjectRecord {
  const { includeAlternateNumbers = false } = options;

  // Build other numbers from alternate accession numbers
  const otherNumbers = includeAlternateNumbers
    ? collection.alternateAccessionNumbers
    : undefined;

  // Build keywords from tags
  const keywords = collection.tags;

  return {
    objectNumber: collection.accessionNumber || "",
    otherNumbers,
    objectName: collection.objectName,
    title: collection.title || "Untitled",
    description: collection.description,
    maker: collection.creator,
    dateCreated: collection.dateCreated,
    productionPlace: undefined, // Not in current schema
    culture: collection.culture,
    period: collection.period,
    material: collection.materials,
    technique: collection.technique,
    dimension: collection.dimensions,
    dimensionHeight: collection.dimensionHeight,
    dimensionWidth: collection.dimensionWidth,
    dimensionDepth: collection.dimensionDepth,
    dimensionUnit: collection.dimensionUnit,
    weight: collection.dimensionWeight,
    weightUnit: collection.weightUnit,
    inscription: collection.inscriptions,
    condition: collection.condition,
    currentLocation: undefined, // Would need to resolve location ID
    acquisitionMethod: collection.acquisitionMethod,
    provenance: collection.provenance,
    exhibitionHistory: collection.exhibitionHistory,
    creditLine: collection.creditLine,
    objectType: collection.objectType,
    keywords,
    legalRestrictions: collection.legalRestrictions,
    publiclyVisible: collection.isPubliclyVisible,
  };
}

/**
 * Converts SPECTRUM Object Record back to collection fields
 * @param record - SPECTRUM Object Record
 * @returns Partial collection object
 */
export function spectrumToCollection(
  record: SpectrumObjectRecord,
): Partial<Doc<"collections">> {
  // Parse other numbers to alternate accession numbers
  const alternateAccessionNumbers =
    record.otherNumbers && record.otherNumbers.length > 0
      ? record.otherNumbers
      : undefined;

  return {
    accessionNumber: record.objectNumber,
    alternateAccessionNumbers,
    objectName: record.objectName,
    title: record.title,
    description: record.description,
    creator: record.maker,
    dateCreated: record.dateCreated,
    culture: record.culture,
    period: record.period,
    materials: record.material,
    technique: record.technique,
    dimensions: record.dimension,
    dimensionHeight: record.dimensionHeight,
    dimensionWidth: record.dimensionWidth,
    dimensionDepth: record.dimensionDepth,
    dimensionUnit: record.dimensionUnit,
    dimensionWeight: record.weight,
    weightUnit: record.weightUnit,
    inscriptions: record.inscription,
    condition: record.condition,
    acquisitionMethod: record.acquisitionMethod,
    provenance: record.provenance,
    exhibitionHistory: record.exhibitionHistory,
    creditLine: record.creditLine,
    objectType: record.objectType,
    tags: record.keywords,
    legalRestrictions: record.legalRestrictions,
    isPubliclyVisible: record.publiclyVisible,
  };
}

/**
 * Converts SPECTRUM Object Record to XML format
 * @param record - SPECTRUM Object Record
 * @param options - Optional XML formatting options
 * @returns XML string in SPECTRUM format
 */
export function toSpectrumXML(
  record: SpectrumObjectRecord,
  options: {
    pretty?: boolean;
    indent?: string;
  } = {},
): string {
  const { pretty = true, indent = "  " } = options;

  const lines: string[] = [];
  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push(
    '<spectrum:object xmlns:spectrum="http://www.collectionstrust.org.uk/spectrum/object">',
  );

  const addElement = (
    name: string,
    value: string | number | boolean | undefined,
  ) => {
    if (value === undefined || value === null) return;

    const strValue = String(value);
    lines.push(`${indent}<${name}>${escapeXml(strValue)}</${name}>`);
  };

  const addArrayElement = (name: string, values: string[] | undefined) => {
    if (!values || values.length === 0) return;

    for (const value of values) {
      lines.push(`${indent}<${name}>${escapeXml(value)}</${name}>`);
    }
  };

  // SPECTRUM Object Cataloguing fields
  addElement("objectNumber", record.objectNumber);
  addArrayElement("otherNumber", record.otherNumbers);
  addElement("objectName", record.objectName);
  addElement("title", record.title);
  addElement("description", record.description);
  addElement("maker", record.maker);
  addElement("dateCreated", record.dateCreated);
  addElement("productionPlace", record.productionPlace);
  addElement("culture", record.culture);
  addElement("period", record.period);
  addElement("material", record.material);
  addElement("technique", record.technique);
  addElement("dimension", record.dimension);

  // Structured dimensions
  if (
    record.dimensionHeight ||
    record.dimensionWidth ||
    record.dimensionDepth
  ) {
    lines.push(`${indent}<dimensions>`);
    if (record.dimensionHeight) {
      lines.push(
        `${indent}${indent}<height unit="${escapeXml(record.dimensionUnit || "cm")}">${record.dimensionHeight}</height>`,
      );
    }
    if (record.dimensionWidth) {
      lines.push(
        `${indent}${indent}<width unit="${escapeXml(record.dimensionUnit || "cm")}">${record.dimensionWidth}</width>`,
      );
    }
    if (record.dimensionDepth) {
      lines.push(
        `${indent}${indent}<depth unit="${escapeXml(record.dimensionUnit || "cm")}">${record.dimensionDepth}</depth>`,
      );
    }
    lines.push(`${indent}</dimensions>`);
  }

  if (record.weight) {
    lines.push(
      `${indent}<weight unit="${escapeXml(record.weightUnit || "kg")}">${record.weight}</weight>`,
    );
  }

  addElement("inscription", record.inscription);
  addElement("condition", record.condition);
  addElement("currentLocation", record.currentLocation);
  addElement("acquisitionMethod", record.acquisitionMethod);
  addElement("provenance", record.provenance);
  addElement("exhibitionHistory", record.exhibitionHistory);
  addElement("creditLine", record.creditLine);
  addElement("objectType", record.objectType);
  addArrayElement("keyword", record.keywords);
  addElement("legalRestrictions", record.legalRestrictions);
  addElement("publiclyVisible", record.publiclyVisible);

  lines.push("</spectrum:object>");

  return pretty ? lines.join("\n") : lines.join("");
}

/**
 * Converts SPECTRUM Object Entry to XML format
 * @param entry - SPECTRUM Object Entry record
 * @param options - Optional XML formatting options
 * @returns XML string in SPECTRUM format
 */
export function entryToSpectrumXML(
  entry: SpectrumObjectEntry,
  options: {
    pretty?: boolean;
    indent?: string;
  } = {},
): string {
  const { pretty = true, indent = "  " } = options;

  const lines: string[] = [];
  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push(
    '<spectrum:entry xmlns:spectrum="http://www.collectionstrust.org.uk/spectrum/entry">',
  );

  const addElement = (name: string, value: string | number | undefined) => {
    if (value === undefined || value === null) return;

    const strValue = String(value);
    lines.push(`${indent}<${name}>${escapeXml(strValue)}</${name}>`);
  };

  // SPECTRUM Object Entry fields
  addElement("entryNumber", entry.entryNumber);
  addElement("entryDate", entry.entryDate);
  addElement("entryMethod", entry.entryMethod);
  addElement("depositor", entry.depositor);
  addElement("entryReason", entry.entryReason);
  addElement("cost", entry.cost);
  addElement("notes", entry.notes);
  addElement("approvalStatus", entry.approvalStatus);
  addElement("dateApproved", entry.dateApproved);

  lines.push("</spectrum:entry>");

  return pretty ? lines.join("\n") : lines.join("");
}

/**
 * Escapes special XML characters
 * @param str - String to escape
 * @returns XML-safe string
 */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Converts multiple collections to SPECTRUM Object Records
 * @param collections - Array of collection documents
 * @param options - Optional configuration for SPECTRUM mapping
 * @returns Array of SPECTRUM Object Records
 */
export function collectionsToSpectrum(
  collections: Partial<Doc<"collections">>[],
  options: {
    includeAlternateNumbers?: boolean;
  } = {},
): SpectrumObjectRecord[] {
  return collections.map((collection) =>
    collectionToSpectrum(collection, options),
  );
}

/**
 * Converts multiple accessions to SPECTRUM Object Entry records
 * @param accessions - Array of accession documents
 * @returns Array of SPECTRUM Object Entry records
 */
export function accessionsToSpectrumEntries(
  accessions: Partial<Doc<"accessions">>[],
): SpectrumObjectEntry[] {
  return accessions.map((accession) => accessionToSpectrumEntry(accession));
}
