"use client";

import { Input } from "@v1/ui/input";
import { Label } from "@v1/ui/label";
import type { IsbnLookupData } from "@/components/library/isbn-lookup";
import { useScopedI18n } from "@/locales/client";
import type { CatalogItemFormData } from "./types";

interface CatalogItemIdentifiersSectionProps {
  formData: CatalogItemFormData;
  setFormData: React.Dispatch<React.SetStateAction<CatalogItemFormData>>;
  getItemTypeLabel: (value: string) => string;
  getAudienceLabel: (value: string) => string;
  onIsbnData?: (data: IsbnLookupData) => void;
  addAuthor?: () => void;
  removeAuthor?: (index: number) => void;
  updateAuthor?: (index: number, value: string) => void;
}

export function CatalogItemIdentifiersSection({
  formData,
  setFormData,
}: CatalogItemIdentifiersSectionProps) {
  const t = useScopedI18n("library.placeholders");
  const tNew = useScopedI18n("library.catalog.new");
  const _tLib = useScopedI18n("library");

  return (
    <>
      {/* Identifiers */}
      <div className="rounded-lg border border-border bg-card">
        <div className="border-b border-border p-6">
          <h2 className="text-lg font-medium">{tNew("identifiers")}</h2>
        </div>
        <div className="grid grid-cols-1 gap-6 p-6 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="isbn">{tNew("isbn10")}</Label>
            <Input
              id="isbn"
              value={formData.isbn}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, isbn: e.target.value }))
              }
              placeholder="0-123456-78-9"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="isbn13">{tNew("isbn13")}</Label>
            <Input
              id="isbn13"
              value={formData.isbn13}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, isbn13: e.target.value }))
              }
              placeholder="978-0-123456-78-9"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="issn">{tNew("issn")}</Label>
            <Input
              id="issn"
              value={formData.issn}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, issn: e.target.value }))
              }
              placeholder={t("forPeriodicals")}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="barcode">{tNew("barcode")}</Label>
            <Input
              id="barcode"
              value={formData.barcode}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  barcode: e.target.value,
                }))
              }
              placeholder={t("itemBarcode")}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="callNumber">{tNew("callNumber")}</Label>
            <Input
              id="callNumber"
              value={formData.callNumber}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  callNumber: e.target.value,
                }))
              }
              placeholder="e.g., 823.912"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="accessionNumber">{tNew("accessionNumber")}</Label>
            <Input
              id="accessionNumber"
              value={formData.accessionNumber}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  accessionNumber: e.target.value,
                }))
              }
              placeholder={t("libraryAccessionNumber")}
            />
          </div>
        </div>
      </div>
    </>
  );
}
