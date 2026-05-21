"use client";

import type { IsbnLookupData } from "@/components/library/isbn-lookup";
import { useScopedI18n } from "@/locales/client";
import { Button } from "@v1/ui/button";
import { Loader2, Save } from "lucide-react";
import { CatalogItemBasicInformationSection } from "./basic-information-section";
import { CatalogItemClassificationSection } from "./classification-section";
import { CatalogItemDescriptionSection } from "./description-section";
import { CatalogItemIdentifiersSection } from "./identifiers-section";
import { CatalogItemIsbnLookupSection } from "./isbn-lookup-section";
import { CatalogItemNotesSection } from "./notes-section";
import { CatalogItemPublicationDetailsSection } from "./publication-details-section";
import type { CatalogItemFormData } from "./types";

interface CatalogItemFormProps {
  formData: CatalogItemFormData;
  setFormData: React.Dispatch<React.SetStateAction<CatalogItemFormData>>;
  getItemTypeLabel: (value: string) => string;
  getAudienceLabel: (value: string) => string;
  onIsbnData: (data: IsbnLookupData) => void;
  addAuthor: () => void;
  removeAuthor: (index: number) => void;
  updateAuthor: (index: number, value: string) => void;
  isSaving: boolean;
  submitLabel: string;
  savingLabel: string;
}

export function CatalogItemForm({
  formData,
  setFormData,
  getItemTypeLabel,
  getAudienceLabel,
  onIsbnData,
  addAuthor,
  removeAuthor,
  updateAuthor,
  isSaving,
  submitLabel,
  savingLabel,
}: CatalogItemFormProps) {
  const tNew = useScopedI18n("library.catalog.new");
  const sectionProps = {
    formData,
    setFormData,
    getItemTypeLabel,
    getAudienceLabel,
    onIsbnData,
    addAuthor,
    removeAuthor,
    updateAuthor,
  };

  return (
    <div className="space-y-6">
      <CatalogItemIsbnLookupSection {...sectionProps} />
      <CatalogItemBasicInformationSection {...sectionProps} />
      <CatalogItemIdentifiersSection {...sectionProps} />
      <CatalogItemPublicationDetailsSection {...sectionProps} />
      <CatalogItemClassificationSection {...sectionProps} />
      <CatalogItemDescriptionSection {...sectionProps} />
      <CatalogItemNotesSection {...sectionProps} />

      <div className="flex justify-end gap-4">
        <Button type="submit" disabled={isSaving}>
          {isSaving ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" />
              {savingLabel}
            </>
          ) : (
            <>
              <Save className="mr-2 size-4" />
              {submitLabel}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
