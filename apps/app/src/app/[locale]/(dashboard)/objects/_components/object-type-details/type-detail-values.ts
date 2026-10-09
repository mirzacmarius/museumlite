import {
  type ObjectDraftTypeDetails,
  withoutBlankDetailValues,
} from "@v1/backend/convex/utils/collectionTypeDetailFields";
import type { CollectionModuleId } from "@v1/backend/convex/utils/moduleCatalog";

export type TypeDetailFieldValue = string | number | boolean | string[];

export type TypeDetailFieldValues = Partial<
  Record<string, TypeDetailFieldValue>
>;

/** Type-specific details held by the intake form for one collection type. */
export interface TypeDetailsDraft {
  collectionType: CollectionModuleId;
  fields: TypeDetailFieldValues;
}

export function hasTypeDetailValues(typeDetails?: TypeDetailsDraft) {
  return (
    typeDetails !== undefined &&
    Object.keys(withoutBlankDetailValues(typeDetails.fields)).length > 0
  );
}

/**
 * The draft payload for the details the form holds, or nothing when they
 * are empty or belong to a collection type other than the draft's own.
 */
export function toObjectDraftTypeDetails(
  collectionType: string | undefined,
  typeDetails: TypeDetailsDraft | undefined,
): ObjectDraftTypeDetails | undefined {
  if (!typeDetails || typeDetails.collectionType !== collectionType) {
    return undefined;
  }
  const fields = withoutBlankDetailValues(typeDetails.fields);
  if (Object.keys(fields).length === 0) return undefined;
  // Field names and value shapes come from the per-type field specs; the
  // server validates the payload against the same contracts.
  return {
    collectionType: typeDetails.collectionType,
    fields,
  } as ObjectDraftTypeDetails;
}
