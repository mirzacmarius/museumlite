"use client";

import { Input } from "@v1/ui/input";
import { Label } from "@v1/ui/label";
import type { IsbnLookupData } from "@/components/library/isbn-lookup";
import { useI18n, useScopedI18n } from "@/locales/client";
import type { CatalogItemFormData } from "./types";

interface CatalogItemPublicationDetailsSectionProps {
  formData: CatalogItemFormData;
  setFormData: React.Dispatch<React.SetStateAction<CatalogItemFormData>>;
  getItemTypeLabel: (value: string) => string;
  getAudienceLabel: (value: string) => string;
  onIsbnData?: (data: IsbnLookupData) => void;
  addAuthor?: () => void;
  removeAuthor?: (index: number) => void;
  updateAuthor?: (index: number, value: string) => void;
}

export function CatalogItemPublicationDetailsSection({
  formData,
  setFormData,
}: CatalogItemPublicationDetailsSectionProps) {
  const tRoot = useI18n();
  const t = useScopedI18n("library.placeholders");
  const tNew = useScopedI18n("library.catalog.new");
  const _tLib = useScopedI18n("library");

  return (
    <>
      {/* Publication Details */}
      <div className="rounded-lg border border-border bg-card">
        <div className="border-b border-border p-6">
          <h2 className="text-lg font-medium">{tNew("publicationDetails")}</h2>
        </div>
        <div className="grid grid-cols-1 gap-6 p-6 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="publisher">{tNew("publisher")}</Label>
            <Input
              id="publisher"
              value={formData.publisher}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  publisher: e.target.value,
                }))
              }
              placeholder={t("publisherName")}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="publicationYear">{tNew("publicationYear")}</Label>
            <Input
              id="publicationYear"
              type="number"
              value={formData.publicationYear}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  publicationYear: e.target.value,
                }))
              }
              placeholder={tRoot("untranslatedRecords.objects.examples.year", {
                value: "2024",
              })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="publicationPlace">{tNew("publicationPlace")}</Label>
            <Input
              id="publicationPlace"
              value={formData.publicationPlace}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  publicationPlace: e.target.value,
                }))
              }
              placeholder={tRoot("untranslatedRecords.objects.examples.place", {
                value: "New York",
              })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edition">{tNew("edition")}</Label>
            <Input
              id="edition"
              value={formData.edition}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  edition: e.target.value,
                }))
              }
              placeholder={tRoot(
                "untranslatedRecords.objects.examples.edition",
                { value: "2nd Edition" },
              )}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pages">{tNew("pages")}</Label>
            <Input
              id="pages"
              type="number"
              value={formData.pages}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, pages: e.target.value }))
              }
              placeholder={t("numberOfPages")}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="format">{tNew("format")}</Label>
            <Input
              id="format"
              value={formData.format}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, format: e.target.value }))
              }
              placeholder={tRoot(
                "untranslatedRecords.objects.examples.binding",
                { value: "Hardcover, Paperback" },
              )}
            />
          </div>
        </div>
      </div>
    </>
  );
}
