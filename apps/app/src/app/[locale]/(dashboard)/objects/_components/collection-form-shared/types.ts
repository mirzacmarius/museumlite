import type { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import type { CollectionModuleId } from "@v1/backend/convex/utils/moduleCatalog";
import type {
  Completeness,
  MeasuredPart,
} from "@v1/backend/convex/utils/objectDescription";
import type { RightsStatementUri } from "@v1/backend/convex/utils/rightsStatements";
import type { FunctionArgs } from "convex/server";
import type { CollectionType } from "@/components/collection-type-selector";
import type { ProductionDateDraft } from "@/components/production-date/production-date-draft";
import type { ObjectTabId } from "../../[id]/_components/object-tab-config";
import type { TypeDetailsDraft } from "../object-type-details/type-detail-values";

export interface OwnershipEntry {
  localId?: string;
  owner: string;
  startYear?: string;
  endYear?: string;
  description?: string;
  verified?: boolean;
  verificationSource?: string;
}

export interface LinkEntry {
  localId?: string;
  url: string;
  label?: string;
}

export interface InscriptionMarkEntry {
  localId?: string;
  label: string;
  description: string;
}

/** A further set of measurements as its inputs hold it, one part per set. */
export interface MeasurementSetEntry {
  localId?: string;
  /** Undefined until staff choose the part. */
  part?: MeasuredPart;
  partNote: string;
  height: string;
  width: string;
  depth: string;
  diameter: string;
  weight: string;
  unit: string;
  weightUnit: string;
}

/** An intake object draft as the server stores it. */
export type ObjectDraftData = FunctionArgs<
  typeof api.accessions.saveObjectDraft
>["objectData"];

/**
 * Catalog fields shared by the intake draft and the catalog edit forms, as
 * text inputs hold them. Measurements are strings until saved.
 */
export interface CollectionFormData {
  accessionNumber?: string;
  title: string;
  alternativeTitle?: string;
  creator?: string;
  objectType?: string | string[];
  objectName?: string;
  /** A whole number as typed; blank when not recorded. */
  numberOfObjects?: string;
  culture?: string;
  period?: string;
  dateCreated?: string;
  /** The structured date made as its inputs hold it, saved as EDTF. */
  dateCreatedEdtf?: ProductionDateDraft;
  materials?: string | string[];
  technique?: string;
  dimensions?: string;
  dimensionHeight?: string;
  dimensionWidth?: string;
  dimensionDepth?: string;
  dimensionUnit?: string;
  dimensionDiameter?: string;
  dimensionWeight?: string | number;
  weightUnit?: string;
  /** The part the measurements above were taken from. */
  dimensionMeasuredPart?: MeasuredPart;
  measurementSets?: MeasurementSetEntry[];
  description?: string;
  condition?: string;
  completeness?: Completeness;
  completenessNote?: string;
  inscriptions?: string;
  inscriptionMarks?: InscriptionMarkEntry[];
  tags?: string[];
  subjects?: string[];
  provenance?: string;
  exhibitionHistory?: string;
  donated_by?: string[];
  donated_date?: string;
  donation_info?: string;
  acquisitionMethod?: string;
  creditLine?: string;
  /** Undefined: the Organization's default applies. */
  rightsStatement?: RightsStatementUri;
  legalRestrictions?: boolean;
  previous_owners?: string[];
  links?: LinkEntry[];
  parentObjectId?: string;
  currentLocationId?: string;
  collectionGroupId?: string;
  collectionGroupIds?: string[];
  alternateAccessionNumbers?: string[];
  ownershipHistory?: OwnershipEntry[];
  collectionType?: CollectionType;
  typeDetails?: TypeDetailsDraft;
  displayStatus?: string;
  isPubliclyVisible?: boolean;
  isHighResDownloadable?: boolean;
  isSearchable?: boolean;
  isValuationVisible?: boolean;
  publicSlug?: string;
}

export type CollectionEditTabId = Extract<
  ObjectTabId,
  | "general"
  | "provenance"
  | "physical"
  | "media"
  | "digital"
  | "accession"
  | "placement"
  | "valuation"
  | CollectionModuleId
>;

export interface DraftMediaItem {
  storageId: Id<"_storage">;
  fileName: string;
  fileSize: number;
  mimeType: string;
  mediaCategory: "image" | "document";
  isPrimary: boolean;
  url?: string | null;
}

export type UpdateCollectionFormField = <K extends keyof CollectionFormData>(
  field: K,
  value: CollectionFormData[K],
) => void;

/** Shared default so tabs without errors keep a stable prop value. */
export const NO_FIELD_ERRORS: Readonly<Record<string, string>> = {};

export interface CollectionFormTabProps {
  formData: CollectionFormData;
  updateField: UpdateCollectionFormField;
  placeholders: (key: string) => string;
  currentOrganizationId: Id<"organizations">;
  isLocationTrackingEnabled: boolean;
  /** Messages for fields that need attention, by field name. */
  fieldErrors?: Record<string, string>;
}
