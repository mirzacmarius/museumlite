"use client";

import { Input } from "@v1/ui/input";
import { Label } from "@v1/ui/label";
import { Textarea } from "@v1/ui/textarea";
import { ConditionCombobox } from "@/components/condition-combobox";
import { MaterialsCombobox } from "@/components/materials-combobox";
import {
  FieldError,
  fieldErrorProps,
} from "@/components/record-form/record-form-notices";
import { useI18n } from "@/locales/client";
import {
  InscriptionMarksField,
  MeasuredDimensionsFields,
  TechniqueField,
} from "../../collection-form-shared/catalog-parity-fields";
import { EditSection } from "../../collection-form-shared/edit-section";
import { MeasurementSetsField } from "../../collection-form-shared/measurement-sets-field";
import { CompletenessFields } from "../../collection-form-shared/object-description-fields";
import {
  type CollectionFormTabProps,
  NO_FIELD_ERRORS,
} from "../../collection-form-shared/types";
export function ObjectRequestPhysicalTab({
  formData,
  updateField,
  currentOrganizationId,
  fieldErrors = NO_FIELD_ERRORS,
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
            <Label id="materials-label" htmlFor="materials">
              {tRoot("objects.form.materials")}
            </Label>
            <MaterialsCombobox
              id="materials"
              aria-labelledby="materials-label"
              organizationId={currentOrganizationId}
              value={
                Array.isArray(formData.materials) ? formData.materials : []
              }
              onValueChange={(value) => updateField("materials", value)}
            />
          </div>

          <TechniqueField formData={formData} updateField={updateField} />

          <div className="space-y-2">
            <Label htmlFor="condition">{tRoot("objects.form.condition")}</Label>
            <ConditionCombobox
              organizationId={currentOrganizationId}
              value={formData.condition || ""}
              onValueChange={(value) => updateField("condition", value)}
            />
          </div>

          <CompletenessFields
            formData={formData}
            updateField={updateField}
            fieldErrors={fieldErrors}
          />

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
            <div className="grid gap-5 md:grid-cols-2">
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
                  {...fieldErrorProps(
                    "dimensionWeight",
                    fieldErrors.dimensionWeight,
                  )}
                />
                <FieldError
                  field="dimensionWeight"
                  message={fieldErrors.dimensionWeight}
                />
              </div>
            </div>
          </div>

          <MeasuredDimensionsFields
            formData={formData}
            updateField={updateField}
            fieldErrors={fieldErrors}
          />

          <MeasurementSetsField
            formData={formData}
            updateField={updateField}
            fieldErrors={fieldErrors}
          />

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

          <InscriptionMarksField
            formData={formData}
            updateField={updateField}
          />
        </div>
      </EditSection>
    </div>
  );
}
