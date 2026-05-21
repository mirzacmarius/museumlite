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
  mediaFiles: File[];
  csvFile: File | null;
  jobId: Id<"importJobs"> | null;
  currentFileIndex: number;
  uploadErrors: string[];
}
