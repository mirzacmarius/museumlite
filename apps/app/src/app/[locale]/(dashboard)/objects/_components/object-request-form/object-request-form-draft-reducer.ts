import type { Id } from "@v1/backend/convex/_generated/dataModel";
import {
  type CollectionType,
  isCollectionType,
} from "@v1/backend/convex/utils/moduleCatalog";
import type {
  CollectionFormData,
  DraftMediaItem,
} from "../collection-form-shared/types";
import { hasTypeDetailValues } from "../object-type-details/type-detail-values";

export interface ObjectRequestDraftState {
  formData: CollectionFormData;
  draftAccessionId: Id<"accessions"> | null;
  persistedDraftMedia: DraftMediaItem[];
  draftSavedAt: number | null;
  initialized: boolean;
  /** A collection type change waiting for staff to confirm losing details. */
  pendingCollectionType: CollectionType | null;
}

export type ObjectRequestDraftAction =
  | {
      type: "INIT_FROM_PROPS";
      formData: CollectionFormData;
      draftAccessionId: Id<"accessions"> | null;
      persistedDraftMedia: DraftMediaItem[];
      draftSavedAt: number | null;
    }
  | {
      type: "update_field";
      field: keyof CollectionFormData;
      value: CollectionFormData[keyof CollectionFormData];
    }
  | { type: "set_draft_accession_id"; value: Id<"accessions"> | null }
  | { type: "set_persisted_draft_media"; value: DraftMediaItem[] }
  | { type: "set_draft_saved_at"; value: number | null }
  | { type: "confirm_collection_type_change" }
  | { type: "cancel_collection_type_change" };

/** Details are kept only for the collection type the draft now has. */
function applyCollectionType(
  state: ObjectRequestDraftState,
  collectionType: CollectionType,
): ObjectRequestDraftState {
  const { typeDetails } = state.formData;
  return {
    ...state,
    pendingCollectionType: null,
    formData: {
      ...state.formData,
      collectionType,
      typeDetails:
        typeDetails?.collectionType === collectionType
          ? typeDetails
          : undefined,
    },
  };
}

function requestCollectionTypeChange(
  state: ObjectRequestDraftState,
  value: CollectionFormData[keyof CollectionFormData],
): ObjectRequestDraftState {
  const collectionType =
    typeof value === "string" && isCollectionType(value) ? value : "general";
  if (collectionType === state.formData.collectionType) return state;

  const { typeDetails } = state.formData;
  if (
    typeDetails?.collectionType !== collectionType &&
    hasTypeDetailValues(typeDetails)
  ) {
    return { ...state, pendingCollectionType: collectionType };
  }
  return applyCollectionType(state, collectionType);
}

export function objectRequestDraftReducer(
  state: ObjectRequestDraftState,
  action: ObjectRequestDraftAction,
): ObjectRequestDraftState {
  switch (action.type) {
    case "INIT_FROM_PROPS":
      return {
        formData: action.formData,
        draftAccessionId: action.draftAccessionId,
        persistedDraftMedia: action.persistedDraftMedia,
        draftSavedAt: action.draftSavedAt,
        initialized: true,
        pendingCollectionType: null,
      };
    case "update_field":
      if (action.field === "collectionType") {
        return requestCollectionTypeChange(state, action.value);
      }
      return {
        ...state,
        formData: { ...state.formData, [action.field]: action.value },
      };
    case "set_draft_accession_id":
      return { ...state, draftAccessionId: action.value };
    case "set_persisted_draft_media":
      return { ...state, persistedDraftMedia: action.value };
    case "set_draft_saved_at":
      return { ...state, draftSavedAt: action.value };
    case "confirm_collection_type_change":
      return state.pendingCollectionType
        ? applyCollectionType(state, state.pendingCollectionType)
        : state;
    case "cancel_collection_type_change":
      return { ...state, pendingCollectionType: null };
  }
}
