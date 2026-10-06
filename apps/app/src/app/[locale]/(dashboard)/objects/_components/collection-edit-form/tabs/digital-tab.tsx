"use client";

import { Input } from "@v1/ui/input";
import { Label } from "@v1/ui/label";
import { Switch } from "@v1/ui/switch";
import { useI18n } from "@/locales/client";
import { EditSection } from "../../collection-form-shared/edit-section";
import type { CollectionFormTabProps } from "../../collection-form-shared/types";
export function CollectionEditDigitalTab({
  formData,
  updateField,
}: CollectionFormTabProps) {
  const tRoot = useI18n();
  return (
    <div className="space-y-8">
      <EditSection
        title={tRoot("untranslatedRecords.objects.form.digitalVisibility")}
        description={tRoot(
          "untranslatedRecords.objects.form.publicVisibilityDescription",
        )}
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4 rounded-xl border border-border/50 p-4">
            <div className="space-y-0.5">
              <Label htmlFor="isPubliclyVisible">
                {tRoot("objects.printPreview.publicVisibility")}
              </Label>
              <p className="text-xs text-muted-foreground">
                {tRoot("untranslatedRecords.objects.form.allowPublicCatalog")}
              </p>
            </div>
            <Switch
              id="isPubliclyVisible"
              checked={formData.isPubliclyVisible ?? false}
              onCheckedChange={(checked) =>
                updateField("isPubliclyVisible", checked)
              }
            />
          </div>

          <div className="flex items-center justify-between gap-4 rounded-xl border border-border/50 p-4">
            <div className="space-y-0.5">
              <Label htmlFor="isHighResDownloadable">
                {tRoot(
                  "untranslatedRecords.objects.form.highResolutionDownloads",
                )}
              </Label>
              <p className="text-xs text-muted-foreground">
                {tRoot("untranslatedRecords.objects.form.allowPublicDownload")}
              </p>
            </div>
            <Switch
              id="isHighResDownloadable"
              checked={formData.isHighResDownloadable ?? false}
              onCheckedChange={(checked) =>
                updateField("isHighResDownloadable", checked)
              }
            />
          </div>

          <div className="flex items-center justify-between gap-4 rounded-xl border border-border/50 p-4">
            <div className="space-y-0.5">
              <Label htmlFor="isSearchable">
                {tRoot("objects.form.searchable")}
              </Label>
              <p className="text-xs text-muted-foreground">
                {tRoot("untranslatedRecords.objects.form.publicSearchResults")}
              </p>
            </div>
            <Switch
              id="isSearchable"
              checked={formData.isSearchable ?? true}
              onCheckedChange={(checked) =>
                updateField("isSearchable", checked)
              }
            />
          </div>

          <div className="flex items-center justify-between gap-4 rounded-xl border border-border/50 p-4">
            <div className="space-y-0.5">
              <Label htmlFor="isValuationVisible">
                {tRoot("untranslatedRecords.objects.form.valuationVisibility")}
              </Label>
              <p className="text-xs text-muted-foreground">
                {tRoot("untranslatedRecords.objects.form.showValuation")}
              </p>
            </div>
            <Switch
              id="isValuationVisible"
              checked={formData.isValuationVisible ?? false}
              onCheckedChange={(checked) =>
                updateField("isValuationVisible", checked)
              }
            />
          </div>
        </div>
      </EditSection>

      <EditSection
        title={tRoot("untranslatedRecords.objects.form.publicUrl")}
        description={tRoot(
          "untranslatedRecords.objects.attributes.optionalPublicSlug",
        )}
      >
        <div className="space-y-2">
          <Label htmlFor="publicSlug">
            {tRoot("objects.form.publicUrlSlug")}
          </Label>
          <Input
            id="publicSlug"
            value={formData.publicSlug ?? ""}
            onChange={(event) => updateField("publicSlug", event.target.value)}
            placeholder={tRoot("objects.form.placeholders.urlSlug")}
            className="font-mono text-sm"
          />
          <p className="text-xs text-muted-foreground">
            {tRoot("untranslatedRecords.objects.form.leaveBlankPublicPath")}
          </p>
        </div>
      </EditSection>
    </div>
  );
}
