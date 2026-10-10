import type { Id } from "@v1/backend/convex/_generated/dataModel";
import {
  type CollectionType,
  isCollectionType,
} from "@v1/backend/convex/utils/moduleCatalog";
import { z } from "zod";
import type {
  CollectionFormData,
  DraftMediaItem,
  ObjectDraftData,
} from "../collection-form-shared/types";
import {
  collectionFormDataSchema,
  comparableCollectionForm,
  createEmptyFormData,
  createFormDataFromDraftObject,
} from "../collection-form-shared/utils";
import { hasTypeDetailValues } from "../object-type-details/type-detail-values";

/** Intake input: the catalog fields plus the files already on the draft. */
export interface ObjectRequestValues extends CollectionFormData {
  draftMedia: DraftMediaItem[];
}

export function emptyObjectRequestValues(
  prefilledCollectionGroupId?: string,
): ObjectRequestValues {
  return { ...createEmptyFormData(prefilledCollectionGroupId), draftMedia: [] };
}

export function objectRequestValuesFromDraft(
  draft: ObjectDraftData,
  draftMedia: DraftMediaItem[] | undefined,
  prefilledCollectionGroupId?: string,
): ObjectRequestValues {
  return {
    ...createFormDataFromDraftObject(draft, prefilledCollectionGroupId),
    draftMedia: draftMedia ?? [],
  };
}

export function comparableObjectRequest(
  values: ObjectRequestValues,
): Record<string, unknown> {
  return {
    ...comparableCollectionForm(values),
    draftMedia: values.draftMedia.map(({ url: _url, ...item }) => item),
  };
}

const objectRequestValuesSchema = collectionFormDataSchema.extend({
  draftMedia: z.array(
    z.object({
      storageId: z.custom<Id<"_storage">>((value) => typeof value === "string"),
      fileName: z.string(),
      fileSize: z.number(),
      mimeType: z.string(),
      mediaCategory: z.enum(["image", "document"]),
      isPrimary: z.boolean(),
      url: z.string().nullable().optional(),
    }),
  ),
});

export function parseObjectRequestValues(
  stored: unknown,
): ObjectRequestValues | null {
  const parsed = objectRequestValuesSchema.safeParse(stored);
  return parsed.success ? parsed.data : null;
}

/** Details are kept only for the collection type the draft now has. */
export function withCollectionType(
  values: ObjectRequestValues,
  collectionType: CollectionType,
): ObjectRequestValues {
  return {
    ...values,
    collectionType,
    typeDetails:
      values.typeDetails?.collectionType === collectionType
        ? values.typeDetails
        : undefined,
  };
}

/**
 * The collection type staff picked, and whether switching to it would drop
 * type-specific details they entered (which needs their confirmation).
 */
export function collectionTypeChange(
  values: ObjectRequestValues,
  value: unknown,
): { collectionType: CollectionType; losesDetails: boolean } | null {
  const collectionType =
    typeof value === "string" && isCollectionType(value) ? value : "general";
  if (collectionType === values.collectionType) return null;
  const { typeDetails } = values;
  return {
    collectionType,
    losesDetails:
      typeDetails?.collectionType !== collectionType &&
      hasTypeDetailValues(typeDetails),
  };
}
