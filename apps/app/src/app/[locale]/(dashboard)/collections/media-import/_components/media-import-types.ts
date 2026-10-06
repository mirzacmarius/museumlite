import type { Id } from "@v1/backend/convex/_generated/dataModel";

export type ImportStep =
  | "select-mapping"
  | "upload"
  | "importing"
  | "complete"
  | "review-unmapped";

export type MappingType = "csv" | "filename" | "manual";

export interface MediaImportState {
  step: ImportStep;
  mappingType: MappingType;
  /** Selected files in stable item order (item N is `mediaFiles[N - 1]`). */
  mediaFiles: File[];
  csvFile: File | null;
  jobId: Id<"importJobs"> | null;
  /** Problems this browser met that the job could not record (e.g. network). */
  uploadErrors: string[];
  /** SHA-256 of the ordered selection; finds an earlier import to resume. */
  fingerprint: string | null;
}

export const initialMediaImportState: MediaImportState = {
  step: "select-mapping",
  mappingType: "manual",
  mediaFiles: [],
  csvFile: null,
  jobId: null,
  uploadErrors: [],
  fingerprint: null,
};
