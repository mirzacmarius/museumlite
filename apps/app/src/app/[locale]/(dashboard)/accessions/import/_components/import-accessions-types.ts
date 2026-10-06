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
