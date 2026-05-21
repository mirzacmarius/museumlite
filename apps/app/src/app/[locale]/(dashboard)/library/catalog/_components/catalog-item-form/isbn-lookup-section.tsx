"use client";

import {
  IsbnLookup,
  type IsbnLookupData,
} from "@/components/library/isbn-lookup";
import { useScopedI18n } from "@/locales/client";
import { Button } from "@v1/ui/button";
import { Input } from "@v1/ui/input";
import { Label } from "@v1/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@v1/ui/select";
import { Textarea } from "@v1/ui/textarea";
import { Loader2, Plus, Save, Trash2 } from "lucide-react";
import type { CatalogItemFormData, ItemType, TargetAudience } from "./types";
import { ITEM_TYPE_VALUES } from "./types";

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
  formData,
  setFormData,
  getItemTypeLabel,
  getAudienceLabel,
  onIsbnData,
  addAuthor,
  removeAuthor,
  updateAuthor,
}: CatalogItemIsbnLookupSectionProps) {
  const t = useScopedI18n("library.placeholders");
  const tNew = useScopedI18n("library.catalog.new");
  const tLib = useScopedI18n("library");

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
