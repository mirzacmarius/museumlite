"use client";

import {
  IsbnLookup,
  type IsbnLookupData,
} from "@/components/library/isbn-lookup";
import { useScopedI18n } from "@/locales/client";
import type { CatalogItemFormData } from "./types";

interface CatalogItemIsbnLookupSectionProps {
  formData: CatalogItemFormData;
  setFormData: React.Dispatch<React.SetStateAction<CatalogItemFormData>>;
  getItemTypeLabel: (value: string) => string;
  getAudienceLabel: (value: string) => string;
  onIsbnData?: (data: IsbnLookupData) => void;
  addAuthor?: () => void;
  removeAuthor?: (index: number) => void;
  updateAuthor?: (index: number, value: string) => void;
}

export function CatalogItemIsbnLookupSection({
  _formData,
  setFormData,
  _getItemTypeLabel,
  _getAudienceLabel,
  onIsbnData,
  _addAuthor,
  _removeAuthor,
  _updateAuthor,
}: CatalogItemIsbnLookupSectionProps) {
  const _t = useScopedI18n("library.placeholders");
  const _tNew = useScopedI18n("library.catalog.new");
  const _tLib = useScopedI18n("library");

  return (
    <>
      {/* ISBN Lookup */}
      <IsbnLookup
        onDataFound={onIsbnData!}
        onIsbnChange={(isbn) => {
          const cleanIsbn = isbn.replace(/[-\s]/g, "");
          if (cleanIsbn.length === 10) {
            setFormData((prev) => ({ ...prev, isbn: cleanIsbn }));
          } else if (cleanIsbn.length === 13) {
            setFormData((prev) => ({ ...prev, isbn13: cleanIsbn }));
          }
        }}
      />
    </>
  );
}
