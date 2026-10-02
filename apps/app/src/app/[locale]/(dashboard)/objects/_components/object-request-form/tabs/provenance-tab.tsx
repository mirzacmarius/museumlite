"use client";

import { useState } from "react";
import { FormLinksSection } from "../../collection-form-shared/provenance/form-links-section";
import { OwnershipHistoryEditSection } from "../../collection-form-shared/provenance/ownership-history-edit-section";
import { OwnershipHistoryRequestSection } from "../../collection-form-shared/provenance/ownership-history-request-section";
import { ProvenanceHistoryFields } from "../../collection-form-shared/provenance/provenance-history-fields";
import type {
  CollectionFormTabProps,
  OwnershipEntry,
} from "../../collection-form-shared/types";
import { createOwnershipEntryLocalId } from "../../collection-form-shared/utils";

interface ObjectRequestProvenanceTabProps extends CollectionFormTabProps {
  catalogPresentation?: boolean;
}

export function ObjectRequestProvenanceTab({
  formData,
  updateField,
  placeholders,
  catalogPresentation = false,
}: ObjectRequestProvenanceTabProps) {
  const [editingOwnershipEntryId, setEditingOwnershipEntryId] = useState<
    string | null
  >(null);

  function createOwnershipEntry(entry: Omit<OwnershipEntry, "localId">) {
    return { ...entry, localId: createOwnershipEntryLocalId() };
  }

  return (
    <div className="space-y-8">
      <ProvenanceHistoryFields
        formData={formData}
        updateField={updateField}
        placeholders={placeholders}
      />
      {catalogPresentation ? (
        <OwnershipHistoryEditSection
          formData={formData}
          updateField={updateField}
          placeholders={placeholders}
          editingOwnershipEntryId={editingOwnershipEntryId}
          setEditingOwnershipEntryId={setEditingOwnershipEntryId}
          createOwnershipEntry={createOwnershipEntry}
        />
      ) : (
        <OwnershipHistoryRequestSection
          formData={formData}
          updateField={updateField}
          placeholders={placeholders}
        />
      )}
      <FormLinksSection
        formData={formData}
        updateField={updateField}
        placeholders={placeholders}
        useLocalIds={catalogPresentation}
      />
    </div>
  );
}
