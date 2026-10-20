"use client";

import { Button } from "@v1/ui/button";
import { Input } from "@v1/ui/input";
import { Label } from "@v1/ui/label";
import { Switch } from "@v1/ui/switch";
import {
  TagsInput,
  TagsInputInput,
  TagsInputItem,
  TagsInputList,
} from "@v1/ui/tags-input";
import { Plus, Trash2 } from "lucide-react";
import {
  FieldError,
  fieldErrorProps,
} from "@/components/record-form/record-form-notices";
import { useI18n, useScopedI18n } from "@/locales/client";
import { type CollectionFormTabProps, NO_FIELD_ERRORS } from "./types";
import { withInscriptionMarkLocalIds } from "./utils";

/**
 * Catalog fields that intake drafts and catalog records both hold, so staff
 * see and keep them in both forms instead of losing them between the two.
 */
type ParityFieldProps = Pick<
  CollectionFormTabProps,
  "formData" | "updateField" | "fieldErrors"
>;

export function TagsField({ formData, updateField }: ParityFieldProps) {
  const tRoot = useI18n();
  const t = useScopedI18n("recordForm.objectFields");
  const tags = formData.tags ?? [];
  return (
    <div className="space-y-2">
      <Label htmlFor="tags">{tRoot("objects.printView.tags")}</Label>
      <TagsInput
        value={tags}
        onValueChange={(value) =>
          updateField(
            "tags",
            value.flatMap((tag) => (String(tag).trim() ? [String(tag)] : [])),
          )
        }
        addOnPaste
        addOnTab
        blurBehavior="add"
      >
        <TagsInputList>
          {tags.map((tag) => (
            <TagsInputItem key={tag} value={tag}>
              {tag}
            </TagsInputItem>
          ))}
          <TagsInputInput id="tags" />
        </TagsInputList>
      </TagsInput>
      <p className="text-xs text-muted-foreground">{t("tagsHint")}</p>
    </div>
  );
}

export function TechniqueField({ formData, updateField }: ParityFieldProps) {
  const tRoot = useI18n();
  return (
    <div className="space-y-2">
      <Label htmlFor="technique">{tRoot("objects.printView.technique")}</Label>
      <Input
        id="technique"
        value={formData.technique || ""}
        onChange={(event) => updateField("technique", event.target.value)}
      />
    </div>
  );
}

export function MeasuredDimensionsFields({
  formData,
  updateField,
  fieldErrors = NO_FIELD_ERRORS,
}: ParityFieldProps) {
  const t = useScopedI18n("recordForm.objectFields");
  const measurements = [
    { field: "dimensionHeight", label: t("height") },
    { field: "dimensionWidth", label: t("width") },
    { field: "dimensionDepth", label: t("depth") },
  ] as const;
  return (
    <div className="space-y-3 md:col-span-2 xl:col-span-3">
      <div className="space-y-1">
        <h3 className="text-sm font-medium text-foreground">
          {t("measuredDimensions")}
        </h3>
        <p className="text-sm text-muted-foreground">
          {t("measuredDimensionsHint")}
        </p>
      </div>
      <div className="grid gap-5 sm:grid-cols-2 md:grid-cols-4">
        {measurements.map(({ field, label }) => (
          <div key={field} className="space-y-2">
            <Label htmlFor={field}>{label}</Label>
            <Input
              id={field}
              inputMode="decimal"
              value={formData[field] || ""}
              onChange={(event) => updateField(field, event.target.value)}
              {...fieldErrorProps(field, fieldErrors[field])}
            />
            <FieldError field={field} message={fieldErrors[field]} />
          </div>
        ))}
        <div className="space-y-2">
          <Label htmlFor="dimensionUnit">{t("dimensionUnit")}</Label>
          <Input
            id="dimensionUnit"
            value={formData.dimensionUnit || ""}
            onChange={(event) =>
              updateField("dimensionUnit", event.target.value)
            }
            placeholder="cm"
          />
        </div>
      </div>
    </div>
  );
}

export function InscriptionMarksField({
  formData,
  updateField,
}: ParityFieldProps) {
  const t = useScopedI18n("recordForm.objectFields");
  // Rows carry the ids the form gave them when the values were loaded.
  const marks = formData.inscriptionMarks ?? [];
  const setMarks = (next: typeof marks) =>
    updateField("inscriptionMarks", next);
  return (
    <div className="space-y-3 md:col-span-2 xl:col-span-3">
      <div className="space-y-1">
        <h3
          className="text-sm font-medium text-foreground"
          id="inscriptionMarks"
        >
          {t("inscriptionMarks")}
        </h3>
        <p className="text-sm text-muted-foreground">
          {t("inscriptionMarksHint")}
        </p>
      </div>
      {marks.map((mark, index) => (
        <div
          key={mark.localId ?? `mark-${index}`}
          className="grid gap-3 sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)_auto] sm:items-end"
        >
          <div className="space-y-2">
            <Label htmlFor={`inscription-mark-label-${index}`}>
              {t("inscriptionMarkLabel")}
            </Label>
            <Input
              id={`inscription-mark-label-${index}`}
              value={mark.label}
              onChange={(event) =>
                setMarks(
                  marks.map((item, itemIndex) =>
                    itemIndex === index
                      ? { ...item, label: event.target.value }
                      : item,
                  ),
                )
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`inscription-mark-description-${index}`}>
              {t("inscriptionMarkDescription")}
            </Label>
            <Input
              id={`inscription-mark-description-${index}`}
              value={mark.description}
              onChange={(event) =>
                setMarks(
                  marks.map((item, itemIndex) =>
                    itemIndex === index
                      ? { ...item, description: event.target.value }
                      : item,
                  ),
                )
              }
            />
          </div>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label={t("removeInscriptionMark")}
            onClick={() =>
              setMarks(marks.filter((_, itemIndex) => itemIndex !== index))
            }
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() =>
          setMarks(
            withInscriptionMarkLocalIds([
              ...marks,
              { label: "", description: "" },
            ]),
          )
        }
      >
        <Plus className="mr-2 size-4" />
        {t("addInscriptionMark")}
      </Button>
    </div>
  );
}

export function CreditLineField({ formData, updateField }: ParityFieldProps) {
  const tRoot = useI18n();
  return (
    <div className="space-y-2">
      <Label htmlFor="creditLine">
        {tRoot("objects.printView.creditLine")}
      </Label>
      <Input
        id="creditLine"
        value={formData.creditLine || ""}
        onChange={(event) => updateField("creditLine", event.target.value)}
      />
    </div>
  );
}

export function LegalRestrictionsField({
  formData,
  updateField,
}: ParityFieldProps) {
  const t = useScopedI18n("recordForm.objectFields");
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-border/50 p-4 lg:col-span-2">
      <div className="space-y-0.5">
        <Label htmlFor="legalRestrictions">{t("legalRestrictions")}</Label>
        <p className="text-xs text-muted-foreground">
          {t("legalRestrictionsHint")}
        </p>
      </div>
      <Switch
        id="legalRestrictions"
        checked={formData.legalRestrictions ?? false}
        onCheckedChange={(checked) => updateField("legalRestrictions", checked)}
      />
    </div>
  );
}
