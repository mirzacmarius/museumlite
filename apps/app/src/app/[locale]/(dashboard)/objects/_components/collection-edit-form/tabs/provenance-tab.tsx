"use client";

import { FormLinksSection } from "../../collection-form-shared/provenance/form-links-section";
import { OwnershipHistoryEditSection } from "../../collection-form-shared/provenance/ownership-history-edit-section";
import { ProvenanceHistoryFields } from "../../collection-form-shared/provenance/provenance-history-fields";
import type {
  CollectionFormTabProps,
  OwnershipEntry,
} from "../../collection-form-shared/types";

export interface CollectionEditProvenanceTabProps
  extends CollectionFormTabProps {
  editingOwnershipEntryId: string | null;
  setEditingOwnershipEntryId: (id: string | null) => void;
  createOwnershipEntry: (
    entry: Omit<OwnershipEntry, "localId">,
  ) => OwnershipEntry;
}

export function CollectionEditProvenanceTab({
  formData,
  updateField,
  placeholders,
  editingOwnershipEntryId,
  setEditingOwnershipEntryId,
  createOwnershipEntry,
}: CollectionEditProvenanceTabProps) {
  return (
    <div className="space-y-8">
      <ProvenanceHistoryFields
        formData={formData}
        updateField={updateField}
        placeholders={placeholders}
      />
      <OwnershipHistoryEditSection
        formData={formData}
        updateField={updateField}
        placeholders={placeholders}
        editingOwnershipEntryId={editingOwnershipEntryId}
        setEditingOwnershipEntryId={setEditingOwnershipEntryId}
        createOwnershipEntry={createOwnershipEntry}
      />
      <FormLinksSection
        formData={formData}
        updateField={updateField}
        placeholders={placeholders}
        useLocalIds
      />
    </div>
  );
}
