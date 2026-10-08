/**
 * Offline verification of Convex snapshot exports (ZIP files produced by
 * `convex export --include-file-storage`). It never connects to a deployment:
 * it only reads local files, so it cannot touch production data.
 *
 * Usage (from packages/backend):
 *   bun scripts/recovery/snapshotVerification.ts manifest <snapshot.zip>
 *   bun scripts/recovery/snapshotVerification.ts compare <expected.zip> <restored.zip> [--ignore tableA,tableB]
 *
 * `compare` exits 1 when there is any blocking discrepancy.
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";

export type SnapshotEntries = Map<string, Uint8Array>;

type Document = Record<string, unknown> & { _id: string };

export type DanglingReference = {
  table: string;
  documentId: string;
  path: string;
  target: string;
  targetTable: string | null;
};

export type TableManifest = {
  count: number;
  /** Document ID -> SHA-256 of its canonical JSON. */
  documents: Record<string, string>;
};

export type FileManifest = { bytes: number; sha256: string };

export type IntegrityIssue = {
  category: "file_missing" | "file_checksum_mismatch";
  id: string;
};

export type SnapshotManifest = {
  tables: Record<string, TableManifest>;
  files: Record<string, FileManifest>;
  integrity: IntegrityIssue[];
  references: { checked: number; dangling: DanglingReference[] };
};

const BASE32 = "0123456789abcdefghjkmnpqrstvwxyz";
const DOCUMENTS_SUFFIX = "/documents.jsonl";

/**
 * Decodes a Convex document ID and returns its table number, or null when the
 * string is not a well-formed ID. Format: base32(varint(table number) ||
 * 16-byte internal id || Fletcher-16 (mod 256) checksum of the preceding bytes).
 */
export function decodeDocumentId(value: string): number | null {
  if (value.length < 31 || value.length > 37) return null;
  const bytes: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (const char of value) {
    const digit = BASE32.indexOf(char);
    if (digit < 0) return null;
    buffer = ((buffer << 5) | digit) & 0xfff;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >> bits) & 0xff);
    }
  }
  if (bits >= 5) return null;
  let tableNumber = 0;
  let offset = 0;
  for (let shift = 0; ; shift += 7) {
    const byte = bytes[offset++];
    if (byte === undefined || shift > 28) return null;
    tableNumber += (byte & 0x7f) * 2 ** shift;
    if (byte < 0x80) break;
  }
  if (bytes.length - offset !== 18) return null;
  let a = 0;
  let b = 0;
  for (const byte of bytes.slice(0, -2)) {
    a = (a + byte) % 256;
    b = (b + a) % 256;
  }
  return bytes.at(-2) === a && bytes.at(-1) === b ? tableNumber : null;
}

const decoder = new TextDecoder();

function parseJsonLines(bytes: Uint8Array): Record<string, unknown>[] {
  return decoder
    .decode(bytes)
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map((line) => JSON.parse(line) as Record<string, unknown>);
}

/** Table key for a documents path: `locations`, `_components/polar/products`. */
function tableKey(path: string) {
  return path.slice(0, -DOCUMENTS_SUFFIX.length);
}

/** `_components/polar/products` lives in namespace `_components/polar/`. */
function namespaceOf(table: string) {
  const slash = table.lastIndexOf("/");
  return slash < 0 ? "" : table.slice(0, slash + 1);
}

function* stringLeaves(
  value: unknown,
  path: string,
): Generator<[string, string]> {
  if (typeof value === "string") {
    yield [path, value];
  } else if (Array.isArray(value)) {
    for (const [index, item] of value.entries())
      yield* stringLeaves(item, `${path}[${index}]`);
  } else if (value !== null && typeof value === "object") {
    for (const [key, item] of Object.entries(value))
      yield* stringLeaves(item, path ? `${path}.${key}` : key);
  }
}

export function buildSnapshotManifest(
  entries: SnapshotEntries,
): SnapshotManifest {
  const tableNames = new Map<string, string>();
  const tables = new Map<string, Document[]>();
  for (const [path, bytes] of entries) {
    if (!path.endsWith(DOCUMENTS_SUFFIX)) continue;
    const table = tableKey(path);
    if (table === "_tables" || table.endsWith("/_tables")) {
      const namespace = table.slice(0, -"_tables".length);
      for (const row of parseJsonLines(bytes))
        tableNames.set(`${namespace}${row.id}`, `${namespace}${row.name}`);
      continue;
    }
    tables.set(table, parseJsonLines(bytes) as Document[]);
  }

  const ids = new Set<string>();
  for (const documents of tables.values())
    for (const document of documents) ids.add(document._id);

  const manifest: SnapshotManifest = {
    tables: {},
    files: {},
    integrity: [],
    references: { checked: 0, dangling: [] },
  };
  verifyStoredFiles(entries, tables, manifest);
  for (const [table, documents] of [...tables].sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    manifest.tables[table] = {
      count: documents.length,
      documents: Object.fromEntries(
        documents.map((document) => [
          document._id,
          sha256(new TextEncoder().encode(canonicalJson(document)), "hex"),
        ]),
      ),
    };
    for (const document of documents) {
      for (const [path, value] of stringLeaves(document, "")) {
        if (path === "_id") continue;
        const tableNumber = decodeDocumentId(value);
        if (tableNumber === null) continue;
        manifest.references.checked++;
        if (ids.has(value)) continue;
        manifest.references.dangling.push({
          table,
          documentId: document._id,
          path,
          target: value,
          targetTable:
            tableNames.get(`${namespaceOf(table)}${tableNumber}`) ?? null,
        });
      }
    }
  }
  return manifest;
}

function sha256(bytes: Uint8Array, encoding: "hex" | "base64") {
  return createHash("sha256").update(bytes).digest(encoding);
}

/** Matches every `_storage` row with its exported blob and recorded checksum. */
function verifyStoredFiles(
  entries: SnapshotEntries,
  tables: Map<string, Document[]>,
  manifest: SnapshotManifest,
) {
  const blobs = new Map<string, Uint8Array>();
  for (const [path, bytes] of entries) {
    const match = /(?:^|\/)_storage\/([^/.]+)(?:\.[^/]*)?$/.exec(path);
    if (match?.[1] && !path.endsWith(DOCUMENTS_SUFFIX))
      blobs.set(match[1], bytes);
  }
  for (const [table, documents] of tables) {
    if (table !== "_storage" && !table.endsWith("/_storage")) continue;
    for (const document of documents) {
      const blob = blobs.get(document._id);
      if (!blob) {
        manifest.integrity.push({ category: "file_missing", id: document._id });
        continue;
      }
      manifest.files[document._id] = {
        bytes: blob.byteLength,
        sha256: sha256(blob, "hex"),
      };
      if (
        document.sha256 !== sha256(blob, "base64") ||
        (typeof document.size === "number" && document.size !== blob.byteLength)
      )
        manifest.integrity.push({
          category: "file_checksum_mismatch",
          id: document._id,
        });
    }
  }
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value !== null && typeof value === "object")
    return `{${Object.keys(value)
      .sort()
      .map(
        (key) =>
          `${JSON.stringify(key)}:${canonicalJson((value as Record<string, unknown>)[key])}`,
      )
      .join(",")}}`;
  return JSON.stringify(value);
}

export type Discrepancy =
  | {
      category: "table_missing";
      table: string;
    }
  | {
      category: "document_missing" | "document_changed";
      table: string;
      id: string;
    }
  | { category: "file_missing" | "file_changed"; id: string }
  | {
      category: "reference_broken";
      table: string;
      id: string;
      path: string;
      target: string;
    };

export type ComparisonResult = {
  blocking: Discrepancy[];
  compared: { tables: number; documents: number; files: number };
};

const referenceKey = (reference: DanglingReference) =>
  `${reference.table}\u0000${reference.documentId}\u0000${reference.path}\u0000${reference.target}`;

/**
 * Compares a restored snapshot with the snapshot it was restored from. Every
 * expected document must exist with identical content (same `_id`, same
 * `_creationTime`), every file must have identical bytes, and the restore may
 * not introduce dangling references that the expected snapshot did not have.
 * Tables listed in `ignoreTables` (derived state such as projection
 * bookkeeping) are skipped.
 */
export function compareSnapshotManifests(
  expected: SnapshotManifest,
  actual: SnapshotManifest,
  options: { ignoreTables?: string[] } = {},
): ComparisonResult {
  const ignored = new Set(options.ignoreTables ?? []);
  const result: ComparisonResult = {
    blocking: [],
    compared: { tables: 0, documents: 0, files: 0 },
  };
  for (const [table, expectedTable] of Object.entries(expected.tables)) {
    if (ignored.has(table)) continue;
    result.compared.tables++;
    const actualTable = actual.tables[table];
    if (!actualTable) {
      result.blocking.push({ category: "table_missing", table });
      continue;
    }
    for (const [id, digest] of Object.entries(expectedTable.documents)) {
      result.compared.documents++;
      const actualDigest = actualTable.documents[id];
      if (actualDigest === undefined)
        result.blocking.push({ category: "document_missing", table, id });
      else if (actualDigest !== digest)
        result.blocking.push({ category: "document_changed", table, id });
    }
  }
  for (const [id, file] of Object.entries(expected.files)) {
    result.compared.files++;
    const actualFile = actual.files[id];
    if (!actualFile) result.blocking.push({ category: "file_missing", id });
    else if (actualFile.sha256 !== file.sha256)
      result.blocking.push({ category: "file_changed", id });
  }
  const alreadyDangling = new Set(
    expected.references.dangling.map(referenceKey),
  );
  for (const reference of actual.references.dangling) {
    if (ignored.has(reference.table)) continue;
    if (alreadyDangling.has(referenceKey(reference))) continue;
    result.blocking.push({
      category: "reference_broken",
      table: reference.table,
      id: reference.documentId,
      path: reference.path,
      target: reference.target,
    });
  }
  return result;
}

/** Reads every entry of a snapshot ZIP using the system `unzip` tool. */
export function readSnapshotZip(zipPath: string): SnapshotEntries {
  const directory = mkdtempSync(join(tmpdir(), "snapshot-read-"));
  try {
    execFileSync("unzip", ["-qq", zipPath, "-d", directory]);
    const entries: SnapshotEntries = new Map();
    const walk = (path: string) => {
      for (const entry of readdirSync(path, { withFileTypes: true })) {
        const full = join(path, entry.name);
        if (entry.isDirectory()) walk(full);
        else entries.set(relative(directory, full), readFileSync(full));
      }
    };
    walk(directory);
    return entries;
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

/** Counts, file hashes and reference findings, without document bodies. */
function summarize(manifest: SnapshotManifest) {
  return {
    tables: Object.fromEntries(
      Object.entries(manifest.tables).map(([table, { count }]) => [
        table,
        count,
      ]),
    ),
    files: manifest.files,
    integrity: manifest.integrity,
    references: manifest.references,
  };
}

export function runSnapshotVerificationCli(argv: string[]): {
  exitCode: number;
  output: string;
} {
  const [command, ...rest] = argv;
  const ignoreIndex = rest.indexOf("--ignore");
  const ignoreTables =
    ignoreIndex >= 0 ? (rest[ignoreIndex + 1] ?? "").split(",") : [];
  const paths = ignoreIndex >= 0 ? rest.slice(0, ignoreIndex) : rest;
  const load = (path: string) => buildSnapshotManifest(readSnapshotZip(path));

  if (command === "manifest" && paths.length === 1) {
    const manifest = load(paths[0]!);
    return {
      exitCode: manifest.integrity.length > 0 ? 1 : 0,
      output: JSON.stringify(summarize(manifest), null, 2),
    };
  }
  if (command === "compare" && paths.length === 2) {
    const expected = load(paths[0]!);
    const actual = load(paths[1]!);
    const result = compareSnapshotManifests(expected, actual, {
      ignoreTables,
    });
    const blocking = [
      ...result.blocking,
      ...actual.integrity.map((issue) => ({ ...issue, snapshot: "restored" })),
    ];
    return {
      exitCode: blocking.length > 0 ? 1 : 0,
      output: JSON.stringify(
        { compared: result.compared, ignoredTables: ignoreTables, blocking },
        null,
        2,
      ),
    };
  }
  return {
    exitCode: 2,
    output:
      "Usage: snapshotVerification.ts manifest <snapshot.zip> | compare <expected.zip> <restored.zip> [--ignore tableA,tableB]",
  };
}

if ((import.meta as { main?: boolean }).main) {
  const { exitCode, output } = runSnapshotVerificationCli(
    process.argv.slice(2),
  );
  console.log(output);
  process.exit(exitCode);
}
