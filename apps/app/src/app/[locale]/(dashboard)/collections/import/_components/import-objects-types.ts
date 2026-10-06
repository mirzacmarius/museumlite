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
    label: "Title",
    required: true,
    description: "Object title or name",
  },
  {
    id: "accessionNumber",
    label: "Accession Number",
    required: false,
    description: "Unique identifier (auto-generated if empty)",
  },
  {
    id: "alternativeTitle",
    label: "Alternative Title",
    required: false,
    description: "Secondary or alternative name",
  },
  {
    id: "creator",
    label: "Creator",
    required: false,
    description: "Artist, maker, or creator",
  },
  {
    id: "objectType",
    label: "Object Type",
    required: false,
    description: "Type or category of object",
  },
  {
    id: "objectName",
    label: "Object Name",
    required: false,
    description: "Specific name of the object",
  },
  {
    id: "culture",
    label: "Culture",
    required: false,
    description: "Cultural origin",
  },
  {
    id: "period",
    label: "Period",
    required: false,
    description: "Historical period",
  },
  {
    id: "dateCreated",
    label: "Date Created",
    required: false,
    description: "Creation date or period",
  },
  {
    id: "materials",
    label: "Materials",
    required: false,
    description: "Materials used",
  },
  {
    id: "technique",
    label: "Technique",
    required: false,
    description: "Production technique",
  },
  {
    id: "dimensions",
    label: "Dimensions",
    required: false,
    description: "Physical dimensions",
  },
  {
    id: "description",
    label: "Description",
    required: false,
    description: "Detailed description",
  },
  {
    id: "condition",
    label: "Condition",
    required: false,
    description: "Current condition",
  },
  {
    id: "provenance",
    label: "Provenance",
    required: false,
    description: "Ownership history",
  },
  {
    id: "location",
    label: "Location",
    required: false,
    description: "Current location",
  },
  {
    id: "collectionGroup",
    label: "Collection Group",
    required: false,
    description: "Collection or group name",
  },
];

export interface ImportTemplate {
  id: string;
  name: string;
  description: string;
  mappings: Record<string, string>;
}

export const IMPORT_TEMPLATES: ImportTemplate[] = [
  {
    id: "pastperfect",
    name: "PastPerfect",
    description: "Import from PastPerfect Museum Software",
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
    description: "Import from The Museum System (TMS)",
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
