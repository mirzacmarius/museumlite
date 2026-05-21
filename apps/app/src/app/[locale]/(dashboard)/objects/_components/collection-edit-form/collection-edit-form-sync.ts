import type { CollectionFormData } from "../collection-form-shared/types";
import { EMPTY_EDIT_FORM } from "../collection-form-shared/utils";

export interface CollectionEditFormSyncState {
  formData: CollectionFormData;
  isInitialized: boolean;
}

export type CollectionEditFormSyncAction =
  | { type: "sync_from_server"; formData: CollectionFormData }
  | {
      type: "update_field";
      field: keyof CollectionFormData;
      value: CollectionFormData[keyof CollectionFormData];
    };

export function collectionEditFormSyncReducer(
  state: CollectionEditFormSyncState,
  action: CollectionEditFormSyncAction,
): CollectionEditFormSyncState {
  switch (action.type) {
    case "sync_from_server":
      return { formData: action.formData, isInitialized: true };
    case "update_field":
      return {
        ...state,
        formData: { ...state.formData, [action.field]: action.value },
      };
  }
}

export const initialCollectionEditFormSyncState: CollectionEditFormSyncState = {
  formData: EMPTY_EDIT_FORM,
  isInitialized: false,
};
