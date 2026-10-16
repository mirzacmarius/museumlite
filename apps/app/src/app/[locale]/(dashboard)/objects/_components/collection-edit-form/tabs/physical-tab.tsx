"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@v1/ui/dialog";
import { Input } from "@v1/ui/input";
import { Label } from "@v1/ui/label";
import { Textarea } from "@v1/ui/textarea";
import { useQuery } from "convex/react";
import { ConditionCombobox } from "@/components/condition-combobox";
import { MaterialsCombobox } from "@/components/materials-combobox";
import { usePermissions } from "@/components/permission-gate";
import {
  FieldError,
  fieldErrorProps,
} from "@/components/record-form/record-form-notices";
import { useI18n, useScopedI18n } from "@/locales/client";
import { ConditionAssessmentPanel } from "../../../[id]/_components/condition-assessment-panel";
import { formatConditionLabel } from "../../../[id]/_components/condition-display";
import {
  InscriptionMarksField,
  MeasuredDimensionsFields,
  TechniqueField,
} from "../../collection-form-shared/catalog-parity-fields";
import { EditSection } from "../../collection-form-shared/edit-section";
import {
  type CollectionFormTabProps,
  NO_FIELD_ERRORS,
} from "../../collection-form-shared/types";
export interface CollectionEditPhysicalTabProps extends CollectionFormTabProps {
  typedCollectionId?: Id<"collections">;
}

export function CollectionEditPhysicalTab({
  formData,
  updateField,
  placeholders,
  currentOrganizationId,
  fieldErrors = NO_FIELD_ERRORS,
  typedCollectionId,
}: CollectionEditPhysicalTabProps) {
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
              collectionId={typedCollectionId}
              value={
                Array.isArray(formData.materials) ? formData.materials : []
              }
              onValueChange={(value) => updateField("materials", value)}
            />
          </div>

          <TechniqueField formData={formData} updateField={updateField} />

          {typedCollectionId ? (
            <ConditionField collectionId={typedCollectionId} />
          ) : (
            <div className="space-y-2">
              <Label htmlFor="condition">
                {tRoot("objects.form.condition")}
              </Label>
              <ConditionCombobox
                id="condition"
                organizationId={currentOrganizationId}
                value={formData.condition || ""}
                onValueChange={(value) => updateField("condition", value)}
              />
              <FieldError field="condition" message={fieldErrors.condition} />
            </div>
          )}

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

function ConditionField({ collectionId }: { collectionId: Id<"collections"> }) {
  const tRoot = useI18n();
  const t = useScopedI18n("conditionAssessments");
  const { hasPermission } = usePermissions();
  const detail = useQuery(api.conditionAssessments.getForObject, {
    collectionId,
  });
  const current = detail?.current.condition;
  return (
    <div className="space-y-2">
      <p className="text-sm leading-none font-medium">
        {tRoot("objects.form.condition")}
      </p>
      <div className="flex flex-wrap items-center gap-3">
        {detail ? (
          <span className="text-sm">
            {current ? formatConditionLabel(current, tRoot) : t("unknown")}
          </span>
        ) : null}
        {detail?.open ? (
          <span className="text-xs text-muted-foreground">
            {detail.open.status === "draft"
              ? t("openDraftCaption")
              : t("awaitingApprovalCaption")}
          </span>
        ) : null}
        {hasPermission("collections.update") ||
        hasPermission("collections.accept_condition") ? (
          <Dialog>
            <DialogTrigger asChild>
              <Button type="button" variant="outline">
                {t("setCondition")}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl">
              <DialogHeader>
                <DialogTitle>{t("setCondition")}</DialogTitle>
                <DialogDescription>{t("description")}</DialogDescription>
              </DialogHeader>
              <ConditionAssessmentPanel
                collectionId={collectionId}
                mode="edit"
              />
            </DialogContent>
          </Dialog>
        ) : null}
      </div>
    </div>
  );
}
