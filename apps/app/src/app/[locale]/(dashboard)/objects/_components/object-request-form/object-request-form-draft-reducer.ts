import type { Id } from "@v1/backend/convex/_generated/dataModel";
import type {
  CollectionFormData,
  DraftMediaItem,
} from "../collection-form-shared/types";

export interface ObjectRequestDraftState {
  formData: CollectionFormData;
  draftAccessionId: Id<"accessions"> | null;
  persistedDraftMedia: DraftMediaItem[];
  draftSavedAt: number | null;
  initialized: boolean;
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
  | { type: "set_draft_saved_at"; value: number | null };

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
      };
    case "update_field":
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
  }
}
