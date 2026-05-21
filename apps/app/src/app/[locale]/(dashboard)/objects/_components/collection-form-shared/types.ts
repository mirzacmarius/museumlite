import type { CollectionType } from "@/components/collection-type-selector";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import type { ObjectTabId } from "../../[id]/_components/object-tab-config";

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

export interface CollectionFormData {
  accessionNumber?: string;
  title: string;
  creator?: string;
  objectType?: string | string[];
  objectName?: string;
  culture?: string;
  period?: string;
  dateCreated?: string;
  materials?: string | string[];
  dimensions?: string;
  dimensionDiameter?: string;
  dimensionWeight?: string | number;
  weightUnit?: string;
  description?: string;
  condition?: string;
  inscriptions?: string;
  provenance?: string;
  exhibitionHistory?: string;
  donated_by?: string[];
  donated_date?: string;
  donation_info?: string;
  acquisitionMethod?: string;
  previous_owners?: string[];
  links?: LinkEntry[];
  parentObjectId?: string;
  currentLocationId?: string;
  collectionGroupId?: string;
  collectionGroupIds?: string[];
  alternateAccessionNumbers?: string[];
  ownershipHistory?: OwnershipEntry[];
  collectionType?: CollectionType;
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

export interface CollectionFormTabProps {
  formData: CollectionFormData;
  updateField: UpdateCollectionFormField;
  placeholders: (key: string) => string;
  currentOrganizationId: string;
  isLocationTrackingEnabled: boolean;
}
