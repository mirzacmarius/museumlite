/**
 * Dublin Core metadata mapper
 *
 * Converts collection objects to Dublin Core metadata standard format.
 * Dublin Core is a widely-used metadata schema for describing resources,
 * particularly useful for library catalog integration and interoperability.
 *
 * Reference: https://www.dublincore.org/specifications/dublin-core/dcmi-terms/
 */

import type { Doc } from "../_generated/dataModel";
import { distinctSubjectTerms } from "./objectDescription";
import { formatEdtf, parseEdtf, readDateText } from "./productionDates";
import {
  normalizeRightsStatement,
  type RightsStatementUri,
  rightsStatementInEffect,
} from "./rightsStatements";

/**
 * Dublin Core metadata record with 15 core elements
 */
export interface DublinCoreMetadata {
  /** A name given to the resource (dc:title) */
  title: string;
  /** An entity primarily responsible for making the resource (dc:creator) */
  creator?: string;
  /** The topic of the resource (dc:subject) */
  subject?: string | string[];
  /** An account of the resource (dc:description) */
  description?: string;
  /** An entity responsible for making the resource available (dc:publisher) */
  publisher?: string;
  /** An entity responsible for making contributions to the resource (dc:contributor) */
  contributor?: string | string[];
  /** A point or period of time associated with the resource (dc:date) */
  date?: string | string[];
  /** The nature or genre of the resource (dc:type) */
  type?: string;
  /** The file format, physical medium, or dimensions of the resource (dc:format) */
  format?: string;
  /** An unambiguous reference to the resource (dc:identifier) */
  identifier: string;
  /** A related resource from which the described resource is derived (dc:source) */
  source?: string;
  /** A language of the resource (dc:language) */
  language?: string;
  /** A related resource (dc:relation) */
  relation?: string | string[];
  /** The spatial or temporal topic of the resource (dc:coverage) */
  coverage?: string;
  /** Information about rights held in and over the resource (dc:rights) */
  rights?: string | string[];
}

/** One value as itself, several as a list, none as undefined. */
function oneOrMany(values: string[]): string | string[] | undefined {
  if (values.length === 0) return undefined;
  return values.length === 1 ? values[0] : values;
}

function valuesOf(value: string | string[] | undefined) {
  return Array.isArray(value) ? value : value ? [value] : [];
}

/**
 * dc:date for the date made: the text as written (the EDTF staff entered when
 * there is no text), followed by that EDTF when the first value doesn't read
 * as it. EDTF "1910-11" is November 1910, but read as text it is 1910 to
 * 1911, so it is written twice.
 */
function dublinCoreDates(
  collection: Partial<Doc<"collections">>,
): string | string[] | undefined {
  const text = collection.dateCreated?.trim() || undefined;
  const entered = collection.dateCreatedEdtf
    ? parseEdtf(collection.dateCreatedEdtf)
    : null;
  if (!entered) return text;
  const edtf = formatEdtf(entered);
  const first = text ?? edtf;
  const reading = readDateText(first);
  return reading && formatEdtf(reading) === edtf ? first : [first, edtf];
}

/**
 * The date made from dc:date values: the first is the text as written. The
 * first later value in EDTF becomes the structured date unless the text
 * already reads as that same EDTF, which is when this export leaves it out.
 */
function datesFromDublinCore(date: string | string[] | undefined) {
  const [text, ...rest] = Array.isArray(date) ? date : date ? [date] : [];
  const entered = rest
    .map((value) => parseEdtf(value))
    .find((value) => value !== null);
  if (!entered) return { dateCreated: text };
  const edtf = formatEdtf(entered);
  const reading = readDateText(text);
  if (reading && formatEdtf(reading) === edtf) return { dateCreated: text };
  return { dateCreated: text, dateCreatedEdtf: edtf };
}

/**
 * Converts a collection object to Dublin Core metadata format
 * @param collection - Collection document from database
 * @param options - Optional configuration for metadata mapping
 * @returns Dublin Core metadata record
 */
export function toDublinCore(
  collection: Partial<Doc<"collections">>,
  options: {
    organizationName?: string;
    includeAlternateIdentifiers?: boolean;
    language?: string;
    /** The Organization's statement for Objects without their own. */
    defaultRightsStatement?: RightsStatementUri;
  } = {},
): DublinCoreMetadata {
  const {
    organizationName,
    includeAlternateIdentifiers = false,
    language,
    defaultRightsStatement,
  } = options;

  // Build identifier (primary accession number)
  let identifier = collection.accessionNumber || "";

  // Include alternate identifiers if requested
  if (
    includeAlternateIdentifiers &&
    collection.alternateAccessionNumbers?.length
  ) {
    identifier = [identifier, ...collection.alternateAccessionNumbers].join(
      "; ",
    );
  }

  // Subject terms first, then tags, each term once
  const subject = oneOrMany(
    distinctSubjectTerms([
      ...(collection.subjects ?? []),
      ...(collection.tags ?? []),
    ]),
  );

  // Build contributor from donors
  const contributor = collection.donated_by?.length
    ? collection.donated_by.length === 1
      ? collection.donated_by[0]
      : collection.donated_by
    : undefined;

  // Build format from materials and technique
  const formatParts: string[] = [];
  if (collection.materials) formatParts.push(collection.materials);
  if (collection.technique) formatParts.push(collection.technique);
  if (collection.dimensions) formatParts.push(collection.dimensions);
  const format = formatParts.length > 0 ? formatParts.join("; ") : undefined;

  // Build coverage from culture and period
  const coverageParts: string[] = [];
  if (collection.culture) coverageParts.push(collection.culture);
  if (collection.period) coverageParts.push(collection.period);
  const coverage =
    coverageParts.length > 0 ? coverageParts.join("; ") : undefined;

  // Build relation from links
  const relation = collection.links?.length
    ? collection.links.length === 1
      ? collection.links[0]?.url
      : collection.links.map((link) => link.url)
    : undefined;

  // The statement in effect as a URI first, then the credit line and legal
  // restrictions as text
  let creditText = collection.creditLine;
  if (collection.legalRestrictions) {
    creditText = creditText
      ? `${creditText}; Legal restrictions apply`
      : "Legal restrictions apply";
  }
  const statement = rightsStatementInEffect(
    collection.rightsStatement,
    defaultRightsStatement,
  );
  const rights = oneOrMany(
    [statement, creditText].filter((value): value is string => !!value),
  );

  return {
    title: collection.title || "Untitled",
    creator: collection.creator,
    subject,
    description: collection.description,
    publisher: organizationName,
    contributor,
    date: dublinCoreDates(collection),
    type: collection.objectType || collection.objectName,
    format,
    identifier,
    source: collection.provenance,
    language: language,
    relation,
    coverage,
    rights,
  };
}

/**
 * Converts Dublin Core metadata back to collection fields
 * @param metadata - Dublin Core metadata record
 * @returns Partial collection object
 */
export function fromDublinCore(
  metadata: DublinCoreMetadata,
): Partial<Doc<"collections">> {
  // dc:subject holds subject terms; an export writes tags there too
  const subjects = distinctSubjectTerms(valuesOf(metadata.subject));

  // A dc:rights value naming a rights statement is kept as one, as entered;
  // the rest is the credit line
  const rightsValues = valuesOf(metadata.rights);
  const statementValue = rightsValues.find(
    (value) => normalizeRightsStatement(value) !== undefined,
  );
  const creditValues = rightsValues.filter((value) => value !== statementValue);

  // Parse contributor back to donated_by
  const donated_by = metadata.contributor
    ? Array.isArray(metadata.contributor)
      ? metadata.contributor
      : [metadata.contributor]
    : undefined;

  // Parse format to extract materials, technique, dimensions
  let materials: string | undefined;
  let technique: string | undefined;
  let dimensions: string | undefined;

  if (metadata.format) {
    const formatParts = metadata.format.split(";").map((s) => s.trim());
    // Simple heuristic: first part is materials, second is technique, third is dimensions
    if (formatParts.length >= 1) materials = formatParts[0];
    if (formatParts.length >= 2) technique = formatParts[1];
    if (formatParts.length >= 3) dimensions = formatParts[2];
  }

  // Parse coverage to extract culture and period
  let culture: string | undefined;
  let period: string | undefined;

  if (metadata.coverage) {
    const coverageParts = metadata.coverage.split(";").map((s) => s.trim());
    if (coverageParts.length >= 1) culture = coverageParts[0];
    if (coverageParts.length >= 2) period = coverageParts[1];
  }

  // Parse relation back to links
  const links = metadata.relation
    ? Array.isArray(metadata.relation)
      ? metadata.relation.map((url) => ({ url }))
      : [{ url: metadata.relation }]
    : undefined;

  // Parse identifier to extract primary and alternate accession numbers
  const identifiers = metadata.identifier.split(";").map((s) => s.trim());
  const accessionNumber = identifiers[0] || metadata.identifier;
  const alternateAccessionNumbers =
    identifiers.length > 1 ? identifiers.slice(1) : undefined;

  return {
    title: metadata.title,
    creator: metadata.creator,
    subjects: subjects.length > 0 ? subjects : undefined,
    description: metadata.description,
    donated_by,
    ...datesFromDublinCore(metadata.date),
    objectType: metadata.type,
    materials,
    technique,
    dimensions,
    accessionNumber,
    alternateAccessionNumbers,
    provenance: metadata.source,
    culture,
    period,
    links,
    creditLine: creditValues.length > 0 ? creditValues.join("; ") : undefined,
    rightsStatement: normalizeRightsStatement(statementValue),
  };
}

/**
 * Converts Dublin Core metadata to XML format (OAI-DC)
 * @param metadata - Dublin Core metadata record
 * @param options - Optional XML formatting options
 * @returns XML string in OAI-DC format
 */
export function toDublinCoreXML(
  metadata: DublinCoreMetadata,
  options: {
    pretty?: boolean;
    indent?: string;
  } = {},
): string {
  const { pretty = true, indent = "  " } = options;

  const lines: string[] = [];
  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push(
    '<oai_dc:dc xmlns:oai_dc="http://www.openarchives.org/OAI/2.0/oai_dc/"',
  );
  lines.push('          xmlns:dc="http://purl.org/dc/elements/1.1/"');
  lines.push('          xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"');
  lines.push(
    '          xsi:schemaLocation="http://www.openarchives.org/OAI/2.0/oai_dc/ http://www.openarchives.org/OAI/2.0/oai_dc.xsd">',
  );

  const addElement = (name: string, value: string | string[] | undefined) => {
    if (!value) return;

    if (Array.isArray(value)) {
      for (const item of value) {
        lines.push(`${indent}<dc:${name}>${escapeXml(item)}</dc:${name}>`);
      }
    } else {
      lines.push(`${indent}<dc:${name}>${escapeXml(value)}</dc:${name}>`);
    }
  };

  addElement("title", metadata.title);
  addElement("creator", metadata.creator);
  addElement("subject", metadata.subject);
  addElement("description", metadata.description);
  addElement("publisher", metadata.publisher);
  addElement("contributor", metadata.contributor);
  addElement("date", metadata.date);
  addElement("type", metadata.type);
  addElement("format", metadata.format);
  addElement("identifier", metadata.identifier);
  addElement("source", metadata.source);
  addElement("language", metadata.language);
  addElement("relation", metadata.relation);
  addElement("coverage", metadata.coverage);
  addElement("rights", metadata.rights);

  lines.push("</oai_dc:dc>");

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
 * Decodes XML entities produced by {@link escapeXml}.
 */
function decodeXml(str: string): string {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function extractOaiDcBlocks(xml: string): string[] {
  const blocks: string[] = [];
  const recordRegex = /<oai_dc:dc[\s\S]*?<\/oai_dc:dc>/g;
  let match = recordRegex.exec(xml);
  while (match) {
    blocks.push(match[0]);
    match = recordRegex.exec(xml);
  }

  if (blocks.length > 0) {
    return blocks;
  }

  return xml.includes("<dc:") ? [xml] : [];
}

function parseOaiDcBlock(block: string): DublinCoreMetadata | null {
  const fields: Record<string, string[]> = {};
  const elementRegex = /<dc:(\w+)>([\s\S]*?)<\/dc:\1>/g;
  let match = elementRegex.exec(block);
  while (match) {
    const name = match[1];
    const rawValue = match[2];
    if (!name || rawValue === undefined) {
      match = elementRegex.exec(block);
      continue;
    }
    const value = decodeXml(rawValue.trim());
    if (!fields[name]) {
      fields[name] = [];
    }
    fields[name].push(value);
    match = elementRegex.exec(block);
  }

  const title = fields.title?.[0];
  const identifier = fields.identifier?.[0];
  if (!title || !identifier) {
    return null;
  }

  const getScalarField = (name: string): string | undefined => {
    const values = fields[name];
    return values?.[0];
  };

  const getArrayField = (name: string): string | string[] | undefined => {
    const values = fields[name];
    if (!values?.length) {
      return undefined;
    }
    return values.length === 1 ? values[0] : values;
  };

  return {
    title,
    identifier,
    creator: getScalarField("creator"),
    subject: getArrayField("subject"),
    description: getScalarField("description"),
    publisher: getScalarField("publisher"),
    contributor: getArrayField("contributor"),
    date: getArrayField("date"),
    type: getScalarField("type"),
    format: getScalarField("format"),
    source: getScalarField("source"),
    language: getScalarField("language"),
    relation: getArrayField("relation"),
    coverage: getScalarField("coverage"),
    rights: getArrayField("rights"),
  };
}

/**
 * Parses Dublin Core XML (OAI-DC) into metadata records.
 *
 * Accepts single-record documents and multi-record wrappers produced by
 * {@link toDublinCoreXML} / export. Malformed or empty input returns `[]`.
 */
export function fromDublinCoreXML(xml: string): DublinCoreMetadata[] {
  if (!xml.trim()) {
    return [];
  }

  const blocks = extractOaiDcBlocks(xml);
  if (blocks.length === 0) {
    return [];
  }

  const records: DublinCoreMetadata[] = [];
  for (const block of blocks) {
    const metadata = parseOaiDcBlock(block);
    if (metadata) {
      records.push(metadata);
    }
  }

  return records;
}

/**
 * Converts multiple collections to Dublin Core metadata records
 * @param collections - Array of collection documents
 * @param options - Optional configuration for metadata mapping
 * @returns Array of Dublin Core metadata records
 */
export function collectionsToDublinCore(
  collections: Partial<Doc<"collections">>[],
  options: {
    organizationName?: string;
    includeAlternateIdentifiers?: boolean;
    language?: string;
    defaultRightsStatement?: RightsStatementUri;
  } = {},
): DublinCoreMetadata[] {
  return collections.map((collection) => toDublinCore(collection, options));
}
