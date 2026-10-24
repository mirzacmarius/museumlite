import type { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { z } from "zod";
import { edtfFromDraft } from "@/components/production-date/production-date-draft";
import { serializeStringListField } from "@/lib/string-list-field";
import type { CollectionFormData } from "../collection-form-shared/types";
import {
  collectionFormDataSchema,
  comparableCollectionForm,
  createInitialFormData,
  parseOptionalMeasurement,
  parseOptionalWeight,
} from "../collection-form-shared/utils";

type CollectionDoc = NonNullable<
  FunctionReturnType<typeof api.collections.get>
>;
interface CollectionGroupMembership {
  _id: Id<"collectionGroups">;
  role?: "primary" | "secondary";
}

/** Catalog edit input: the shared fields plus the note on a condition change. */
export interface CollectionEditValues extends CollectionFormData {
  conditionChangeNote: string;
}

export function collectionEditValues(
  collection: CollectionDoc,
  groups: CollectionGroupMembership[],
): CollectionEditValues {
  return {
    ...createInitialFormData(collection, groups),
    conditionChangeNote: "",
  };
}

export function comparableCollectionEdit(
  values: CollectionEditValues,
): Record<string, unknown> {
  const { condition: _setByAcceptedAssessment, ...comparable } =
    comparableCollectionForm(values);
  return comparable;
}

const collectionEditValuesSchema = collectionFormDataSchema.extend({
  conditionChangeNote: z.string(),
});

export function parseCollectionEditValues(
  stored: unknown,
): CollectionEditValues | null {
  const parsed = collectionEditValuesSchema.safeParse(stored);
  return parsed.success ? parsed.data : null;
}

type CollectionUpdateArgs = FunctionArgs<typeof api.collections.update>;

/** The `collections.update` arguments for the fields staff changed. */
export function collectionUpdatePatch(
  collectionId: Id<"collections">,
  values: CollectionEditValues,
  changedFields: string[],
): CollectionUpdateArgs {
  const changed = new Set(changedFields);
  const patch: CollectionUpdateArgs = { collectionId };
  for (const field of [
    "title",
    "alternativeTitle",
    "creator",
    "objectName",
    "culture",
    "period",
    "dateCreated",
    "technique",
    "dimensionUnit",
    "description",
    "inscriptions",
    "provenance",
    "exhibitionHistory",
    "donated_date",
    "donation_info",
    "acquisitionMethod",
    "creditLine",
    "publicSlug",
    "displayStatus",
  ] as const) {
    if (changed.has(field)) patch[field] = values[field] ?? "";
  }
  // "" clears the structured date; validation has refused incomplete input.
  if (changed.has("dateCreatedEdtf"))
    patch.dateCreatedEdtf = edtfFromDraft(values.dateCreatedEdtf) ?? "";
  if (changed.has("dimensions"))
    patch.dimensions = values.dimensions?.trim() || "";
  if (changed.has("dimensionDiameter"))
    patch.dimensionDiameter = values.dimensionDiameter?.trim() || "";
  if (changed.has("objectType"))
    patch.objectType = JSON.stringify(
      Array.isArray(values.objectType)
        ? values.objectType
        : values.objectType
          ? [values.objectType]
          : [],
    );
  if (changed.has("materials"))
    patch.materials = serializeStringListField(values.materials);
  if (changed.has("dimensionWeight") || changed.has("weightUnit")) {
    const weight = parseOptionalWeight(values.dimensionWeight);
    patch.dimensionWeight = weight.value ?? null;
    patch.weightUnit =
      weight.value === undefined
        ? ""
        : weight.unit || values.weightUnit?.trim() || "";
  }
  for (const field of [
    "dimensionHeight",
    "dimensionWidth",
    "dimensionDepth",
  ] as const) {
    if (changed.has(field))
      patch[field] = parseOptionalMeasurement(values[field]).value ?? null;
  }
  if (changed.has("inscriptionMarks"))
    patch.inscriptionMarks = (values.inscriptionMarks ?? []).flatMap(
      ({ localId: _localId, ...mark }) =>
        mark.label.trim() || mark.description.trim() ? [mark] : [],
    );
  if (changed.has("tags"))
    patch.tags = (values.tags ?? []).flatMap((tag) =>
      tag.trim() ? [tag.trim()] : [],
    );
  if (changed.has("links"))
    patch.links = (values.links ?? []).flatMap(
      ({ localId: _localId, ...link }) => (link.url.trim() ? [link] : []),
    );
  if (changed.has("ownershipHistory"))
    patch.ownershipHistory = (values.ownershipHistory ?? []).map(
      ({ localId: _localId, ...entry }) => entry,
    );
  for (const field of [
    "donated_by",
    "previous_owners",
    "alternateAccessionNumbers",
  ] as const) {
    if (changed.has(field)) patch[field] = values[field] ?? [];
  }
  for (const field of [
    "legalRestrictions",
    "isPubliclyVisible",
    "isHighResDownloadable",
    "isSearchable",
    "isValuationVisible",
  ] as const) {
    if (changed.has(field)) patch[field] = values[field] ?? false;
  }
  if (changed.has("parentObjectId"))
    patch.parentObjectId = values.parentObjectId
      ? (values.parentObjectId as Id<"collections">)
      : null;
  if (
    changed.has("currentLocationId") &&
    values.currentLocationId &&
    values.currentLocationId !== "__none__"
  )
    patch.currentLocationId = values.currentLocationId as Id<"locations">;
  if (changed.has("collectionGroupIds") || changed.has("collectionGroupId")) {
    patch.collectionGroupIds = (values.collectionGroupIds ?? []).flatMap(
      (groupId) => (groupId ? [groupId as Id<"collectionGroups">] : []),
    );
    if (values.collectionGroupId)
      patch.collectionGroupId =
        values.collectionGroupId as Id<"collectionGroups">;
  }
  return patch;
}
