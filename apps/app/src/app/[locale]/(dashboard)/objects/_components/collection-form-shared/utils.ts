import type { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import {
  type CollectionModuleId,
  type CollectionType,
  isCollectionModuleId,
  isCollectionType,
} from "@v1/backend/convex/utils/moduleCatalog";
import type { FunctionReturnType } from "convex/server";
import { z } from "zod";
import {
  comparableProductionDate,
  draftFromEdtf,
  EMPTY_PRODUCTION_DATE_DRAFT,
  edtfFromDraft,
  hasOpenQualifierInRange,
  type ProductionDateDraft,
  productionDateDraftSchema,
  productionDateFromDraft,
} from "@/components/production-date/production-date-draft";
import { fieldErrorsFromZod } from "@/lib/record-form";
import { parseStringListField } from "../../../../../../lib/string-list-field";
import { toObjectDraftTypeDetails } from "../object-type-details/type-detail-values";
import { STRUCTURED_DATE_MADE_ID } from "./constants";
import type {
  CollectionFormData,
  DraftMediaItem,
  InscriptionMarkEntry,
  LinkEntry,
  ObjectDraftData,
  OwnershipEntry,
} from "./types";

type CollectionDoc = NonNullable<
  FunctionReturnType<typeof api.collections.get>
>;
type MediaItem = NonNullable<FunctionReturnType<typeof api.media.list>>[number];

/** Every key of `T`, so adding a field to the contract fails until mapped. */
type EveryField<T> = { [K in keyof Required<T>]: T[K] };

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

/** A measured dimension as typed: blank, or a number of 0 or more. */
export function parseOptionalMeasurement(value?: string) {
  const trimmed = value?.trim();
  if (!trimmed) return { isValid: true as const, value: undefined };
  const parsed = Number(trimmed.replace(",", "."));
  return Number.isFinite(parsed) && parsed >= 0
    ? { isValid: true as const, value: parsed }
    : { isValid: false as const, value: undefined };
}

function measurementText(value?: number) {
  return value === undefined ? "" : String(value);
}

export function normalizeOptionalString(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : "";
}

function createLocalId(prefix: string) {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function createOwnershipEntryLocalId() {
  return createLocalId("ownership");
}

export function createLinkEntryLocalId() {
  return createLocalId("link");
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

export function withInscriptionMarkLocalIds(entries?: InscriptionMarkEntry[]) {
  return (entries || []).map((entry) =>
    entry.localId ? entry : { ...entry, localId: createLocalId("mark") },
  );
}

/** Rows staff filled in, without the ids the editor uses for rows. */
function savedInscriptionMarks(entries?: InscriptionMarkEntry[]) {
  return (entries || []).flatMap(({ localId: _localId, ...mark }) =>
    mark.label.trim() || mark.description.trim() ? [mark] : [],
  );
}

function savedLinks(entries?: LinkEntry[]) {
  return (entries || []).flatMap(({ localId: _localId, ...link }) =>
    link.url.trim().length > 0 ? [link] : [],
  );
}

function asList(value?: string | string[]) {
  return Array.isArray(value) ? value : value ? [value] : [];
}

export function createEmptyFormData(
  prefilledCollectionGroupId?: string,
): CollectionFormData {
  return {
    accessionNumber: "",
    title: "",
    alternativeTitle: "",
    creator: "",
    objectType: [],
    objectName: "",
    culture: "",
    period: "",
    dateCreated: "",
    dateCreatedEdtf: EMPTY_PRODUCTION_DATE_DRAFT,
    materials: [],
    technique: "",
    dimensions: "",
    dimensionHeight: "",
    dimensionWidth: "",
    dimensionDepth: "",
    dimensionUnit: "",
    dimensionDiameter: "",
    dimensionWeight: "",
    weightUnit: "",
    description: "",
    condition: "",
    inscriptions: "",
    inscriptionMarks: [],
    tags: [],
    provenance: "",
    exhibitionHistory: "",
    donated_by: [],
    donated_date: "",
    donation_info: "",
    acquisitionMethod: "",
    creditLine: "",
    legalRestrictions: false,
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

/**
 * The catalog values staff can see, by field: editor row ids and empty
 * placeholder rows are not changes, and lists compare as lists.
 */
export function comparableCollectionForm(
  formData: CollectionFormData,
): Record<string, unknown> {
  const text = (value?: string) => value ?? "";
  return {
    accessionNumber: text(formData.accessionNumber),
    title: formData.title,
    alternativeTitle: text(formData.alternativeTitle),
    creator: text(formData.creator),
    objectType: asList(formData.objectType),
    objectName: text(formData.objectName),
    culture: text(formData.culture),
    period: text(formData.period),
    dateCreated: text(formData.dateCreated),
    dateCreatedEdtf: comparableProductionDate(formData.dateCreatedEdtf),
    materials: asList(formData.materials),
    technique: text(formData.technique),
    dimensions: text(formData.dimensions),
    dimensionHeight: text(formData.dimensionHeight),
    dimensionWidth: text(formData.dimensionWidth),
    dimensionDepth: text(formData.dimensionDepth),
    dimensionUnit: text(formData.dimensionUnit),
    dimensionDiameter: text(formData.dimensionDiameter),
    dimensionWeight: String(formData.dimensionWeight ?? ""),
    weightUnit: text(formData.weightUnit),
    description: text(formData.description),
    condition: text(formData.condition),
    inscriptions: text(formData.inscriptions),
    inscriptionMarks: savedInscriptionMarks(formData.inscriptionMarks),
    tags: formData.tags ?? [],
    provenance: text(formData.provenance),
    exhibitionHistory: text(formData.exhibitionHistory),
    donated_by: formData.donated_by ?? [],
    donated_date: text(formData.donated_date),
    donation_info: text(formData.donation_info),
    acquisitionMethod: text(formData.acquisitionMethod),
    creditLine: text(formData.creditLine),
    legalRestrictions: formData.legalRestrictions ?? false,
    previous_owners: formData.previous_owners ?? [],
    links: savedLinks(formData.links),
    parentObjectId: text(formData.parentObjectId),
    currentLocationId: text(formData.currentLocationId),
    collectionGroupId: text(formData.collectionGroupId),
    // Membership is a set; which group is primary is its own field.
    collectionGroupIds: (formData.collectionGroupIds ?? []).toSorted(),
    alternateAccessionNumbers: formData.alternateAccessionNumbers ?? [],
    ownershipHistory: (formData.ownershipHistory ?? []).map(
      ({ localId: _localId, ...entry }) => entry,
    ),
    collectionType: formData.collectionType ?? "general",
    typeDetails:
      toObjectDraftTypeDetails(formData.collectionType, formData.typeDetails) ??
      null,
    displayStatus: text(formData.displayStatus),
    isPubliclyVisible: formData.isPubliclyVisible ?? false,
    isHighResDownloadable: formData.isHighResDownloadable ?? false,
    isSearchable: formData.isSearchable ?? true,
    isValuationVisible: formData.isValuationVisible ?? false,
    publicSlug: text(formData.publicSlug),
  };
}

const ownershipEntrySchema = z.object({
  localId: z.string().optional(),
  owner: z.string(),
  startYear: z.string().optional(),
  endYear: z.string().optional(),
  description: z.string().optional(),
  verified: z.boolean().optional(),
  verificationSource: z.string().optional(),
});

/** Catalog input as kept on a device; used to read it back safely. */
export const collectionFormDataSchema = z.object({
  accessionNumber: z.string().optional(),
  title: z.string(),
  alternativeTitle: z.string().optional(),
  creator: z.string().optional(),
  objectType: z.union([z.string(), z.array(z.string())]).optional(),
  objectName: z.string().optional(),
  culture: z.string().optional(),
  period: z.string().optional(),
  dateCreated: z.string().optional(),
  dateCreatedEdtf: productionDateDraftSchema.optional(),
  materials: z.union([z.string(), z.array(z.string())]).optional(),
  technique: z.string().optional(),
  dimensions: z.string().optional(),
  dimensionHeight: z.string().optional(),
  dimensionWidth: z.string().optional(),
  dimensionDepth: z.string().optional(),
  dimensionUnit: z.string().optional(),
  dimensionDiameter: z.string().optional(),
  dimensionWeight: z.union([z.string(), z.number()]).optional(),
  weightUnit: z.string().optional(),
  description: z.string().optional(),
  condition: z.string().optional(),
  inscriptions: z.string().optional(),
  inscriptionMarks: z
    .array(
      z.object({
        localId: z.string().optional(),
        label: z.string(),
        description: z.string(),
      }),
    )
    .optional(),
  tags: z.array(z.string()).optional(),
  provenance: z.string().optional(),
  exhibitionHistory: z.string().optional(),
  donated_by: z.array(z.string()).optional(),
  donated_date: z.string().optional(),
  donation_info: z.string().optional(),
  acquisitionMethod: z.string().optional(),
  creditLine: z.string().optional(),
  legalRestrictions: z.boolean().optional(),
  previous_owners: z.array(z.string()).optional(),
  links: z
    .array(
      z.object({
        localId: z.string().optional(),
        url: z.string(),
        label: z.string().optional(),
      }),
    )
    .optional(),
  parentObjectId: z.string().optional(),
  currentLocationId: z.string().optional(),
  collectionGroupId: z.string().optional(),
  collectionGroupIds: z.array(z.string()).optional(),
  alternateAccessionNumbers: z.array(z.string()).optional(),
  ownershipHistory: z.array(ownershipEntrySchema).optional(),
  collectionType: z
    .custom<CollectionType>(
      (value) => typeof value === "string" && isCollectionType(value),
    )
    .optional(),
  typeDetails: z
    .object({
      collectionType: z.custom<CollectionModuleId>(
        (value) => typeof value === "string" && isCollectionModuleId(value),
      ),
      fields: z.record(
        z.union([z.string(), z.number(), z.boolean(), z.array(z.string())]),
      ),
    })
    .optional(),
  displayStatus: z.string().optional(),
  isPubliclyVisible: z.boolean().optional(),
  isHighResDownloadable: z.boolean().optional(),
  isSearchable: z.boolean().optional(),
  isValuationVisible: z.boolean().optional(),
  publicSlug: z.string().optional(),
});

export interface CollectionFormRuleMessages {
  titleRequired: string;
  weightInvalid: string;
  measurementInvalid: string;
  productionDateInvalid: string;
  /** By or After on From while To is given too. */
  productionDateOpenInRange: string;
}

/** Shared catalog rules; the server applies the same ones on save. */
export function collectionFormRules(messages: CollectionFormRuleMessages) {
  const measurement = z
    .string()
    .optional()
    .refine(
      (value) => parseOptionalMeasurement(value).isValid,
      messages.measurementInvalid,
    );
  return z.object({
    title: z
      .string()
      .refine((title) => title.trim().length > 0, messages.titleRequired),
    dimensionWeight: z
      .union([z.string(), z.number()])
      .optional()
      .refine(
        (value) => parseOptionalWeight(value).isValid,
        messages.weightInvalid,
      ),
    dimensionHeight: measurement,
    dimensionWidth: measurement,
    dimensionDepth: measurement,
    dateCreatedEdtf: z
      .custom<ProductionDateDraft>()
      .optional()
      .superRefine((draft, context) => {
        if (productionDateFromDraft(draft) !== null) return;
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: hasOpenQualifierInRange(draft)
            ? messages.productionDateOpenInRange
            : messages.productionDateInvalid,
        });
      }),
  });
}

export function validateCollectionFormData(
  formData: CollectionFormData,
  messages: CollectionFormRuleMessages,
): Record<string, string> {
  const result = collectionFormRules(messages).safeParse(formData);
  return result.success ? {} : fieldErrorsFromZod(result.error);
}

/** Where each catalog field is edited: its tab, and the input to focus. */
export function collectionFieldLocation(field: string): {
  tab: string | null;
  elementId: string;
} {
  switch (field) {
    case "title":
      return { tab: null, elementId: "hero-title" };
    case "description":
      return { tab: null, elementId: "hero-description" };
    case "materials":
    case "technique":
    case "condition":
    case "conditionChangeNote":
    case "dimensions":
    case "dimensionHeight":
    case "dimensionWidth":
    case "dimensionDepth":
    case "dimensionUnit":
    case "dimensionDiameter":
    case "dimensionWeight":
    case "weightUnit":
    case "inscriptions":
    case "inscriptionMarks":
      return { tab: "physical", elementId: field };
    case "provenance":
    case "exhibitionHistory":
    case "ownershipHistory":
    case "links":
      return { tab: "provenance", elementId: field };
    case "acquisitionMethod":
    case "donated_by":
    case "donated_date":
    case "donation_info":
    case "creditLine":
    case "legalRestrictions":
      return { tab: "accession", elementId: field };
    case "dateCreatedEdtf":
      return {
        tab: "general",
        elementId: `${STRUCTURED_DATE_MADE_ID}-from-precision`,
      };
    case "parentObjectId":
      return { tab: "placement", elementId: "placementParentObjectId" };
    case "currentLocationId":
      return { tab: "placement", elementId: "placementCurrentLocationId" };
    case "collectionGroupId":
    case "collectionGroupIds":
      return { tab: "placement", elementId: "placementCollectionGroupId" };
    case "displayStatus":
    case "isPubliclyVisible":
    case "isHighResDownloadable":
    case "isSearchable":
    case "isValuationVisible":
    case "publicSlug":
      return { tab: "digital", elementId: field };
    default:
      return { tab: "general", elementId: field };
  }
}

export function createFormDataFromDraftObject(
  draftObjectData: Partial<ObjectDraftData> | undefined,
  prefilledCollectionGroupId?: string,
): CollectionFormData {
  const empty = createEmptyFormData(prefilledCollectionGroupId);
  return {
    ...empty,
    ...draftObjectData,
    parentObjectId: draftObjectData?.parentObjectId ?? "",
    currentLocationId: draftObjectData?.currentLocationId ?? "",
    collectionType: draftObjectData?.collectionType ?? empty.collectionType,
    objectType: Array.isArray(draftObjectData?.objectType)
      ? draftObjectData.objectType
      : [],
    materials: Array.isArray(draftObjectData?.materials)
      ? draftObjectData.materials
      : [],
    donated_by: draftObjectData?.donated_by || [],
    previous_owners: draftObjectData?.previous_owners || [],
    tags: draftObjectData?.tags || [],
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
    ownershipHistory: withOwnershipEntryLocalIds(
      draftObjectData?.ownershipHistory,
    ),
    inscriptionMarks: withInscriptionMarkLocalIds(
      draftObjectData?.inscriptionMarks,
    ),
    links: withLinkEntryLocalIds(
      draftObjectData?.links && draftObjectData.links.length > 0
        ? draftObjectData.links
        : [{ url: "", label: "" }],
    ),
    dimensionHeight: measurementText(draftObjectData?.dimensionHeight),
    dimensionWidth: measurementText(draftObjectData?.dimensionWidth),
    dimensionDepth: measurementText(draftObjectData?.dimensionDepth),
    dimensionWeight:
      typeof draftObjectData?.dimensionWeight === "number"
        ? formatWeightValue(
            draftObjectData.dimensionWeight,
            draftObjectData.weightUnit,
          )
        : "",
    weightUnit: draftObjectData?.weightUnit || "",
    typeDetails: draftObjectData?.typeDetails,
    dateCreatedEdtf: draftFromEdtf(draftObjectData?.dateCreatedEdtf),
  };
}

export function buildObjectDraftPayload(
  formData: CollectionFormData,
): ObjectDraftData {
  const parsedDimensionWeight = parseOptionalWeight(formData.dimensionWeight);

  if (!parsedDimensionWeight.isValid) {
    throw new Error(
      "Weight must be a valid non-negative number with an optional unit.",
    );
  }

  const payload: EveryField<ObjectDraftData> = {
    accessionNumber: formData.accessionNumber?.trim()
      ? formData.accessionNumber
      : undefined,
    title: formData.title.trim(),
    alternativeTitle: formData.alternativeTitle?.trim() || undefined,
    creator: formData.creator?.trim() || undefined,
    objectType: Array.isArray(formData.objectType)
      ? formData.objectType.filter(Boolean)
      : [],
    objectName: formData.objectName?.trim() || undefined,
    culture: formData.culture?.trim() || undefined,
    period: formData.period?.trim() || undefined,
    dateCreated: formData.dateCreated?.trim() || undefined,
    dateCreatedEdtf: edtfFromDraft(formData.dateCreatedEdtf) ?? undefined,
    materials: Array.isArray(formData.materials)
      ? formData.materials.filter(Boolean)
      : [],
    technique: formData.technique?.trim() || undefined,
    dimensions: formData.dimensions?.trim() || undefined,
    dimensionHeight: parseOptionalMeasurement(formData.dimensionHeight).value,
    dimensionWidth: parseOptionalMeasurement(formData.dimensionWidth).value,
    dimensionDepth: parseOptionalMeasurement(formData.dimensionDepth).value,
    dimensionUnit: formData.dimensionUnit?.trim() || undefined,
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
    inscriptionMarks: savedInscriptionMarks(formData.inscriptionMarks),
    tags:
      formData.tags?.flatMap((tag) => (tag.trim() ? [tag.trim()] : [])) ?? [],
    creditLine: formData.creditLine?.trim() || undefined,
    legalRestrictions: formData.legalRestrictions ?? false,
    provenance: formData.provenance?.trim() || undefined,
    exhibitionHistory: formData.exhibitionHistory?.trim() || undefined,
    donated_by: formData.donated_by?.filter(Boolean) || [],
    donated_date: formData.donated_date?.trim() || undefined,
    donation_info: formData.donation_info?.trim() || undefined,
    acquisitionMethod: formData.acquisitionMethod?.trim() || undefined,
    previous_owners: formData.previous_owners?.filter(Boolean) || [],
    links: savedLinks(formData.links),
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
      formData.ownershipHistory?.flatMap(({ localId: _localId, ...entry }) =>
        entry.owner.trim().length > 0 ? [entry] : [],
      ) || [],
    collectionType: formData.collectionType,
    typeDetails: toObjectDraftTypeDetails(
      formData.collectionType,
      formData.typeDetails,
    ),
    displayStatus: formData.displayStatus,
    isPubliclyVisible: formData.isPubliclyVisible ?? false,
    isHighResDownloadable: formData.isHighResDownloadable ?? false,
    isSearchable: formData.isSearchable ?? true,
    isValuationVisible: formData.isValuationVisible ?? false,
    publicSlug: formData.publicSlug?.trim() || undefined,
  };
  return payload;
}

export function buildDraftMediaPayload(draftMedia: DraftMediaItem[]) {
  return draftMedia.map(({ url: _url, ...item }) => item);
}

export function createInitialFormData(
  collection: CollectionDoc,
  collectionGroups: Array<{
    _id: Id<"collectionGroups">;
    role?: "primary" | "secondary";
  }> = [],
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

  const primaryGroupId =
    (collectionGroups.find((group) => group.role === "primary")?._id as
      | string
      | undefined) ?? (collection.collectionGroupId as string | undefined);
  const collectionGroupIds =
    collectionGroups.length > 0
      ? [
          ...new Set([
            ...(primaryGroupId ? [primaryGroupId] : []),
            ...collectionGroups.map((group) => group._id as string),
          ]),
        ]
      : collection.collectionGroupId
        ? [collection.collectionGroupId as string]
        : [];

  return {
    title: collection.title,
    alternativeTitle: collection.alternativeTitle || "",
    creator: collection.creator || "",
    objectType: objectTypeArray,
    objectName: collection.objectName || "",
    culture: collection.culture || "",
    period: collection.period || "",
    dateCreated: collection.dateCreated || "",
    dateCreatedEdtf: draftFromEdtf(collection.dateCreatedEdtf),
    materials: parseStringListField(collection.materials),
    technique: collection.technique || "",
    dimensions: collection.dimensions || "",
    dimensionHeight: measurementText(collection.dimensionHeight),
    dimensionWidth: measurementText(collection.dimensionWidth),
    dimensionDepth: measurementText(collection.dimensionDepth),
    dimensionUnit: collection.dimensionUnit || "",
    dimensionDiameter: collection.dimensionDiameter || "",
    dimensionWeight: formatMeasurementValue(
      collection.dimensionWeight ?? undefined,
      collection.weightUnit,
    ),
    weightUnit: collection.weightUnit || "",
    inscriptions: collection.inscriptions || "",
    inscriptionMarks: withInscriptionMarkLocalIds(collection.inscriptionMarks),
    tags: collection.tags || [],
    description: collection.description || "",
    condition: collection.condition || "",
    provenance: collection.provenance || "",
    exhibitionHistory: collection.exhibitionHistory || "",
    donated_by: collection.donated_by || [],
    donated_date: collection.donated_date || "",
    donation_info: collection.donation_info || "",
    acquisitionMethod: collection.acquisitionMethod || "",
    creditLine: collection.creditLine || "",
    legalRestrictions: collection.legalRestrictions ?? false,
    previous_owners: collection.previous_owners || [],
    links:
      collection.links && collection.links.length > 0
        ? withLinkEntryLocalIds(collection.links)
        : [{ localId: createLinkEntryLocalId(), url: "", label: "" }],
    parentObjectId: (collection.parentObjectId as string) || "",
    currentLocationId: (collection.currentLocationId as string) || "",
    collectionGroupId:
      collectionGroups.find((group) => group.role === "primary")?._id ??
      collection.collectionGroupId ??
      "",
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
  ...createEmptyFormData(),
  accessionNumber: undefined,
  collectionType: undefined,
};
