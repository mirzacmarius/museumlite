import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, test } from "vitest";
import {
  buildSnapshotManifest,
  compareSnapshotManifests,
  runSnapshotVerificationCli,
} from "../scripts/recovery/snapshotVerification";

// Real document IDs taken from a local Convex snapshot export. The table
// numbers are encoded inside each ID, so these literals are the source of truth.
const LOCATION_ID = "wh74sx6r63eze3ej7atpmp8th98fxmfz"; // table 10084
const ORGANIZATION_ID = "z57c26cwvs868x4b204nzh3vs58fw71e"; // table 10105
const STORAGE_ID = "kg282y6pf4kf879f1px5t67b998fw3c6"; // _storage, table 540
// SHA-256 of the ASCII bytes "abc" (FIPS 180-2 test vector).
const ABC_SHA256_HEX =
  "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";
const ABC_SHA256_BASE64 = "ungWv48Bz+pBQUDeXa4iI7ADYaOWF3qctBD/YfIAFa0=";

const text = (value: string) => new TextEncoder().encode(value);
const jsonl = (rows: object[]) =>
  text(rows.map((row) => JSON.stringify(row)).join("\n"));

function snapshot(entries: Record<string, Uint8Array>) {
  return new Map(Object.entries(entries));
}

const tableMap = jsonl([
  { name: "locations", id: 10084 },
  { name: "organizations", id: 10105 },
]);

describe("snapshot manifest", () => {
  test("counts documents per table and reports references to documents absent from the snapshot", () => {
    const manifest = buildSnapshotManifest(
      snapshot({
        "_tables/documents.jsonl": tableMap,
        "organizations/documents.jsonl": jsonl([]),
        "locations/documents.jsonl": jsonl([
          {
            _id: LOCATION_ID,
            _creationTime: 1,
            name: "Gallery",
            organizationId: ORGANIZATION_ID,
          },
        ]),
      }),
    );

    expect(manifest.tables.locations.count).toBe(1);
    expect(manifest.tables.organizations.count).toBe(0);
    expect(manifest.references.dangling).toEqual([
      {
        table: "locations",
        documentId: LOCATION_ID,
        path: "organizationId",
        target: ORGANIZATION_ID,
        targetTable: "organizations",
      },
    ]);
  });

  test("hashes stored file bytes and flags files whose bytes no longer match the recorded checksum", () => {
    const storageRow = (sha256: string) =>
      jsonl([
        {
          _id: STORAGE_ID,
          _creationTime: 1,
          sha256,
          size: 3,
          contentType: "image/png",
        },
      ]);
    const intact = buildSnapshotManifest(
      snapshot({
        "_storage/documents.jsonl": storageRow(ABC_SHA256_BASE64),
        [`_storage/${STORAGE_ID}.png`]: text("abc"),
      }),
    );
    expect(intact.files).toEqual({
      [STORAGE_ID]: { bytes: 3, sha256: ABC_SHA256_HEX },
    });
    expect(intact.integrity).toEqual([]);

    const corrupted = buildSnapshotManifest(
      snapshot({
        "_storage/documents.jsonl": storageRow(ABC_SHA256_BASE64),
        [`_storage/${STORAGE_ID}.png`]: text("abd"),
      }),
    );
    expect(corrupted.integrity).toEqual([
      { category: "file_checksum_mismatch", id: STORAGE_ID },
    ]);

    const missing = buildSnapshotManifest(
      snapshot({ "_storage/documents.jsonl": storageRow(ABC_SHA256_BASE64) }),
    );
    expect(missing.integrity).toEqual([
      { category: "file_missing", id: STORAGE_ID },
    ]);
  });
});

describe("snapshot comparison", () => {
  const organization = {
    _id: ORGANIZATION_ID,
    _creationTime: 1,
    name: "Museum",
  };
  const location = {
    _id: LOCATION_ID,
    _creationTime: 2,
    name: "Gallery",
    organizationId: ORGANIZATION_ID,
  };
  const source = (overrides: Record<string, Uint8Array> = {}) =>
    buildSnapshotManifest(
      snapshot({
        "_tables/documents.jsonl": tableMap,
        "organizations/documents.jsonl": jsonl([organization]),
        "locations/documents.jsonl": jsonl([location]),
        "_storage/documents.jsonl": jsonl([
          {
            _id: STORAGE_ID,
            _creationTime: 3,
            sha256: ABC_SHA256_BASE64,
            size: 3,
          },
        ]),
        [`_storage/${STORAGE_ID}.png`]: text("abc"),
        ...overrides,
      }),
    );

  test("a faithful restore has no blocking discrepancies", () => {
    const result = compareSnapshotManifests(source(), source());
    expect(result.blocking).toEqual([]);
    expect(result.compared).toEqual({ tables: 3, documents: 3, files: 1 });
  });

  test("reports lost and changed documents, lost file bytes and broken references", () => {
    const restored = source({
      "organizations/documents.jsonl": jsonl([]),
      "locations/documents.jsonl": jsonl([{ ...location, name: "Renamed" }]),
      "_storage/documents.jsonl": jsonl([]),
      [`_storage/${STORAGE_ID}.png`]: text(""),
      "exhibitions/documents.jsonl": jsonl([]),
    });
    expect(compareSnapshotManifests(source(), restored).blocking).toEqual([
      { category: "document_missing", table: "_storage", id: STORAGE_ID },
      { category: "document_changed", table: "locations", id: LOCATION_ID },
      {
        category: "document_missing",
        table: "organizations",
        id: ORGANIZATION_ID,
      },
      { category: "file_missing", id: STORAGE_ID },
      {
        category: "reference_broken",
        table: "locations",
        id: LOCATION_ID,
        path: "organizationId",
        target: ORGANIZATION_ID,
      },
    ]);
  });

  test("ignored derived tables are excluded from comparison", () => {
    const restored = source({ "locations/documents.jsonl": jsonl([]) });
    const result = compareSnapshotManifests(source(), restored, {
      ignoreTables: ["locations"],
    });
    expect(result.blocking).toEqual([]);
    expect(result.compared.tables).toBe(2);
  });
});

describe("snapshot verification command", () => {
  function writeZip(files: Record<string, Uint8Array>) {
    const directory = mkdtempSync(join(tmpdir(), "snapshot-verification-"));
    const contents = join(directory, "contents");
    for (const [path, bytes] of Object.entries(files)) {
      mkdirSync(dirname(join(contents, path)), { recursive: true });
      writeFileSync(join(contents, path), bytes);
    }
    const zip = join(directory, "snapshot.zip");
    execFileSync("zip", ["-qr", zip, "."], { cwd: contents });
    return zip;
  }
  const files = {
    "_tables/documents.jsonl": tableMap,
    "organizations/documents.jsonl": jsonl([
      { _id: ORGANIZATION_ID, _creationTime: 1, name: "Museum" },
    ]),
    "locations/documents.jsonl": jsonl([
      { _id: LOCATION_ID, _creationTime: 2, organizationId: ORGANIZATION_ID },
    ]),
  };

  test("compare exits successfully for identical exports and fails when the restore lost a document", () => {
    const original = writeZip(files);
    const identical = writeZip(files);
    const lossy = writeZip({
      ...files,
      "organizations/documents.jsonl": jsonl([]),
    });

    const ok = runSnapshotVerificationCli(["compare", original, identical]);
    expect(ok.exitCode).toBe(0);
    expect(JSON.parse(ok.output).compared).toEqual({
      tables: 2,
      documents: 2,
      files: 0,
    });

    const failed = runSnapshotVerificationCli(["compare", original, lossy]);
    expect(failed.exitCode).toBe(1);
    expect(JSON.parse(failed.output).blocking).toContainEqual({
      category: "document_missing",
      table: "organizations",
      id: ORGANIZATION_ID,
    });
  });

  test("manifest summarises counts, files and dangling references without document bodies", () => {
    const result = runSnapshotVerificationCli([
      "manifest",
      writeZip({ ...files, "organizations/documents.jsonl": jsonl([]) }),
    ]);
    expect(result.exitCode).toBe(0);
    const summary = JSON.parse(result.output);
    expect(summary.tables).toEqual({ locations: 1, organizations: 0 });
    expect(summary.references.dangling).toHaveLength(1);
    expect(result.output).not.toContain("Museum");
  });
});
