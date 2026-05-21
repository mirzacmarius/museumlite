"use client";

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
import { Plus, Trash2 } from "lucide-react";
import type { IsbnLookupData } from "@/components/library/isbn-lookup";
import { useScopedI18n } from "@/locales/client";
import type { CatalogItemFormData, ItemType } from "./types";
import { ITEM_TYPE_VALUES } from "./types";

function buildAuthorRows(authors: string[]) {
  return authors.map((author, position, allAuthors) => {
    const label = author || "author-empty";
    const occurrence =
      allAuthors.slice(0, position).filter((value) => value === author)
        .length + 1;
    return { author, key: `${label}-${occurrence}`, position };
  });
}

interface CatalogItemBasicInformationSectionProps {
  formData: CatalogItemFormData;
  setFormData: React.Dispatch<React.SetStateAction<CatalogItemFormData>>;
  getItemTypeLabel: (value: string) => string;
  getAudienceLabel: (value: string) => string;
  onIsbnData?: (data: IsbnLookupData) => void;
  addAuthor?: () => void;
  removeAuthor?: (index: number) => void;
  updateAuthor?: (index: number, value: string) => void;
}

export function CatalogItemBasicInformationSection({
  formData,
  setFormData,
  getItemTypeLabel,
  addAuthor,
  removeAuthor,
  updateAuthor,
}: CatalogItemBasicInformationSectionProps) {
  const t = useScopedI18n("library.placeholders");
  const tNew = useScopedI18n("library.catalog.new");
  const _tLib = useScopedI18n("library");

  return (
    <>
      {/* Basic Information */}
      <div className="rounded-lg border border-border bg-card">
        <div className="border-b border-border p-6">
          <h2 className="text-lg font-medium">{tNew("basicInfo")}</h2>
        </div>
        <div className="grid grid-cols-1 gap-6 p-6 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="itemType">{tNew("itemType")}</Label>
            <Select
              value={formData.itemType}
              onValueChange={(value: ItemType) =>
                setFormData((prev) => ({ ...prev, itemType: value }))
              }
            >
              <SelectTrigger>
                <SelectValue>{getItemTypeLabel(formData.itemType)}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {ITEM_TYPE_VALUES.map((value) => (
                  <SelectItem key={value} value={value}>
                    {getItemTypeLabel(value)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="language">{tNew("language")}</Label>
            <Input
              id="language"
              value={formData.language}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  language: e.target.value,
                }))
              }
              placeholder={t("english")}
              required
            />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="title">{tNew("titleLabel")}</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, title: e.target.value }))
              }
              placeholder={t("enterTitle")}
              required
            />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="subtitle">{tNew("subtitle")}</Label>
            <Input
              id="subtitle"
              value={formData.subtitle}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  subtitle: e.target.value,
                }))
              }
              placeholder={t("enterSubtitle")}
            />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label>{tNew("authors")}</Label>
            {buildAuthorRows(formData.authors).map(({ author, key, position }) => (
              <div key={key} className="flex gap-2">
                <Input
                  value={author}
                  onChange={(e) => updateAuthor?.(position, e.target.value)}
                  placeholder={tNew("authorPlaceholder", {
                    number: position + 1,
                  })}
                />
                {formData.authors.length > 1 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => removeAuthor?.(position)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                )}
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => addAuthor?.()}
            >
              <Plus className="mr-2 size-4" />
              {tNew("addAuthor")}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
