import type { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import type { FunctionReturnType } from "convex/server";
import { parseStringListField } from "@/lib/string-list-field";
import type {
  CollectionFormData,
  DraftMediaItem,
  LinkEntry,
  OwnershipEntry,
} from "./types";

type CollectionDoc = NonNullable<
  FunctionReturnType<typeof api.collections.get>
>;
type MediaItem = NonNullable<FunctionReturnType<typeof api.media.list>>[number];

export function formatMeasurementValue(value?: number, unit?: string) {
  if (value === undefined) {
    return "";
  }

  return unit ? `${value} ${unit}` : value.toString();
}

export const formatWeightValue = formatMeasurementValue;

export function parseOptionalWeight(value?: string | number) {
  if (typeof value === "number") {
    return Number.isFinite(value) && value >= 0
      ? { isValid: true as const, value, unit: undefined }
      : { isValid: false as const, value: undefined, unit: undefined };
  }

  const trimmed = value?.trim();
  if (!trimmed) {
    return { isValid: true as const, value: undefined, unit: undefined };
  }

  const match = trimmed.match(
    /^(\d+(?:[,.]\d+)?)(?:\s*([a-zA-Z][a-zA-Z.]*))?$/,
  );
  const quantity = match?.[1];
  if (!quantity) {
    return { isValid: false as const, value: undefined, unit: undefined };
  }

  const parsed = Number(quantity.replace(",", "."));
  return Number.isFinite(parsed) && parsed >= 0
    ? { isValid: true as const, value: parsed, unit: match[2] }
    : { isValid: false as const, value: undefined, unit: undefined };
}

export function normalizeOptionalString(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : "";
}

export function createOwnershipEntryLocalId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `ownership-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function createLinkEntryLocalId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `link-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function withOwnershipEntryLocalIds(entries?: OwnershipEntry[]) {
  return (entries || []).map((entry) =>
    entry.localId
      ? entry
      : {
          ...entry,
          localId: createOwnershipEntryLocalId(),
        },
  );
}

export function withLinkEntryLocalIds(entries?: LinkEntry[]) {
  return (entries || []).map((entry) =>
    entry.localId
      ? entry
      : {
          ...entry,
          localId: createLinkEntryLocalId(),
        },
  );
}

export function createEmptyFormData(
  prefilledCollectionGroupId?: string,
): CollectionFormData {
  return {
    accessionNumber: "",
    title: "",
    creator: "",
    objectType: [],
    objectName: "",
    culture: "",
    period: "",
    dateCreated: "",
    materials: [],
    dimensions: "",
    dimensionDiameter: "",
    dimensionWeight: "",
    weightUnit: "",
    description: "",
    condition: "",
    inscriptions: "",
    provenance: "",
    exhibitionHistory: "",
    donated_by: [],
    donated_date: "",
    donation_info: "",
    acquisitionMethod: "",
    previous_owners: [],
    links: [{ url: "", label: "" }],
    parentObjectId: "",
    currentLocationId: "",
    collectionGroupId: prefilledCollectionGroupId || "",
    collectionGroupIds: prefilledCollectionGroupId
      ? [prefilledCollectionGroupId]
      : [],
    alternateAccessionNumbers: [],
    ownershipHistory: [],
    collectionType: "general",
    displayStatus: undefined,
    isPubliclyVisible: false,
    isHighResDownloadable: false,
    isSearchable: true,
    isValuationVisible: false,
    publicSlug: "",
  };
}

export function getFormSignature(formData: CollectionFormData) {
  return JSON.stringify({
    ...formData,
    objectType: Array.isArray(formData.objectType)
      ? formData.objectType
      : formData.objectType
        ? [formData.objectType]
        : [],
    materials: Array.isArray(formData.materials)
      ? formData.materials
      : formData.materials
        ? [formData.materials]
        : [],
    donated_by: formData.donated_by || [],
    previous_owners: formData.previous_owners || [],
    collectionGroupIds: formData.collectionGroupIds || [],
    alternateAccessionNumbers: formData.alternateAccessionNumbers || [],
    ownershipHistory:
      formData.ownershipHistory?.map(
        ({ localId: _localId, ...entry }) => entry,
      ) || [],
    links:
      formData.links?.map(({ localId: _localId, ...entry }) => entry) || [],
  });
}

export function createFormDataFromDraftObject(
  draftObjectData: Partial<CollectionFormData> | undefined,
  prefilledCollectionGroupId?: string,
): CollectionFormData {
  return {
    ...createEmptyFormData(prefilledCollectionGroupId),
    ...draftObjectData,
    objectType: Array.isArray(draftObjectData?.objectType)
      ? draftObjectData.objectType
      : [],
    materials: Array.isArray(draftObjectData?.materials)
      ? draftObjectData.materials
      : [],
    donated_by: draftObjectData?.donated_by || [],
    previous_owners: draftObjectData?.previous_owners || [],
    collectionGroupIds:
      draftObjectData?.collectionGroupIds ||
      (draftObjectData?.collectionGroupId
        ? [draftObjectData.collectionGroupId]
        : prefilledCollectionGroupId
          ? [prefilledCollectionGroupId]
          : []),
    collectionGroupId:
      draftObjectData?.collectionGroupId || prefilledCollectionGroupId || "",
    alternateAccessionNumbers: draftObjectData?.alternateAccessionNumbers || [],
    ownershipHistory: draftObjectData?.ownershipHistory || [],
    links:
      draftObjectData?.links && draftObjectData.links.length > 0
        ? draftObjectData.links
        : [{ url: "", label: "" }],
    dimensionWeight:
      typeof draftObjectData?.dimensionWeight === "number"
        ? formatWeightValue(
            draftObjectData.dimensionWeight,
            draftObjectData.weightUnit,
          )
        : "",
    weightUnit: draftObjectData?.weightUnit || "",
  };
}

export function buildObjectDraftPayload(formData: CollectionFormData) {
  const parsedDimensionWeight = parseOptionalWeight(formData.dimensionWeight);

  if (!parsedDimensionWeight.isValid) {
    throw new Error(
      "Weight must be a valid non-negative number with an optional unit.",
    );
  }

  return {
    accessionNumber: formData.accessionNumber?.trim()
      ? formData.accessionNumber
      : undefined,
    title: formData.title.trim(),
    creator: formData.creator?.trim() || undefined,
    objectType: Array.isArray(formData.objectType)
      ? formData.objectType.filter(Boolean)
      : [],
    objectName: formData.objectName?.trim() || undefined,
    culture: formData.culture?.trim() || undefined,
    period: formData.period?.trim() || undefined,
    dateCreated: formData.dateCreated?.trim() || undefined,
    materials: Array.isArray(formData.materials)
      ? formData.materials.filter(Boolean)
      : [],
    dimensions: formData.dimensions?.trim() || undefined,
    dimensionDiameter: formData.dimensionDiameter?.trim() || undefined,
    dimensionWeight: parsedDimensionWeight.value,
    weightUnit:
      parsedDimensionWeight.value === undefined
        ? undefined
        : parsedDimensionWeight.unit ||
          formData.weightUnit?.trim() ||
          undefined,
    description: formData.description?.trim() || undefined,
    condition: formData.condition?.trim() || undefined,
    inscriptions: formData.inscriptions?.trim() || undefined,
    provenance: formData.provenance?.trim() || undefined,
    exhibitionHistory: formData.exhibitionHistory?.trim() || undefined,
    donated_by: formData.donated_by?.filter(Boolean) || [],
    donated_date: formData.donated_date?.trim() || undefined,
    donation_info: formData.donation_info?.trim() || undefined,
    acquisitionMethod: formData.acquisitionMethod?.trim() || undefined,
    previous_owners: formData.previous_owners?.filter(Boolean) || [],
    links:
      formData.links?.filter((link) => link.url.trim().length > 0) || undefined,
    parentObjectId: formData.parentObjectId
      ? (formData.parentObjectId as Id<"collections">)
      : undefined,
    currentLocationId: formData.currentLocationId
      ? (formData.currentLocationId as Id<"locations">)
      : undefined,
    collectionGroupId: formData.collectionGroupId
      ? (formData.collectionGroupId as Id<"collectionGroups">)
      : undefined,
    collectionGroupIds: formData.collectionGroupIds?.flatMap(
      (collectionGroupId) =>
        collectionGroupId ? [collectionGroupId as Id<"collectionGroups">] : [],
    ),
    alternateAccessionNumbers:
      formData.alternateAccessionNumbers?.filter(Boolean) || [],
    ownershipHistory:
      formData.ownershipHistory?.filter(
        (entry) => entry.owner.trim().length > 0,
      ) || [],
    collectionType: formData.collectionType,
    displayStatus: formData.displayStatus,
    isPubliclyVisible: formData.isPubliclyVisible ?? false,
    isHighResDownloadable: formData.isHighResDownloadable ?? false,
    isSearchable: formData.isSearchable ?? true,
    isValuationVisible: formData.isValuationVisible ?? false,
    publicSlug: formData.publicSlug?.trim() || undefined,
  };
}

export function buildDraftMediaPayload(draftMedia: DraftMediaItem[]) {
  return draftMedia.map(({ url: _url, ...item }) => item);
}

export function createInitialFormData(
  collection: CollectionDoc,
  collectionGroups: Array<{ _id: Id<"collectionGroups"> }> = [],
): CollectionFormData {
  let objectTypeArray: string[] = [];
  if (collection.objectType) {
    try {
      const parsed = JSON.parse(collection.objectType);
      objectTypeArray = Array.isArray(parsed)
        ? parsed
        : [collection.objectType];
    } catch {
      objectTypeArray = [collection.objectType];
    }
  }

  const collectionGroupIds =
    collectionGroups.length > 0
      ? collectionGroups.map((group) => group._id as string)
      : collection.collectionGroupId
        ? [collection.collectionGroupId as string]
        : [];

  return {
    title: collection.title,
    creator: collection.creator || "",
    objectType: objectTypeArray,
    objectName: collection.objectName || "",
    culture: collection.culture || "",
    period: collection.period || "",
    dateCreated: collection.dateCreated || "",
    materials: parseStringListField(collection.materials),
    dimensions: collection.dimensions || "",
    dimensionDiameter:
      collection.dimensionDiameter ||
      (!collection.dimensionHeight &&
      !collection.dimensionDepth &&
      collection.dimensionWidth !== undefined
        ? formatMeasurementValue(
            collection.dimensionWidth,
            collection.dimensionUnit,
          )
        : ""),
    dimensionWeight: formatMeasurementValue(
      collection.dimensionWeight,
      collection.weightUnit,
    ),
    weightUnit: collection.weightUnit || "",
    inscriptions: collection.inscriptions || "",
    description: collection.description || "",
    condition: collection.condition || "",
    provenance: collection.provenance || "",
    exhibitionHistory: collection.exhibitionHistory || "",
    donated_by: collection.donated_by || [],
    donated_date: collection.donated_date || "",
    donation_info: collection.donation_info || "",
    acquisitionMethod: collection.acquisitionMethod || "",
    previous_owners: collection.previous_owners || [],
    links:
      collection.links && collection.links.length > 0
        ? withLinkEntryLocalIds(collection.links)
        : [{ localId: createLinkEntryLocalId(), url: "", label: "" }],
    parentObjectId: (collection.parentObjectId as string) || "",
    currentLocationId: (collection.currentLocationId as string) || "",
    collectionGroupId: collectionGroupIds[0] || "",
    collectionGroupIds,
    alternateAccessionNumbers: collection.alternateAccessionNumbers || [],
    ownershipHistory: withOwnershipEntryLocalIds(collection.ownershipHistory),
    displayStatus: collection.displayStatus,
    isPubliclyVisible: collection.isPubliclyVisible ?? false,
    isHighResDownloadable: collection.isHighResDownloadable ?? false,
    isSearchable: collection.isSearchable ?? true,
    isValuationVisible: collection.isValuationVisible ?? false,
    publicSlug: collection.publicSlug ?? "",
  };
}

export function getMediaSignature(media: MediaItem[]) {
  return JSON.stringify(
    media.map((item) => ({
      id: item._id,
      fileName: item.fileName,
      fileType: item.fileType,
      url: item.url,
      thumbnailUrl: item.thumbnailUrl,
      isPrimary: item.isPrimary,
      mediaCategory: (item as { mediaCategory?: "image" | "document" })
        .mediaCategory,
    })),
  );
}

export function getStatusBadgeClass(status: CollectionDoc["status"]) {
  switch (status) {
    case "active":
      return "bg-emerald-500/10 text-emerald-400";
    case "loaned":
      return "bg-blue-500/10 text-blue-400";
    case "deaccessioned":
      return "bg-red-500/10 text-red-400";
    default:
      return "bg-muted text-muted-foreground";
  }
}

export const EMPTY_EDIT_FORM: CollectionFormData = {
  title: "",
  creator: "",
  objectType: [],
  objectName: "",
  culture: "",
  period: "",
  dateCreated: "",
  materials: [],
  dimensions: "",
  dimensionDiameter: "",
  dimensionWeight: "",
  weightUnit: "",
  inscriptions: "",
  description: "",
  condition: "",
  provenance: "",
  exhibitionHistory: "",
  donated_by: [],
  donated_date: "",
  donation_info: "",
  acquisitionMethod: "",
  previous_owners: [],
  links: [{ localId: createLinkEntryLocalId(), url: "", label: "" }],
  parentObjectId: "",
  currentLocationId: "",
  collectionGroupId: "",
  collectionGroupIds: [],
  alternateAccessionNumbers: [],
  ownershipHistory: [],
  displayStatus: undefined,
  isPubliclyVisible: false,
  isHighResDownloadable: false,
  isSearchable: true,
  isValuationVisible: false,
  publicSlug: "",
};
