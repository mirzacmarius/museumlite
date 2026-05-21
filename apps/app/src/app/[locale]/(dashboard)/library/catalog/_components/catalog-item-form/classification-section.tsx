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
import { ITEM_TYPE_VALUES, TARGET_AUDIENCE_VALUES } from "./types";

interface CatalogItemClassificationSectionProps {
  formData: CatalogItemFormData;
  setFormData: React.Dispatch<React.SetStateAction<CatalogItemFormData>>;
  getItemTypeLabel: (value: string) => string;
  getAudienceLabel: (value: string) => string;
  onIsbnData?: (data: IsbnLookupData) => void;
  addAuthor?: () => void;
  removeAuthor?: (index: number) => void;
  updateAuthor?: (index: number, value: string) => void;
}

export function CatalogItemClassificationSection({
  formData,
  setFormData,
  getItemTypeLabel,
  getAudienceLabel,
  onIsbnData,
  addAuthor,
  removeAuthor,
  updateAuthor,
}: CatalogItemClassificationSectionProps) {
  const t = useScopedI18n("library.placeholders");
  const tNew = useScopedI18n("library.catalog.new");
  const tLib = useScopedI18n("library");

  return (
    <>
      {/* Classification */}
      <div className="rounded-lg border border-border bg-card">
        <div className="border-b border-border p-6">
          <h2 className="text-lg font-medium">{tNew("classification")}</h2>
        </div>
        <div className="grid grid-cols-1 gap-6 p-6 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="deweyDecimal">{tNew("deweyDecimal")}</Label>
            <Input
              id="deweyDecimal"
              value={formData.deweyDecimal}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  deweyDecimal: e.target.value,
                }))
              }
              placeholder="e.g., 823.912"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="lcClassification">{tNew("lcClassification")}</Label>
            <Input
              id="lcClassification"
              value={formData.lcClassification}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  lcClassification: e.target.value,
                }))
              }
              placeholder="e.g., PR6019.O9"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="categories">{tNew("categories")}</Label>
            <Input
              id="categories"
              value={formData.categories}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  categories: e.target.value,
                }))
              }
              placeholder={t("commaSeparatedCategories")}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="genres">{tNew("genres")}</Label>
            <Input
              id="genres"
              value={formData.genres}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, genres: e.target.value }))
              }
              placeholder={t("commaSeparatedGenres")}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="subjects">{tNew("subjects")}</Label>
            <Input
              id="subjects"
              value={formData.subjects}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  subjects: e.target.value,
                }))
              }
              placeholder={t("commaSeparatedSubjects")}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="targetAudience">{tNew("targetAudience")}</Label>
            <Select
              value={formData.targetAudience}
              onValueChange={(value: TargetAudience) =>
                setFormData((prev) => ({ ...prev, targetAudience: value }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder={t("selectAudience")} />
              </SelectTrigger>
              <SelectContent>
                {TARGET_AUDIENCE_VALUES.map((value) => (
                  <SelectItem key={value} value={value}>
                    {getAudienceLabel(value)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="series">{tNew("series")}</Label>
            <Input
              id="series"
              value={formData.series}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, series: e.target.value }))
              }
              placeholder={t("seriesName")}
            />
          </div>
        </div>
      </div>
    </>
  );
}
