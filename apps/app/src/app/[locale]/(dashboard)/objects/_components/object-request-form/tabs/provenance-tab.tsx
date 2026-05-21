"use client";

import { FormLinksSection } from "../../collection-form-shared/provenance/form-links-section";
import { OwnershipHistoryRequestSection } from "../../collection-form-shared/provenance/ownership-history-request-section";
import { ProvenanceHistoryFields } from "../../collection-form-shared/provenance/provenance-history-fields";
import type { CollectionFormTabProps } from "../../collection-form-shared/types";

export function ObjectRequestProvenanceTab({
  formData,
  updateField,
  placeholders,
}: CollectionFormTabProps) {
  return (
    <div className="space-y-8">
      <ProvenanceHistoryFields
        formData={formData}
        updateField={updateField}
        placeholders={placeholders}
      />
      <OwnershipHistoryRequestSection
        formData={formData}
        updateField={updateField}
        placeholders={placeholders}
      />
      <FormLinksSection
        formData={formData}
        updateField={updateField}
        placeholders={placeholders}
      />
    </div>
  );
}
