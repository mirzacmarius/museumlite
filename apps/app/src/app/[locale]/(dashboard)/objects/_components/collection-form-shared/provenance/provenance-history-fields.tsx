"use client";

import { Label } from "@v1/ui/label";
import { Textarea } from "@v1/ui/textarea";
import { useI18n } from "@/locales/client";
import { EditSection } from "../edit-section";
import type { CollectionFormTabProps } from "../types";
export function ProvenanceHistoryFields({
  formData,
  updateField,
  placeholders,
}: Pick<CollectionFormTabProps, "formData" | "updateField" | "placeholders">) {
  const tRoot = useI18n();
  return (
    <EditSection
      title={tRoot("untranslatedRecords.objects.form.provenanceHistory")}
      description={tRoot(
        "untranslatedRecords.objects.form.historicalContextDescription",
      )}
    >
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="provenance">{tRoot("objects.form.provenance")}</Label>
          <Textarea
            autoResize
            id="provenance"
            value={formData.provenance || ""}
            onChange={(event) => updateField("provenance", event.target.value)}
            rows={5}
            placeholder={placeholders("provenance")}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="exhibitionHistory">
            {tRoot("objects.form.exhibitionHistory")}
          </Label>
          <Textarea
            autoResize
            id="exhibitionHistory"
            value={formData.exhibitionHistory || ""}
            onChange={(event) =>
              updateField("exhibitionHistory", event.target.value)
            }
            rows={5}
            placeholder={placeholders("exhibitionHistory")}
          />
        </div>
      </div>
    </EditSection>
  );
}
