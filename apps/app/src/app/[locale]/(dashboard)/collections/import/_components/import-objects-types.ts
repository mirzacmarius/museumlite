import type { FieldMapping } from "@/components/import-field-mapper";
import type { CsvObjectRow } from "@/lib/csv-parser";

export interface ParsedRow {
  /** Line in the source file, used as the row's stable identity on the job. */
  rowNumber: number;
  accessionNumber?: string;
  title: string;
  alternativeTitle?: string;
  creator?: string;
  objectType?: string;
  objectName?: string;
  culture?: string;
  period?: string;
  dateCreated?: string;
  materials?: string;
  technique?: string;
  dimensions?: string;
  description?: string;
  condition?: string;
  provenance?: string;
  location?: string;
  collectionGroup?: string;
}

export interface ImportState {
  /** Wizard steps before the import runs; the run itself is tracked separately. */
  step: "upload" | "mapping" | "validation" | "preview";
  file: File | null;
  rawData: CsvObjectRow[];
  /** SHA-256 of the source text; identifies a re-uploaded file. */
  fingerprint: string | null;
  sourceFields: string[];
  fieldMappings: FieldMapping[];
  selectedTemplate: string | null;
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
  selectedTemplate: null,
  rows: [],
  validationErrors: [],
  errors: [],
};

export const REQUIRED_COLUMNS = ["title"];
export const OPTIONAL_COLUMNS = [
  "accessionNumber",
  "alternativeTitle",
  "creator",
  "objectType",
  "objectName",
  "culture",
  "period",
  "dateCreated",
  "materials",
  "technique",
  "dimensions",
  "description",
  "condition",
  "provenance",
  "location",
  "collectionGroup",
];
export const ALL_COLUMNS = [...REQUIRED_COLUMNS, ...OPTIONAL_COLUMNS];

export const TARGET_FIELDS = [
  {
    id: "title",
    label: "untranslatedRecords.collections.import.fields.title",
    required: true,
    description:
      "untranslatedRecords.collections.import.fieldDescriptions.title",
  },
  {
    id: "accessionNumber",
    label: "untranslatedRecords.collections.import.fields.accessionNumber",
    required: false,
    description:
      "untranslatedRecords.collections.import.fieldDescriptions.accessionNumber",
  },
  {
    id: "alternativeTitle",
    label: "untranslatedRecords.collections.import.fields.alternativeTitle",
    required: false,
    description:
      "untranslatedRecords.collections.import.fieldDescriptions.alternativeTitle",
  },
  {
    id: "creator",
    label: "untranslatedRecords.collections.import.fields.creator",
    required: false,
    description:
      "untranslatedRecords.collections.import.fieldDescriptions.creator",
  },
  {
    id: "objectType",
    label: "untranslatedRecords.collections.import.fields.objectType",
    required: false,
    description:
      "untranslatedRecords.collections.import.fieldDescriptions.objectType",
  },
  {
    id: "objectName",
    label: "untranslatedRecords.collections.import.fields.objectName",
    required: false,
    description:
      "untranslatedRecords.collections.import.fieldDescriptions.objectName",
  },
  {
    id: "culture",
    label: "untranslatedRecords.collections.import.fields.culture",
    required: false,
    description:
      "untranslatedRecords.collections.import.fieldDescriptions.culture",
  },
  {
    id: "period",
    label: "untranslatedRecords.collections.import.fields.period",
    required: false,
    description:
      "untranslatedRecords.collections.import.fieldDescriptions.period",
  },
  {
    id: "dateCreated",
    label: "untranslatedRecords.collections.import.fields.dateCreated",
    required: false,
    description:
      "untranslatedRecords.collections.import.fieldDescriptions.dateCreated",
  },
  {
    id: "materials",
    label: "untranslatedRecords.collections.import.fields.materials",
    required: false,
    description:
      "untranslatedRecords.collections.import.fieldDescriptions.materials",
  },
  {
    id: "technique",
    label: "untranslatedRecords.collections.import.fields.technique",
    required: false,
    description:
      "untranslatedRecords.collections.import.fieldDescriptions.technique",
  },
  {
    id: "dimensions",
    label: "untranslatedRecords.collections.import.fields.dimensions",
    required: false,
    description:
      "untranslatedRecords.collections.import.fieldDescriptions.dimensions",
  },
  {
    id: "description",
    label: "untranslatedRecords.collections.import.fields.description",
    required: false,
    description:
      "untranslatedRecords.collections.import.fieldDescriptions.description",
  },
  {
    id: "condition",
    label: "untranslatedRecords.collections.import.fields.condition",
    required: false,
    description:
      "untranslatedRecords.collections.import.fieldDescriptions.condition",
  },
  {
    id: "provenance",
    label: "untranslatedRecords.collections.import.fields.provenance",
    required: false,
    description:
      "untranslatedRecords.collections.import.fieldDescriptions.provenance",
  },
  {
    id: "location",
    label: "untranslatedRecords.collections.import.fields.location",
    required: false,
    description:
      "untranslatedRecords.collections.import.fieldDescriptions.location",
  },
  {
    id: "collectionGroup",
    label: "untranslatedRecords.collections.import.fields.collectionGroup",
    required: false,
    description:
      "untranslatedRecords.collections.import.fieldDescriptions.collectionGroup",
  },
];

export interface ImportTemplate {
  id: string;
  name: string;
  mappings: Record<string, string>;
}

export const IMPORT_TEMPLATES: ImportTemplate[] = [
  {
    id: "pastperfect",
    name: "PastPerfect",
    mappings: {
      "Object Name": "title",
      "Cat. No": "accessionNumber",
      "Alternate Name": "alternativeTitle",
      Artist: "creator",
      "Object Type": "objectType",
      Culture: "culture",
      "Date Made": "dateCreated",
      Period: "period",
      Medium: "materials",
      Technique: "technique",
      Measurements: "dimensions",
      Description: "description",
      Condition: "condition",
      Provenance: "provenance",
      Location: "location",
      Collection: "collectionGroup",
    },
  },
  {
    id: "tms",
    name: "TMS (The Museum System)",
    mappings: {
      Title: "title",
      ObjectNumber: "accessionNumber",
      AlternateTitle: "alternativeTitle",
      DisplayName: "creator",
      Classification: "objectType",
      ObjectName: "objectName",
      Culture: "culture",
      Period: "period",
      Dated: "dateCreated",
      Medium: "materials",
      Dimensions: "dimensions",
      Description: "description",
      ConditionNotes: "condition",
      Provenance: "provenance",
      CurrentLocation: "location",
      Department: "collectionGroup",
    },
  },
];
