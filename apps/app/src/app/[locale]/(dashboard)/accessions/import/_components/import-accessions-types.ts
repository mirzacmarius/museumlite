import type { FieldMapping } from "@/components/import-field-mapper";

export interface ParsedRow {
  /** Line in the source file, used as the row's stable identity on the job. */
  rowNumber: number;
  accessionNumber?: string;
  dateReceived: string;
  source: string;
  method: string;
  cost?: string;
  notes?: string;
}

export interface ImportState {
  /** Wizard steps before the import runs; the run itself is tracked separately. */
  step: "upload" | "mapping" | "validation" | "preview";
  file: File | null;
  rawData: { rowNumber: number; values: Record<string, string> }[];
  /** SHA-256 of the source text; identifies a re-uploaded file. */
  fingerprint: string | null;
  sourceFields: string[];
  fieldMappings: FieldMapping[];
  rows: ParsedRow[];
  validationErrors: string[];
  errors: string[];
}

export const MAX_IMPORT_ROWS = 1000;

export const EMPTY_IMPORT_STATE: ImportState = {
  step: "upload",
  file: null,
  rawData: [],
  fingerprint: null,
  sourceFields: [],
  fieldMappings: [],
  rows: [],
  validationErrors: [],
  errors: [],
};

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
