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

interface CatalogItemDescriptionSectionProps {
  formData: CatalogItemFormData;
  setFormData: React.Dispatch<React.SetStateAction<CatalogItemFormData>>;
  getItemTypeLabel: (value: string) => string;
  getAudienceLabel: (value: string) => string;
  onIsbnData?: (data: IsbnLookupData) => void;
  addAuthor?: () => void;
  removeAuthor?: (index: number) => void;
  updateAuthor?: (index: number, value: string) => void;
}

export function CatalogItemDescriptionSection({
  formData,
  setFormData,
  getItemTypeLabel,
  getAudienceLabel,
  onIsbnData,
  addAuthor,
  removeAuthor,
  updateAuthor,
}: CatalogItemDescriptionSectionProps) {
  const t = useScopedI18n("library.placeholders");
  const tNew = useScopedI18n("library.catalog.new");
  const tLib = useScopedI18n("library");

  return (
    <>
      {/* Description */}
      <div className="rounded-lg border border-border bg-card">
        <div className="border-b border-border p-6">
          <h2 className="text-lg font-medium">{tNew("descriptionLabel")}</h2>
        </div>
        <div className="space-y-6 p-6">
          <div className="space-y-2">
            <Label htmlFor="description">{tNew("descriptionLabel")}</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  description: e.target.value,
                }))
              }
              placeholder={t("bookDescription")}
              rows={4}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="coverImageUrl">{tNew("coverImageUrl")}</Label>
            <Input
              id="coverImageUrl"
              value={formData.coverImageUrl}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  coverImageUrl: e.target.value,
                }))
              }
              placeholder="https://..."
            />
            {formData.coverImageUrl && (
              <div className="mt-2">
                <img
                  src={formData.coverImageUrl}
                  alt={tNew("coverPreview")}
                  className="h-40 w-auto rounded border object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
