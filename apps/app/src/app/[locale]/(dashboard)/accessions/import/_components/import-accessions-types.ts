import type { Id } from "@v1/backend/convex/_generated/dataModel";
import type { FieldMapping } from "@/components/import-field-mapper";

export interface ParsedRow {
  accessionNumber?: string;
  dateReceived: string;
  source: string;
  method: string;
  cost?: string;
  notes?: string;
}

export interface ImportState {
  step:
    | "upload"
    | "mapping"
    | "validation"
    | "preview"
    | "importing"
    | "complete";
  file: File | null;
  rawData: Record<string, string>[];
  sourceFields: string[];
  fieldMappings: FieldMapping[];
  rows: ParsedRow[];
  validationErrors: string[];
  errors: string[];
  jobId: Id<"importJobs"> | null;
}

export const REQUIRED_COLUMNS = ["dateReceived", "source", "method"];
export const OPTIONAL_COLUMNS = ["accessionNumber", "cost", "notes"];
export const ALL_COLUMNS = [...REQUIRED_COLUMNS, ...OPTIONAL_COLUMNS];

export const TARGET_FIELDS = [
  {
    id: "dateReceived",
    label: "untranslatedRecords.accessions.import.fields.dateReceived",
    required: true,
    description:
      "untranslatedRecords.accessions.import.fieldDescriptions.dateReceived",
  },
  {
    id: "source",
    label: "untranslatedRecords.accessions.import.fields.source",
    required: true,
    description:
      "untranslatedRecords.accessions.import.fieldDescriptions.source",
  },
  {
    id: "method",
    label: "untranslatedRecords.accessions.import.fields.method",
    required: true,
    description:
      "untranslatedRecords.accessions.import.fieldDescriptions.method",
  },
  {
    id: "accessionNumber",
    label: "untranslatedRecords.accessions.import.fields.accessionNumber",
    required: false,
    description:
      "untranslatedRecords.accessions.import.fieldDescriptions.accessionNumber",
  },
  {
    id: "cost",
    label: "untranslatedRecords.accessions.import.fields.cost",
    required: false,
    description: "untranslatedRecords.accessions.import.fieldDescriptions.cost",
  },
  {
    id: "notes",
    label: "untranslatedRecords.accessions.import.fields.notes",
    required: false,
    description:
      "untranslatedRecords.accessions.import.fieldDescriptions.notes",
  },
];
