export interface ExportColumn {
  name: string;
  type: "text" | "number" | "utcEpochMs" | "json" | "boolean";
}
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
function csvCell(value: unknown, type: ExportColumn["type"]) {
  if (value === undefined || value === null) return "";
  if (type === "number" || type === "utcEpochMs") {
    if (typeof value !== "number" || !Number.isFinite(value))
      throw new Error("Invalid numeric export cell");
    return String(value);
  }
  const raw = type === "json" ? JSON.stringify(value) : String(value);
  const safe = protectSpreadsheetText(raw);
  return `"${safe.replace(/"/g, '""')}"`;
}
export function encodeRows(
  rows: Record<string, unknown>[],
  source: "objects" | "audit",
  format: "csv" | "jsonl",
  first: boolean,
) {
  if (format === "jsonl")
    return (
      rows.map((row) => JSON.stringify(row)).join("\n") +
      (rows.length ? "\n" : "")
    );
  const columns = source === "objects" ? objectColumns : auditColumns;
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
  source: unknown;
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
  return {
    ...job,
    compatibility:
      "MuseumLite export v1; UTF-8; JSONL retains JSON types and null/absent distinctions. CSV uses RFC4180 quoting, UTC epoch milliseconds, unlocalized numbers, empty nulls; text/json formula prefixes receive a leading apostrophe. CSV does not encode spreadsheet cell types: import using this column schema to retain leading zeros and literal text.",
    consistency:
      "Creation cutoff excludes later inserts. Audit evidence is immutable at cutoff. Object values and filter membership are captured at each row's capturedAt during the capture interval; deleted rows before capture are absent. This is a complete bounded traversal, not a historical snapshot of mutable object values. Selected missing rows fail the job.",
    columns:
      typeof job.source === "object" &&
      job.source !== null &&
      "kind" in job.source &&
      job.source.kind === "audit"
        ? auditColumns
        : objectColumns,
    countPolicy:
      "rows is emitted/captured records; failedAttempts counts failed worker attempts, not omitted records; selected is sealed explicit manifest rows. scanned counts catalog source rows examined; for audit it counts returned matching entries, not the underlying filtered scan. Completion requires exhausted cursor and equal chunk/emitted counts; failed jobs expose no artifact.",
    maxArtifactBytes: 16 * 1024 * 1024,
  };
}
