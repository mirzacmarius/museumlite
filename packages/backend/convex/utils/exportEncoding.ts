import type { Infer } from "convex/values";
import {
  type exportColumnType,
  type exportSource,
  MAX_EXPORT_BYTES,
} from "./exportContract";
import {
  REGISTER_COLUMNS,
  REGISTER_CONSISTENCY,
  REGISTER_GENERATOR,
  REGISTER_PROFILE_VERSION,
} from "./registerProfiles";

export interface ExportColumn {
  name: string;
  type: Infer<typeof exportColumnType>;
}
type ExportSource = Infer<typeof exportSource>;
export const objectColumns: ExportColumn[] = [
  ...[
    "_id",
    "accessionNumber",
    "title",
    "alternativeTitle",
    "creator",
    "objectType",
    "objectName",
    "culture",
    "period",
    "dateCreated",
    "materials",
    "technique",
    "dimensions",
    "description",
    "condition",
    "provenance",
    "status",
    "currentLocationId",
    "collectionGroupId",
  ].map((name) => ({ name, type: "text" as const })),
  ...[
    "dimensionHeight",
    "dimensionWidth",
    "dimensionDepth",
    "dimensionWeight",
  ].map((name) => ({ name, type: "number" as const })),
  ...["catalogedAt", "lastModifiedAt", "capturedAt", "_creationTime"].map(
    (name) => ({ name, type: "utcEpochMs" as const }),
  ),
  { name: "record", type: "json" },
];
export const auditColumns: ExportColumn[] = [
  ...[
    "_id",
    "action",
    "entityType",
    "entityId",
    "userId",
    "userName",
    "userEmail",
    "evidenceStatus",
    "objectId",
    "caseId",
    "correctionOf",
    "correctionReason",
  ].map((name) => ({ name, type: "text" as const })),
  ...["timestamp", "capturedAt"].map((name) => ({
    name,
    type: "utcEpochMs" as const,
  })),
  ...["changes", "actorSnapshot", "subjectSnapshot"].map((name) => ({
    name,
    type: "json" as const,
  })),
];
export function protectSpreadsheetText(raw: string) {
  let candidate = raw.trimStart();
  while (candidate.length && candidate.charCodeAt(0) < 32)
    candidate = candidate.slice(1).trimStart();
  return /^[=+@-]/.test(candidate) || /^[\t\r\n]/.test(raw) ? `'${raw}` : raw;
}
/**
 * Register text is reversible: a leading apostrophe is added when the value
 * starts with a formula prefix or an apostrophe, so parsers strip exactly one.
 */
export function protectRegisterText(raw: string) {
  return raw.startsWith("'") ? `'${raw}` : protectSpreadsheetText(raw);
}
function quoted(text: string) {
  return `"${text.replace(/"/g, '""')}"`;
}
function csvCell(value: unknown, type: ExportColumn["type"]) {
  if (value === undefined || value === null) return "";
  if (type === "number" || type === "utcEpochMs") {
    if (typeof value !== "number" || !Number.isFinite(value))
      throw new Error("Invalid numeric export cell");
    return String(value);
  }
  const raw = type === "json" ? JSON.stringify(value) : String(value);
  return quoted(protectSpreadsheetText(raw));
}
function registerCsvCell(value: unknown, type: ExportColumn["type"]) {
  if (value === undefined || value === null) return "";
  if (type === "boolean") {
    if (typeof value !== "boolean")
      throw new Error("Invalid boolean export cell");
    return value ? "true" : "false";
  }
  if (type === "text" || type === "id") {
    if (typeof value !== "string") throw new Error("Invalid text export cell");
    return quoted(protectRegisterText(value));
  }
  return csvCell(value, type);
}
export function exportColumns(source: ExportSource) {
  if (source.kind === "register") return REGISTER_COLUMNS[source.profile];
  return source.kind === "audit" ? auditColumns : objectColumns;
}
function encodeRegisterRows(
  rows: Record<string, unknown>[],
  columns: ExportColumn[],
  format: "csv" | "jsonl",
  first: boolean,
) {
  if (format === "jsonl")
    return rows
      .map(
        (row) =>
          `${JSON.stringify(Object.fromEntries(columns.map((c) => [c.name, row[c.name] ?? null])))}\n`,
      )
      .join("");
  return (
    (first ? `${columns.map((c) => c.name).join(",")}\r\n` : "") +
    rows
      .map(
        (row) =>
          `${columns.map((c) => registerCsvCell(row[c.name], c.type)).join(",")}\r\n`,
      )
      .join("")
  );
}
export function encodeRows(
  rows: Record<string, unknown>[],
  source: ExportSource,
  format: "csv" | "jsonl",
  first: boolean,
) {
  if (source.kind === "register")
    return encodeRegisterRows(rows, exportColumns(source), format, first);
  if (format === "jsonl")
    return (
      rows.map((row) => JSON.stringify(row)).join("\n") +
      (rows.length ? "\n" : "")
    );
  const columns = exportColumns(source);
  return (
    (first ? `${columns.map((c) => c.name).join(",")}\r\n` : "") +
    rows
      .map(
        (row) =>
          `${columns.map((c) => csvCell(c.name === "record" ? row : row[c.name], c.type)).join(",")}\r\n`,
      )
      .join("")
  );
}
export function manifest(job: {
  source: ExportSource;
  organizationId: string;
  creatorId: string;
  format: string;
  schemaVersion: number;
  asOf: number;
  captureStartedAt: number;
  captureCompletedAt?: number;
  completedAt?: number;
  rows: number;
  scanned: number;
  selected: number;
  bytes: number;
  sha256?: string;
  expiresAt: number;
  failedAttempts?: number;
}) {
  const { organizationId, creatorId, ...frozen } = job;
  if (job.source.kind === "register") {
    const { profile, criteria } = job.source;
    return {
      ...frozen,
      generator: {
        name: REGISTER_GENERATOR,
        profile: `register.${profile}`,
        profileVersion: REGISTER_PROFILE_VERSION,
        exportSchemaVersion: job.schemaVersion,
      },
      organizationId,
      requestedBy: creatorId,
      criteria,
      effectiveAsOf: criteria.asOf ?? job.asOf,
      compatibility:
        "MuseumLite register export v1; UTF-8. This is a MuseumLite interchange profile, not a SPECTRUM, LIDO or accreditation conformance claim. JSONL emits every column on each line in schema order with null for empty values. CSV uses RFC 4180 quoting, CRLF records, a header row and the column schema below: id and text cells are quoted; a leading apostrophe is added when the value starts with an apostrophe, a tab, CR or LF, or when its first character after leading whitespace and control characters is =, +, - or @, so parsers remove exactly one leading apostrophe from a quoted cell; utcEpochMs and number cells are unlocalized numbers; boolean cells are true or false; an unquoted empty cell is null and a quoted empty cell is the empty string.",
      consistency: REGISTER_CONSISTENCY[profile],
      evidencePolicy:
        "evidenceStatus is recorded when the row comes from structured evidence and legacy when it predates or bypassed that evidence. notRecorded lists, separated by semicolons, the columns left empty because MuseumLite holds no record of that fact at asOf. Missing facts are never inferred.",
      columns: exportColumns(job.source),
      countPolicy:
        "rows is emitted register rows; scanned counts source records examined (register records, objects and evidence records), not rows. Completion requires an exhausted cursor and equal chunk/emitted counts; failed jobs expose no artifact.",
      maxArtifactBytes: MAX_EXPORT_BYTES,
    };
  }
  return {
    ...frozen,
    compatibility:
      "MuseumLite export v1; UTF-8; JSONL retains JSON types and null/absent distinctions. CSV uses RFC4180 quoting, UTC epoch milliseconds, unlocalized numbers, empty nulls; text/json formula prefixes receive a leading apostrophe. CSV does not encode spreadsheet cell types: import using this column schema to retain leading zeros and literal text.",
    consistency:
      "Creation cutoff excludes later inserts. Audit evidence is immutable at cutoff. Object values and filter membership are captured at each row's capturedAt during the capture interval; deleted rows before capture are absent. This is a complete bounded traversal, not a historical snapshot of mutable object values. Selected missing rows fail the job.",
    columns: exportColumns(job.source),
    countPolicy:
      "rows is emitted/captured records; failedAttempts counts failed worker attempts, not omitted records; selected is sealed explicit manifest rows. scanned counts catalog source rows examined; for audit it counts returned matching entries, not the underlying filtered scan. Completion requires exhausted cursor and equal chunk/emitted counts; failed jobs expose no artifact.",
    maxArtifactBytes: MAX_EXPORT_BYTES,
  };
}
