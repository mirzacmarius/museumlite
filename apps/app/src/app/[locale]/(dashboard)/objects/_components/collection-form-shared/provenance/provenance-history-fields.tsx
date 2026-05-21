"use client";

import { Label } from "@v1/ui/label";
import { Textarea } from "@v1/ui/textarea";
import { EditSection } from "../edit-section";
import type { CollectionFormTabProps } from "../types";

export function ProvenanceHistoryFields({
  formData,
  updateField,
  placeholders,
}: Pick<CollectionFormTabProps, "formData" | "updateField" | "placeholders">) {
  return (
    <EditSection
      title="Provenance and history"
      description="Historical context and movement details that give the object its narrative."
    >
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="provenance">Provenance</Label>
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
          <Label htmlFor="exhibitionHistory">Exhibition History</Label>
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
