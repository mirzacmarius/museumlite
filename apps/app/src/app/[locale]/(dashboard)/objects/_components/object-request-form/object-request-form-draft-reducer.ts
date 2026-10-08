import type { Id } from "@v1/backend/convex/_generated/dataModel";
import type {
  CollectionFormData,
  DraftMediaItem,
} from "../collection-form-shared/types";

export interface ObjectRequestDraftState {
  formData: CollectionFormData;
  draftAccessionId: Id<"accessions"> | null;
  persistedDraftMedia: DraftMediaItem[];
  savedPrimaryStorageId: Id<"_storage"> | null;
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
  | { type: "set_persisted_primary"; storageId: Id<"_storage"> | null }
  | { type: "set_draft_saved_at"; value: number | null };

export function draftPrimaryStorageId(draftMedia: DraftMediaItem[]) {
  return (
    draftMedia.find((item) => item.isPrimary && item.mediaCategory === "image")
      ?.storageId ?? null
  );
}

function withPrimaryImage(
  draftMedia: DraftMediaItem[],
  storageId: Id<"_storage"> | null,
) {
  return draftMedia.map((item) => {
    const isPrimary =
      item.mediaCategory === "image" && item.storageId === storageId;
    return item.isPrimary === isPrimary ? item : { ...item, isPrimary };
  });
}

function savedDraftMedia(draftMedia: DraftMediaItem[]) {
  const primaryStorageId = draftPrimaryStorageId(draftMedia);
  return {
    persistedDraftMedia: withPrimaryImage(draftMedia, primaryStorageId),
    savedPrimaryStorageId: primaryStorageId,
  };
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
        ...savedDraftMedia(action.persistedDraftMedia),
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
      return { ...state, ...savedDraftMedia(action.value) };
    case "set_persisted_primary":
      return {
        ...state,
        persistedDraftMedia: withPrimaryImage(
          state.persistedDraftMedia,
          action.storageId,
        ),
      };
    case "set_draft_saved_at":
      return { ...state, draftSavedAt: action.value };
  }
}
