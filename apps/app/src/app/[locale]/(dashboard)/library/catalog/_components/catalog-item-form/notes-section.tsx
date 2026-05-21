"use client";

import { Label } from "@v1/ui/label";
import { Textarea } from "@v1/ui/textarea";
import type { IsbnLookupData } from "@/components/library/isbn-lookup";
import { useScopedI18n } from "@/locales/client";
import type { CatalogItemFormData } from "./types";

interface CatalogItemNotesSectionProps {
  formData: CatalogItemFormData;
  setFormData: React.Dispatch<React.SetStateAction<CatalogItemFormData>>;
  getItemTypeLabel: (value: string) => string;
  getAudienceLabel: (value: string) => string;
  onIsbnData?: (data: IsbnLookupData) => void;
  addAuthor?: () => void;
  removeAuthor?: (index: number) => void;
  updateAuthor?: (index: number, value: string) => void;
}

export function CatalogItemNotesSection({
  formData,
  setFormData,
  _getItemTypeLabel,
  _getAudienceLabel,
  _onIsbnData,
  _addAuthor,
  _removeAuthor,
  _updateAuthor,
}: CatalogItemNotesSectionProps) {
  const t = useScopedI18n("library.placeholders");
  const tNew = useScopedI18n("library.catalog.new");
  const _tLib = useScopedI18n("library");

  return (
    <>
      {/* Notes */}
      <div className="rounded-lg border border-border bg-card">
        <div className="border-b border-border p-6">
          <h2 className="text-lg font-medium">{tNew("notes")}</h2>
        </div>
        <div className="space-y-6 p-6">
          <div className="space-y-2">
            <Label htmlFor="notes">{tNew("publicNotes")}</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, notes: e.target.value }))
              }
              placeholder={t("notesVisibleToPatrons")}
              rows={2}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="internalNotes">{tNew("internalNotes")}</Label>
            <Textarea
              id="internalNotes"
              value={formData.internalNotes}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  internalNotes: e.target.value,
                }))
              }
              placeholder={t("staffOnlyNotes")}
              rows={2}
            />
          </div>
        </div>
      </div>
    </>
  );
}
