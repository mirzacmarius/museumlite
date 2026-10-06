import type { ParsedRow, ParseError } from "../../import/import-csv";

export interface ImportLocationsState {
  /** File steps before the import runs; the run itself is tracked separately. */
  step: "upload" | "preview";
  file: File | null;
  /** SHA-256 of the source text; identifies a re-uploaded file. */
  fingerprint: string | null;
  rows: ParsedRow[];
  parseErrors: ParseError[];
}

export const INITIAL_IMPORT_STATE: ImportLocationsState = {
  step: "upload",
  file: null,
  fingerprint: null,
  rows: [],
  parseErrors: [],
};
