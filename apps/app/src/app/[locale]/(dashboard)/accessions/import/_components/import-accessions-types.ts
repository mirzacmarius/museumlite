import type { FieldMapping } from "@/components/import-field-mapper";
import type { Id } from "@v1/backend/convex/_generated/dataModel";

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
    label: "Date Received",
    required: true,
    description: "Date the item was received",
  },
  {
    id: "source",
    label: "Source",
    required: true,
    description: "Source or donor of the item",
  },
  {
    id: "method",
    label: "Method",
    required: true,
    description: "Acquisition method (purchase, donation, etc.)",
  },
  {
    id: "accessionNumber",
    label: "Accession Number",
    required: false,
    description: "Unique identifier (auto-generated if empty)",
  },
  {
    id: "cost",
    label: "Cost",
    required: false,
    description: "Acquisition cost",
  },
  {
    id: "notes",
    label: "Notes",
    required: false,
    description: "Additional notes",
  },
];
