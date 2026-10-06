"use client";

import { Input } from "@v1/ui/input";
import { Label } from "@v1/ui/label";
import { Textarea } from "@v1/ui/textarea";
import { ConditionCombobox } from "@/components/condition-combobox";
import { MaterialsCombobox } from "@/components/materials-combobox";
import { useI18n } from "@/locales/client";
import { EditSection } from "../../collection-form-shared/edit-section";
import type { CollectionFormTabProps } from "../../collection-form-shared/types";
export function ObjectRequestPhysicalTab({
  formData,
  updateField,
  placeholders,
  currentOrganizationId,
}: CollectionFormTabProps) {
  const tRoot = useI18n();
  return (
    <div className="space-y-8">
      <EditSection
        title={tRoot(
          "untranslatedRecords.objects.form.physicalCharacteristics",
        )}
        description={tRoot(
          "untranslatedRecords.objects.attributes.materialDimensionsCondition",
        )}
      >
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="materials">{tRoot("objects.form.materials")}</Label>
            <MaterialsCombobox
              organizationId={currentOrganizationId}
              value={
                Array.isArray(formData.materials) ? formData.materials : []
              }
              onValueChange={(value) => updateField("materials", value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="condition">{tRoot("objects.form.condition")}</Label>
            <ConditionCombobox
              organizationId={currentOrganizationId}
              value={formData.condition || ""}
              onValueChange={(value) => updateField("condition", value)}
            />
          </div>

          <div className="space-y-3 md:col-span-2 xl:col-span-3">
            <div className="space-y-1">
              <h3 className="text-sm font-medium text-foreground">
                {tRoot("objects.printView.detailedDimensions")}
              </h3>
              <p className="text-sm text-muted-foreground">
                {tRoot(
                  "untranslatedRecords.objects.form.detailedDimensionsHint",
                )}
              </p>
            </div>
            <div className="grid gap-5 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="dimensions">
                  {tRoot("objects.form.dimensions")}
                </Label>
                <Input
                  id="dimensions"
                  value={formData.dimensions || ""}
                  onChange={(event) =>
                    updateField("dimensions", event.target.value)
                  }
                  placeholder={placeholders("dimensions")}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="dimensionDiameter">
                  {tRoot("objects.printView.diameter")}
                </Label>
                <Input
                  id="dimensionDiameter"
                  value={formData.dimensionDiameter || ""}
                  onChange={(event) =>
                    updateField("dimensionDiameter", event.target.value)
                  }
                  placeholder={tRoot(
                    "untranslatedRecords.objects.examples.dimensions",
                    { value: "43 mm" },
                  )}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="dimensionWeight">
                  {tRoot("objects.printView.weight")}
                </Label>
                <Input
                  id="dimensionWeight"
                  inputMode="decimal"
                  value={formData.dimensionWeight ?? ""}
                  onChange={(event) =>
                    updateField("dimensionWeight", event.target.value)
                  }
                  placeholder={tRoot(
                    "untranslatedRecords.objects.examples.weight",
                    { value: "200gram or 2kg" },
                  )}
                />
              </div>
            </div>
          </div>

          <div className="space-y-2 md:col-span-2 xl:col-span-3">
            <Label htmlFor="inscriptions">
              {tRoot("untranslatedRecords.objects.detail.inscriptionsMarks")}
            </Label>
            <Textarea
              autoResize
              id="inscriptions"
              value={formData.inscriptions || ""}
              onChange={(event) =>
                updateField("inscriptions", event.target.value)
              }
              rows={4}
              placeholder={tRoot(
                "untranslatedRecords.objects.form.documentMarksDescription",
              )}
            />
          </div>
        </div>
      </EditSection>
    </div>
  );
}
