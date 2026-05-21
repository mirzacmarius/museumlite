import type { Id } from "@v1/backend/convex/_generated/dataModel";
import type { ParsedRow, ParseError } from "../../import/import-csv";

export interface ImportLocationsState {
  step: "upload" | "preview" | "importing" | "complete";
  file: File | null;
  rows: ParsedRow[];
  parseErrors: ParseError[];
  runtimeErrors: string[];
  jobId: Id<"importJobs"> | null;
}

export const INITIAL_IMPORT_STATE: ImportLocationsState = {
  step: "upload",
  file: null,
  rows: [],
  parseErrors: [],
  runtimeErrors: [],
  jobId: null,
};
